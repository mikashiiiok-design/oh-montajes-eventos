import express from 'express'
import { pool } from './db.js'
import { resolveSessionAccount, verifyOrigin } from './auth.js'
import { chatAccessRoles } from '../shared/roles.js'
import { galleryCategories } from '../src/data/gallery.js'

const router = express.Router()
const staffRoles = new Set(chatAccessRoles)
const allowedClientRoles = new Set(['client', ...chatAccessRoles])
const maximumImageBytes = 320 * 1024
const productsById = new Map(
  galleryCategories.flatMap((category) => category.products.map((product) => [
    product.id,
    { ...product, category: category.name },
  ])),
)

router.use(express.json({ limit: '512kb' }))

function parseId(value) {
  return /^\d{1,15}$/.test(value ?? '') ? value : null
}

function parseImage(dataUrl) {
  if (dataUrl === undefined) return { image: null, mime: null }
  if (typeof dataUrl !== 'string') return null

  const match = dataUrl.match(/^data:(image\/(?:webp|jpeg|png));base64,([A-Za-z0-9+/]+={0,2})$/)
  if (!match) return null

  const image = Buffer.from(match[2], 'base64')
  if (!image.length || image.length > maximumImageBytes) return null

  const validSignature = match[1] === 'image/jpeg'
    ? image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff
    : match[1] === 'image/png'
      ? image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : image.toString('ascii', 0, 4) === 'RIFF' && image.toString('ascii', 8, 12) === 'WEBP'

  return validSignature ? { image, mime: match[1] } : null
}

async function getAuthorizedAccount(request, response) {
  const account = await resolveSessionAccount(request, response)
  if (!account) {
    response.status(401).json({ error: 'Inicia sesión para acceder a los chats.' })
    return null
  }
  if (!allowedClientRoles.has(account.role)) {
    response.status(403).json({ error: 'No tienes permiso para acceder a los chats.' })
    return null
  }
  return account
}

async function getAuthorizedChat(chatId, account, response) {
  const result = await pool.query(
    `SELECT conversation.id, conversation.customer_id, conversation.status,
            conversation.created_at, conversation.last_message_at, customer.name AS customer_name,
            customer.email AS customer_email
     FROM chat_conversations AS conversation
     JOIN customer_accounts AS customer ON customer.id = conversation.customer_id
     WHERE conversation.id = $1 AND ($2::boolean OR conversation.customer_id = $3)`,
    [chatId, staffRoles.has(account.role), account.id],
  )
  if (!result.rowCount) {
    response.status(404).json({ error: 'No encontramos esta conversación.' })
    return null
  }
  return result.rows[0]
}

router.get('/', verifyOrigin, async (request, response) => {
  const account = await getAuthorizedAccount(request, response)
  if (!account) return

  const isStaff = staffRoles.has(account.role)
  const result = await pool.query(
    `SELECT conversation.id, conversation.status, conversation.created_at,
            conversation.last_message_at, customer.id AS customer_id,
            customer.name AS customer_name, customer.email AS customer_email,
            (SELECT message.body FROM chat_messages AS message
             WHERE message.chat_id = conversation.id
             ORDER BY message.created_at DESC, message.id DESC LIMIT 1) AS last_message,
            (SELECT message.image_data IS NOT NULL FROM chat_messages AS message
             WHERE message.chat_id = conversation.id
             ORDER BY message.created_at DESC, message.id DESC LIMIT 1) AS last_message_has_image,
            (SELECT COUNT(*)::integer FROM chat_messages AS message
             WHERE message.chat_id = conversation.id) AS message_count
     FROM chat_conversations AS conversation
     JOIN customer_accounts AS customer ON customer.id = conversation.customer_id
     WHERE ($2::boolean AND conversation.status = 'open')
        OR (NOT $2::boolean AND conversation.customer_id = $1)
     ORDER BY conversation.last_message_at DESC, conversation.id DESC`,
    [account.id, isStaff],
  )

  return response.json({ chats: result.rows })
})

