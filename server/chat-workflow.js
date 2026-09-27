import express from 'express'
import { pool } from './db.js'
import { resolveSessionAccount, verifyOrigin } from './auth.js'
import { chatAccessRoles } from '../shared/roles.js'
import { galleryCategories } from '../src/data/gallery.js'

const router = express.Router({ mergeParams: true })
const staffRoles = new Set(chatAccessRoles)
const customerRoles = new Set(['client', ...chatAccessRoles])
const productById = new Map(
  galleryCategories.flatMap((category) => category.products.map((product) => [
    product.id,
    { ...product, category: category.name },
  ])),
)
const taskDefinitions = [
  { key: 'preparation', label: 'Preparar mobiliario' },
  { key: 'delivery', label: 'Despacho y transporte' },
  { key: 'installation', label: 'Montaje' },
  { key: 'dismantling', label: 'Desmontaje' },
  { key: 'return_check', label: 'Retorno e inspección' },
]
const taskStatuses = new Set(['assigned', 'in_progress', 'completed', 'blocked'])

router.use(verifyOrigin, express.json({ limit: '64kb' }))

function parseId(value) {
  return /^\d{1,15}$/.test(value ?? '') ? value : null
}

function parseDateTime(value) {
  if (typeof value !== 'string' || value.length > 40) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function parseQuoteItems(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 40) return null

  let total = 0
  const items = []
  for (const item of value) {
    const quantity = Number(item?.quantity)
    const unitPrice = Number(item?.unitPrice)
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) return null
    if (!Number.isSafeInteger(unitPrice) || unitPrice < 0 || unitPrice > 1_000_000_000) return null

    const productId = typeof item?.productId === 'string' && item.productId ? item.productId : null
    const product = productId ? productById.get(productId) : null
    if (productId && !product) return null

    const productName = product?.name ?? (typeof item?.productName === 'string' ? item.productName.trim() : '')
    const categoryName = product?.category ?? (typeof item?.categoryName === 'string' ? item.categoryName.trim() : '')
    const description = product?.detail ?? (typeof item?.description === 'string' ? item.description.trim() : '')
    if (!productName || productName.length > 160 || categoryName.length > 100 || description.length > 300) return null

    const rawCustomizations = item?.customizations ?? {}
    if (!rawCustomizations || typeof rawCustomizations !== 'object' || Array.isArray(rawCustomizations)) return null
    const customizations = {}
    for (const field of ['details', 'color', 'finish', 'dimensions']) {
      const fieldValue = rawCustomizations[field]
      if (fieldValue === undefined || fieldValue === '') continue
      if (typeof fieldValue !== 'string' || fieldValue.length > 300) return null
      customizations[field] = fieldValue.trim()
    }

    total += unitPrice * quantity
    if (!Number.isSafeInteger(total)) return null
    items.push({ productId, productName, categoryName, description, quantity, unitPrice, customizations })
  }

  return { items, total }
}

async function authorizeChat(request, response) {
  const account = await resolveSessionAccount(request, response)
  if (!account) {
    response.status(401).json({ error: 'Inicia sesión para continuar.' })
    return null
  }
  if (!customerRoles.has(account.role)) {
    response.status(403).json({ error: 'No tienes permiso para este flujo de trabajo.' })
    return null
  }

  const chatId = parseId(request.params.chatId)
  if (!chatId) {
    response.status(400).json({ error: 'El identificador del chat no es válido.' })
    return null
  }

  const result = await pool.query(
    `SELECT id, customer_id, status
     FROM chat_conversations
     WHERE id = $1 AND ($2::boolean OR customer_id = $3)`,
    [chatId, staffRoles.has(account.role), account.id],
  )
  if (!result.rowCount) {
    response.status(404).json({ error: 'No encontramos esta conversación.' })
    return null
  }

  return { account, chat: result.rows[0] }
}