router.post('/', verifyOrigin, async (request, response) => {
  const account = await getAuthorizedAccount(request, response)
  if (!account) return
  if (account.role !== 'client') {
    return response.status(403).json({ error: 'Solo los clientes pueden iniciar una cotización.' })
  }

  const requestedItems = request.body?.items
  if (!Array.isArray(requestedItems) || requestedItems.length === 0 || requestedItems.length > 40) {
    return response.status(400).json({ error: 'Agrega productos válidos antes de solicitar la cotización.' })
  }

  const items = []
  const seenProductIds = new Set()
  for (const requestedItem of requestedItems) {
    const product = productsById.get(requestedItem?.id)
    const quantity = Number(requestedItem?.quantity)
    if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      return response.status(400).json({ error: 'La lista contiene un producto o una cantidad no válida.' })
    }
    if (seenProductIds.has(product.id)) {
      return response.status(400).json({ error: 'La lista contiene productos duplicados.' })
    }
    seenProductIds.add(product.id)
    items.push({ product, quantity })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const conversation = await client.query(
      `INSERT INTO chat_conversations (customer_id) VALUES ($1) RETURNING id`,
      [account.id],
    )
    const chatId = conversation.rows[0].id

    for (const { product, quantity } of items) {
      await client.query(
        `INSERT INTO chat_quote_items (chat_id, product_id, product_name, category_name, unit_price, quantity)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [chatId, product.id, product.name, product.category, product.price, quantity],
      )
    }

    await client.query(
      `INSERT INTO chat_messages (chat_id, sender_id, body)
       VALUES ($1, $2, $3)`,
      [chatId, account.id, 'Solicitud de cotización creada desde la galería.'],
    )
    await client.query('COMMIT')
    return response.status(201).json({ chatId })
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
})

router.get('/:chatId', verifyOrigin, async (request, response) => {
  const account = await getAuthorizedAccount(request, response)
  if (!account) return
  const chatId = parseId(request.params.chatId)
  if (!chatId) return response.status(400).json({ error: 'El identificador del chat no es válido.' })

  const conversation = await getAuthorizedChat(chatId, account, response)
  if (!conversation) return

  const [itemsResult, messagesResult] = await Promise.all([
    pool.query(
      `SELECT product_id, product_name, category_name, unit_price, quantity
       FROM chat_quote_items WHERE chat_id = $1 ORDER BY id ASC`,
      [chatId],
    ),
    pool.query(
      `SELECT message.id, message.sender_id, sender.name AS sender_name,
              sender.role AS sender_role, message.body,
              message.image_data IS NOT NULL AS has_image, message.created_at
       FROM chat_messages AS message
       LEFT JOIN customer_accounts AS sender ON sender.id = message.sender_id
       WHERE message.chat_id = $1 ORDER BY message.created_at ASC, message.id ASC`,
      [chatId],
    ),
  ])

  return response.json({
    chat: {
      id: conversation.id,
      status: conversation.status,
      createdAt: conversation.created_at,
      customerId: conversation.customer_id,
      customerName: conversation.customer_name,
      customerEmail: conversation.customer_email,
      items: itemsResult.rows,
      messages: messagesResult.rows.map((message) => ({
        id: message.id,
        senderId: message.sender_id,
        senderName: message.sender_name,
        senderRole: message.sender_role,
        body: message.body,
        imageUrl: message.has_image ? `/api/chats/messages/${message.id}/image` : null,
        createdAt: message.created_at,
      })),
    },
  })
})

router.post('/:chatId/messages', verifyOrigin, async (request, response) => {
  const account = await getAuthorizedAccount(request, response)
  if (!account) return
  const chatId = parseId(request.params.chatId)
  if (!chatId) return response.status(400).json({ error: 'El identificador del chat no es válido.' })

  const conversation = await getAuthorizedChat(chatId, account, response)
  if (!conversation) return
  if (conversation.status !== 'open') {
    return response.status(409).json({ error: 'Esta conversación está cerrada.' })
  }

  const body = typeof request.body?.body === 'string' ? request.body.body.trim() : ''
  const image = parseImage(request.body?.image)
  if (body.length > 2000) return response.status(400).json({ error: 'El mensaje supera los 2.000 caracteres.' })
  if (!image) return response.status(400).json({ error: 'La imagen no es válida o supera los 320 KB.' })
  if (!body && !image.image) return response.status(400).json({ error: 'Escribe un mensaje o adjunta una imagen.' })

  const result = await pool.query(
    `INSERT INTO chat_messages (chat_id, sender_id, body, image_data, image_mime)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, sender_id, body, created_at`,
    [chatId, account.id, body || null, image.image, image.mime],
  )
  await pool.query('UPDATE chat_conversations SET last_message_at = NOW() WHERE id = $1', [chatId])
  const message = result.rows[0]

  return response.status(201).json({
    message: {
      id: message.id,
      senderId: message.sender_id,
      senderName: account.name,
      senderRole: account.role,
      body: message.body,
      imageUrl: image.image ? `/api/chats/messages/${message.id}/image` : null,
      createdAt: message.created_at,
    },
  })
})

router.get('/messages/:messageId/image', verifyOrigin, async (request, response) => {
  const account = await getAuthorizedAccount(request, response)
  if (!account) return
  const messageId = parseId(request.params.messageId)
  if (!messageId) return response.status(400).json({ error: 'El identificador de imagen no es válido.' })

  const result = await pool.query(
    `SELECT message.image_data, message.image_mime
     FROM chat_messages AS message
     JOIN chat_conversations AS conversation ON conversation.id = message.chat_id
     WHERE message.id = $1 AND ($2::boolean OR conversation.customer_id = $3)`,
    [messageId, staffRoles.has(account.role), account.id],
  )
  const image = result.rows[0]
  if (!image?.image_data) return response.status(404).json({ error: 'No encontramos esta imagen.' })

  response.setHeader('Content-Type', image.image_mime)
  response.setHeader('Content-Length', image.image_data.length)
  response.setHeader('Cache-Control', 'private, no-store')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  return response.end(image.image_data)
})

router.post('/:chatId/close', verifyOrigin, async (request, response) => {
  const account = await getAuthorizedAccount(request, response)
  if (!account) return
  if (!staffRoles.has(account.role)) {
    return response.status(403).json({ error: 'Solo el equipo autorizado puede cerrar una conversación.' })
  }

  const chatId = parseId(request.params.chatId)
  if (!chatId) return response.status(400).json({ error: 'El identificador del chat no es válido.' })
  const result = await pool.query(
    `UPDATE chat_conversations SET status = 'closed', closed_at = NOW()
     WHERE id = $1 AND status = 'open' RETURNING id`,
    [chatId],
  )
  if (!result.rowCount) return response.status(404).json({ error: 'El chat ya está cerrado o no existe.' })
  return response.json({ status: 'closed' })
})

export default router