router.get('/staff', async (request, response) => {
  const authorized = await authorizeChat(request, response)
  if (!authorized) return
  if (!staffRoles.has(authorized.account.role)) {
    return response.status(403).json({ error: 'Solo el equipo puede consultar responsables.' })
  }

  const result = await pool.query(
    `SELECT id, name, email, role
     FROM customer_accounts
     WHERE role <> 'client' AND is_banned = FALSE
     ORDER BY name ASC, id ASC`,
  )
  return response.json({ staff: result.rows })
})

router.get('/', async (request, response) => {
  const authorized = await authorizeChat(request, response)
  if (!authorized) return
  const { account, chat } = authorized

  const quotesResult = await pool.query(
    `SELECT quote.id, quote.version, quote.status, quote.total_amount,
            quote.currency, quote.terms, quote.valid_until, quote.created_at,
            quote.accepted_at, quote.created_by, creator.name AS created_by_name,
            quote.accepted_by, accepter.name AS accepted_by_name
     FROM chat_quote_versions AS quote
     JOIN customer_accounts AS creator ON creator.id = quote.created_by
     LEFT JOIN customer_accounts AS accepter ON accepter.id = quote.accepted_by
     WHERE quote.chat_id = $1
     ORDER BY quote.version DESC`,
    [chat.id],
  )
  const quoteIds = quotesResult.rows.map((quote) => quote.id)
  const quoteItemsResult = quoteIds.length
    ? await pool.query(
      `SELECT id, quote_version_id, product_id, product_name, category_name,
              description, unit_price, quantity, customizations
       FROM chat_quote_version_items
       WHERE quote_version_id = ANY($1::bigint[])
       ORDER BY id ASC`,
      [quoteIds],
    )
    : { rows: [] }

  const orderResult = await pool.query(
    `SELECT orders.id, orders.quote_version_id, orders.status, orders.event_name,
            orders.venue, orders.setup_at, orders.event_at, orders.dismantle_at,
            orders.coordinator_id, coordinator.name AS coordinator_name,
            orders.created_at
     FROM orders
     JOIN customer_accounts AS coordinator ON coordinator.id = orders.coordinator_id
     WHERE orders.chat_id = $1
     LIMIT 1`,
    [chat.id],
  )

  let order = null
  if (orderResult.rowCount) {
    const orderRow = orderResult.rows[0]
    const [itemsResult, tasksResult] = await Promise.all([
      pool.query(
        `SELECT product_id, product_name, category_name, description,
                unit_price, quantity, customizations
         FROM order_items WHERE order_id = $1 ORDER BY id ASC`,
        [orderRow.id],
      ),
      pool.query(
        `SELECT task.id, task.task_key, task.label, task.status,
                task.assigned_to, account.name AS assigned_to_name, account.role AS assigned_to_role
         FROM order_tasks AS task
         JOIN customer_accounts AS account ON account.id = task.assigned_to
         WHERE task.order_id = $1 ORDER BY task.id ASC`,
        [orderRow.id],
      ),
    ])
    order = { ...orderRow, items: itemsResult.rows, tasks: tasksResult.rows }
  }

  return response.json({
    quotes: quotesResult.rows.map((quote) => ({
      ...quote,
      isLatest: quote.id === quotesResult.rows[0]?.id,
      items: quoteItemsResult.rows
        .filter((item) => String(item.quote_version_id) === String(quote.id))
        .map((item) => ({ ...item, isOwn: String(quote.created_by) === String(account.id) })),
    })),
    order,
  })
})

router.post('/quotes', async (request, response) => {
  const authorized = await authorizeChat(request, response)
  if (!authorized) return
  const { account, chat } = authorized
  if (!staffRoles.has(account.role)) {
    return response.status(403).json({ error: 'Solo el equipo puede enviar cotizaciones.' })
  }
  if (chat.status !== 'open') {
    return response.status(409).json({ error: 'Reabre la conversación antes de enviar una cotización.' })
  }

  const parsedItems = parseQuoteItems(request.body?.items)
  if (!parsedItems) return response.status(400).json({ error: 'Revisa los productos, cantidades, precios y personalizaciones.' })
  const terms = typeof request.body?.terms === 'string' ? request.body.terms.trim() : ''
  if (terms.length > 2000) return response.status(400).json({ error: 'Las condiciones no pueden superar 2.000 caracteres.' })
  const validUntil = request.body?.validUntil || null
  if (validUntil && (typeof validUntil !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(validUntil) || Number.isNaN(Date.parse(`${validUntil}T00:00:00Z`)))) {
    return response.status(400).json({ error: 'La fecha de vigencia no es válida.' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const lockedChat = await client.query('SELECT status FROM chat_conversations WHERE id = $1 FOR UPDATE', [chat.id])
    if (lockedChat.rows[0]?.status !== 'open') {
      await client.query('ROLLBACK')
      return response.status(409).json({ error: 'Reabre la conversación antes de enviar una cotización.' })
    }
    const hasOrder = await client.query('SELECT 1 FROM orders WHERE chat_id = $1 LIMIT 1', [chat.id])
    if (hasOrder.rowCount) {
      await client.query('ROLLBACK')
      return response.status(409).json({ error: 'Este chat ya tiene un pedido. Registra los cambios como revisión del pedido.' })
    }
    const acceptedQuote = await client.query(
      `SELECT id FROM chat_quote_versions WHERE chat_id = $1 AND status = 'accepted' LIMIT 1`,
      [chat.id],
    )
    if (acceptedQuote.rowCount) {
      await client.query('ROLLBACK')
      return response.status(409).json({ error: 'La cotización ya fue aceptada. Continúa los cambios como revisión del pedido.' })
    }

    const previousVersion = await client.query(
      'SELECT COALESCE(MAX(version), 0)::integer AS version FROM chat_quote_versions WHERE chat_id = $1',
      [chat.id],
    )
    const version = previousVersion.rows[0].version + 1
    await client.query(
      `UPDATE chat_quote_versions SET status = 'superseded'
       WHERE chat_id = $1 AND status = 'sent'`,
      [chat.id],
    )
    const quote = await client.query(
      `INSERT INTO chat_quote_versions
       (chat_id, version, status, total_amount, terms, valid_until, created_by)
       VALUES ($1, $2, 'sent', $3, $4, $5, $6)
       RETURNING id`,
      [chat.id, version, parsedItems.total, terms, validUntil, account.id],
    )
    const quoteId = quote.rows[0].id

    for (const item of parsedItems.items) {
      await client.query(
        `INSERT INTO chat_quote_version_items
         (quote_version_id, product_id, product_name, category_name, description,
          unit_price, quantity, customizations)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
        [quoteId, item.productId, item.productName, item.categoryName, item.description,
          item.unitPrice, item.quantity, JSON.stringify(item.customizations)],
      )
    }
    await client.query('UPDATE chat_conversations SET last_message_at = NOW() WHERE id = $1', [chat.id])
    await client.query('COMMIT')
    return response.status(201).json({ quoteId, version, totalAmount: parsedItems.total })
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
})

router.post('/quotes/:quoteId/accept', async (request, response) => {
  const authorized = await authorizeChat(request, response)
  if (!authorized) return
  const { account, chat } = authorized
  if (account.role !== 'client') {
    return response.status(403).json({ error: 'Solo el cliente puede aceptar la cotización.' })
  }
  if (chat.status !== 'open') {
    return response.status(409).json({ error: 'La conversación está cerrada.' })
  }
  const quoteId = parseId(request.params.quoteId)
  if (!quoteId) return response.status(400).json({ error: 'El identificador de cotización no es válido.' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const quote = await client.query(
      `SELECT id, version, status, valid_until
       FROM chat_quote_versions WHERE id = $1 AND chat_id = $2 FOR UPDATE`,
      [quoteId, chat.id],
    )
    if (!quote.rowCount || quote.rows[0].status !== 'sent') {
      await client.query('ROLLBACK')
      return response.status(409).json({ error: 'Esta cotización ya no está vigente.' })
    }
    const latest = await client.query(
      'SELECT MAX(version)::integer AS version FROM chat_quote_versions WHERE chat_id = $1',
      [chat.id],
    )
    if (quote.rows[0].version !== latest.rows[0].version) {
      await client.query('ROLLBACK')
      return response.status(409).json({ error: 'Hay una versión más reciente para revisar.' })
    }
    if (quote.rows[0].valid_until && new Date(quote.rows[0].valid_until) < new Date(new Date().toISOString().slice(0, 10))) {
      await client.query('ROLLBACK')
      return response.status(409).json({ error: 'La vigencia de esta cotización terminó. Solicita una versión actualizada.' })
    }
    await client.query(
      `UPDATE chat_quote_versions SET status = 'accepted', accepted_by = $2, accepted_at = NOW()
       WHERE id = $1`,
      [quoteId, account.id],
    )
    await client.query(
      `UPDATE chat_quote_versions SET status = 'superseded'
       WHERE chat_id = $1 AND id <> $2 AND status = 'sent'`,
      [chat.id, quoteId],
    )
    await client.query('UPDATE chat_conversations SET last_message_at = NOW() WHERE id = $1', [chat.id])
    await client.query('COMMIT')
    return response.json({ status: 'accepted' })
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
})

router.post('/orders', async (request, response) => {
  const authorized = await authorizeChat(request, response)
  if (!authorized) return
  const { account, chat } = authorized
  if (!staffRoles.has(account.role)) {
    return response.status(403).json({ error: 'Solo el equipo puede crear pedidos.' })
  }
  if (chat.status !== 'open') {
    return response.status(409).json({ error: 'Reabre la conversación antes de crear el pedido.' })
  }

  const eventName = typeof request.body?.eventName === 'string' ? request.body.eventName.trim() : ''
  const venue = typeof request.body?.venue === 'string' ? request.body.venue.trim() : ''
  const setupAt = parseDateTime(request.body?.setupAt)
  const eventAt = parseDateTime(request.body?.eventAt)
  const dismantleAt = parseDateTime(request.body?.dismantleAt)
  const coordinatorId = parseId(String(request.body?.coordinatorId ?? ''))
  const taskAssignments = request.body?.taskAssignments
  if (!eventName || eventName.length > 160 || !venue || venue.length > 240) {
    return response.status(400).json({ error: 'Indica el nombre del evento y el lugar (máximo 160 y 240 caracteres).' })
  }
  if (!setupAt || !eventAt || !dismantleAt || setupAt > eventAt || eventAt > dismantleAt) {
    return response.status(400).json({ error: 'Revisa las fechas: preparación, evento y desmontaje deben estar en orden.' })
  }
  if (!coordinatorId || !taskAssignments || typeof taskAssignments !== 'object') {
    return response.status(400).json({ error: 'Asigna una persona coordinadora y responsables para cada tarea.' })
  }
  const taskValues = taskDefinitions.map((task) => ({ ...task, accountId: parseId(String(taskAssignments[task.key] ?? '')) }))
  if (taskValues.some((task) => !task.accountId)) {
    return response.status(400).json({ error: 'Asigna responsables a preparación, transporte, montaje, desmontaje y retorno.' })
  }

  const assignedIds = [...new Set([coordinatorId, ...taskValues.map((task) => task.accountId)])]
  const activeStaff = await pool.query(
    `SELECT id FROM customer_accounts
     WHERE id = ANY($1::bigint[]) AND role <> 'client' AND is_banned = FALSE`,
    [assignedIds],
  )
  if (activeStaff.rowCount !== assignedIds.length) {
    return response.status(400).json({ error: 'Selecciona responsables con cuentas activas del equipo.' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const lockedChat = await client.query('SELECT status FROM chat_conversations WHERE id = $1 FOR UPDATE', [chat.id])
    if (lockedChat.rows[0]?.status !== 'open') {
      await client.query('ROLLBACK')
      return response.status(409).json({ error: 'Reabre la conversación antes de crear el pedido.' })
    }
    const existingOrder = await client.query('SELECT 1 FROM orders WHERE chat_id = $1 LIMIT 1', [chat.id])
    if (existingOrder.rowCount) {
      await client.query('ROLLBACK')
      return response.status(409).json({ error: 'Este chat ya tiene un pedido asociado.' })
    }
    const acceptedQuote = await client.query(
      `SELECT id FROM chat_quote_versions
       WHERE chat_id = $1 AND status = 'accepted' FOR UPDATE`,
      [chat.id],
    )
    if (!acceptedQuote.rowCount) {
      await client.query('ROLLBACK')
      return response.status(409).json({ error: 'El cliente debe aceptar una cotización antes de crear el pedido.' })
    }
    const quoteId = acceptedQuote.rows[0].id
    const order = await client.query(
      `INSERT INTO orders
       (chat_id, quote_version_id, event_name, venue, setup_at, event_at,
        dismantle_at, coordinator_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [chat.id, quoteId, eventName, venue, setupAt.toISOString(), eventAt.toISOString(), dismantleAt.toISOString(), coordinatorId, account.id],
    )
    const orderId = order.rows[0].id
    await client.query(
      `INSERT INTO order_items
       (order_id, source_quote_item_id, product_id, product_name, category_name,
        description, unit_price, quantity, customizations)
       SELECT $1, id, product_id, product_name, category_name, description,
              unit_price, quantity, customizations
       FROM chat_quote_version_items WHERE quote_version_id = $2`,
      [orderId, quoteId],
    )
    for (const task of taskValues) {
      await client.query(
        `INSERT INTO order_tasks (order_id, task_key, label, assigned_to)
         VALUES ($1, $2, $3, $4)`,
        [orderId, task.key, task.label, task.accountId],
      )
    }
    await client.query('UPDATE chat_conversations SET last_message_at = NOW() WHERE id = $1', [chat.id])
    await client.query('COMMIT')
    return response.status(201).json({ orderId, status: 'planning' })
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
})

router.patch('/tasks/:taskId', async (request, response) => {
  const account = await resolveSessionAccount(request, response)
  if (!account) return response.status(401).json({ error: 'Inicia sesión para actualizar tareas.' })
  const taskId = parseId(request.params.taskId)
  const chatId = parseId(request.params.chatId)
  const status = request.body?.status
  if (!taskId || !chatId || !taskStatuses.has(status)) {
    return response.status(400).json({ error: 'La tarea o el estado no son válidos.' })
  }

  const task = await pool.query(
    `SELECT task.id, task.assigned_to
     FROM order_tasks AS task
     JOIN orders ON orders.id = task.order_id
     WHERE task.id = $1 AND orders.chat_id = $2`,
    [taskId, chatId],
  )
  if (!task.rowCount) return response.status(404).json({ error: 'No encontramos esta tarea.' })
  const isManager = staffRoles.has(account.role)
  if (!isManager && String(task.rows[0].assigned_to) !== String(account.id)) {
    return response.status(403).json({ error: 'Solo el responsable asignado puede actualizar esta tarea.' })
  }
  if (!isManager && status === 'assigned') {
    return response.status(403).json({ error: 'No puedes reasignar una tarea desde esta vista.' })
  }

  const updated = await pool.query(
    `UPDATE order_tasks SET status = $1, updated_by = $2, updated_at = NOW()
     WHERE id = $3 RETURNING id, status, updated_at`,
    [status, account.id, taskId],
  )
  return response.json({ task: updated.rows[0] })
})

export default router