import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto'
import { promisify } from 'node:util'
import express from 'express'
import { rateLimit } from 'express-rate-limit'
import { pool } from './db.js'
import { isAllowedHost, isAllowedOrigin } from './security.js'
import { accountRoleById, defaultAccountRole } from '../shared/roles.js'

const router = express.Router()
const scrypt = promisify(scryptCallback)
const cookieName = 'oh_session'
const sessionDurationSeconds = 60 * 60 * 24 * 7
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera unos minutos y vuelve a probar.' },
})
const adminRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas consultas administrativas. Espera un momento.' },
})
const ownerManagementLockId = 1_993_004
const attendanceAllowedRoles = new Set(['owner', 'accountant', 'warehouse_manager', 'secretary'])
const attendanceStatusValues = new Set(['present', 'late', 'late_justified', 'absent'])

router.use((_request, response, next) => {
  response.setHeader('Cache-Control', 'no-store')
  next()
})

export function verifyOrigin(request, response, next) {
  const origin = request.get('origin')
  const host = request.get('host') ?? request.get('x-forwarded-host') ?? ''

  if (origin && !isAllowedOrigin(origin)) {
    return response.status(403).json({ error: 'Origen de solicitud no permitido.' })
  }

  if (!origin && host && isAllowedHost(host)) {
    return next()
  }

  if (!origin) {
    return response.status(403).json({ error: 'Origen de solicitud no permitido.' })
  }

  return next()
}

function getSessionToken(request) {
  const cookies = request.headers.cookie?.split(';') ?? []
  const sessionCookie = cookies.find((cookie) => cookie.trim().startsWith(`${cookieName}=`))
  return sessionCookie?.trim().slice(cookieName.length + 1) ?? null
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

function setSessionCookie(response, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  response.append(
    'Set-Cookie',
    `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sessionDurationSeconds}${secure}`,
  )
}

function clearSessionCookie(response) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  response.append(
    'Set-Cookie',
    `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
  )
}

async function hashPassword(password) {
  const salt = randomBytes(16)
  const derivedKey = await scrypt(password, salt, 64)
  return `${salt.toString('base64url')}:${derivedKey.toString('base64url')}`
}

async function verifyPassword(password, storedHash) {
  const [saltValue, keyValue] = storedHash.split(':')
  if (!saltValue || !keyValue) return false

  const expectedKey = Buffer.from(keyValue, 'base64url')
  const actualKey = await scrypt(password, Buffer.from(saltValue, 'base64url'), expectedKey.length)
  return timingSafeEqual(expectedKey, actualKey)
}

async function createSession(accountId, response) {
  const token = randomBytes(32).toString('base64url')
  await pool.query(
    `INSERT INTO customer_sessions (token_hash, account_id, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '7 days')`,
    [hashToken(token), accountId],
  )
  setSessionCookie(response, token)
}

function publicAccount(account) {
  const role = accountRoleById[account.role] ? account.role : defaultAccountRole
  return { id: account.id, name: account.name, email: account.email, role }
}

function adminAccountView(account) {
  return {
    ...publicAccount(account),
    isBanned: Boolean(account.is_banned),
    bannedAt: account.banned_at,
    bannedReason: account.banned_reason,
    createdAt: account.created_at,
  }
}

async function resolveSessionAccount(request, response) {
  const token = getSessionToken(request)
  if (!token) return null

  const result = await pool.query(
    `SELECT account.id, account.name, account.email, account.role, account.is_banned
     FROM customer_sessions AS session
     JOIN customer_accounts AS account ON account.id = session.account_id
     WHERE session.token_hash = $1 AND session.expires_at > NOW()`,
    [hashToken(token)],
  )
  const account = result.rows[0]

  if (!account || account.is_banned) {
    await pool.query('DELETE FROM customer_sessions WHERE token_hash = $1', [hashToken(token)])
    clearSessionCookie(response)
    return null
  }

  return account
}

async function requireOwner(request, response, next) {
  const account = await resolveSessionAccount(request, response)
  if (!account) return response.status(401).json({ error: 'Inicia sesión para continuar.' })
  if (account.role !== 'owner') {
    return response.status(403).json({ error: 'Esta sección es exclusiva para Dueño.' })
  }

  request.adminActor = account
  return next()
}

function createAttendanceHash({ accountId, attendanceDate, status, notes, createdBy }) {
  return createHash('sha256').update(`${accountId}|${attendanceDate}|${status}|${notes ?? ''}|${createdBy ?? ''}`).digest('hex')
}

function parseAccountId(value) {
  if (!/^\d{1,15}$/.test(value ?? '')) return null
  const accountId = Number(value)
  return Number.isSafeInteger(accountId) && accountId > 0 ? accountId : null
}

router.get('/attendance/workers', verifyOrigin, async (request, response) => {
  const account = await resolveSessionAccount(request, response)
  if (!account || !attendanceAllowedRoles.has(account.role)) {
    return response.status(403).json({ error: 'No tienes permiso para acceder a este panel.' })
  }

  const roles = [...attendanceAllowedRoles].filter((role) => role !== 'owner')
  const result = await pool.query(
    `SELECT id, name, email, role
     FROM customer_accounts
     WHERE role = ANY($1)
     ORDER BY name ASC`,
    [roles],
  )

  return response.json({ workers: result.rows })
})

router.get('/attendance', verifyOrigin, async (request, response) => {
  const account = await resolveSessionAccount(request, response)
  if (!account || !attendanceAllowedRoles.has(account.role)) {
    return response.status(403).json({ error: 'No tienes permiso para acceder a este panel.' })
  }

  const requestedDate = typeof request.query.date === 'string' ? request.query.date : new Date().toISOString().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
    return response.status(400).json({ error: 'La fecha no es válida.' })
  }

  const parsedDate = new Date(`${requestedDate}T12:00:00`)
  if (Number.isNaN(parsedDate.getTime())) {
    return response.status(400).json({ error: 'La fecha no es válida.' })
  }

  const roles = [...attendanceAllowedRoles].filter((role) => role !== 'owner')
  const result = await pool.query(
    `SELECT ca.id AS account_id, ca.name, ca.role, ar.status, ar.notes, ar.record_hash
     FROM customer_accounts AS ca
     LEFT JOIN attendance_records AS ar
       ON ar.account_id = ca.id AND ar.attendance_date = $1
     WHERE ca.role = ANY($2)
     ORDER BY ca.name ASC`,
    [requestedDate, roles],
  )

  const records = result.rows.map((row) => ({
    accountId: row.account_id,
    name: row.name,
    role: row.role,
    status: row.status ?? 'present',
    notes: row.notes,
    recordHash: row.record_hash,
  }))

  return response.json({ date: requestedDate, records })
})

router.post('/attendance', verifyOrigin, async (request, response) => {
  const account = await resolveSessionAccount(request, response)
  if (!account || !attendanceAllowedRoles.has(account.role)) {
    return response.status(403).json({ error: 'No tienes permiso para guardar asistencia.' })
  }

  const attendanceDate = typeof request.body.date === 'string' ? request.body.date : ''
  const entries = Array.isArray(request.body.entries) ? request.body.entries : []

  if (!/^\d{4}-\d{2}-\d{2}$/.test(attendanceDate)) {
    return response.status(400).json({ error: 'La fecha de asistencia no es válida.' })
  }

  if (entries.length === 0) {
    return response.status(400).json({ error: 'Debes enviar al menos un registro.' })
  }

  const roles = [...attendanceAllowedRoles].filter((role) => role !== 'owner')
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const savedRecords = []
    const seenAccountIds = new Set()

    for (const entry of entries) {
      const accountId = parseAccountId(entry?.accountId)
      const status = typeof entry?.status === 'string' ? entry.status : ''
      const notes = typeof entry?.notes === 'string' ? entry.notes.trim().slice(0, 250) : ''

      if (!accountId || !attendanceStatusValues.has(status)) {
        await client.query('ROLLBACK')
        return response.status(400).json({ error: 'Hay un registro de asistencia con datos no válidos.' })
      }

      if (seenAccountIds.has(accountId)) {
        await client.query('ROLLBACK')
        return response.status(400).json({ error: 'Hay trabajadores duplicados en el mismo registro.' })
      }
      seenAccountIds.add(accountId)

      const target = await client.query(
        `SELECT id, name, role FROM customer_accounts WHERE id = $1 AND role = ANY($2)`,
        [accountId, roles],
      )
      if (target.rowCount === 0) {
        await client.query('ROLLBACK')
        return response.status(400).json({ error: 'Solo se pueden registrar trabajadores autorizados.' })
      }

      const existing = await client.query(
        `SELECT id FROM attendance_records WHERE account_id = $1 AND attendance_date = $2`,
        [accountId, attendanceDate],
      )
      if (existing.rowCount > 0) {
        await client.query('ROLLBACK')
        return response.status(409).json({ error: `El registro para ${target.rows[0].name} ya existe en esta fecha.` })
      }

      const recordHash = createAttendanceHash({
        accountId,
        attendanceDate,
        status,
        notes,
        createdBy: account.id,
      })

      const result = await client.query(
        `INSERT INTO attendance_records (account_id, attendance_date, status, notes, created_by, record_hash)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, account_id, status, notes, record_hash, created_at`,
        [accountId, attendanceDate, status, notes || null, account.id, recordHash],
      )

      savedRecords.push({
        accountId: result.rows[0].account_id,
        status: result.rows[0].status,
        notes: result.rows[0].notes,
        recordHash: result.rows[0].record_hash,
      })
    }

    await client.query('COMMIT')
    return response.status(201).json({ date: attendanceDate, records: savedRecords })
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
})

router.post('/register', verifyOrigin, authRateLimit, async (request, response) => {
  const name = typeof request.body.name === 'string' ? request.body.name.trim() : ''
  const email = typeof request.body.email === 'string' ? request.body.email.trim().toLowerCase() : ''
  const password = typeof request.body.password === 'string' ? request.body.password : ''
  const acceptTerms = request.body.acceptTerms === true

  if (name.length < 2 || name.length > 100) {
    return response.status(400).json({ error: 'Escribe tu nombre (de 2 a 100 caracteres).' })
  }
  if (!acceptTerms) {
    return response.status(400).json({ error: 'Debes aceptar los Términos y condiciones y los Términos de uso para registrarte.' })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return response.status(400).json({ error: 'Escribe un correo electrónico válido.' })
  }
  if (password.length < 12 || password.length > 128) {
    return response.status(400).json({ error: 'La contraseña debe tener entre 12 y 128 caracteres.' })
  }

  try {
    const passwordHash = await hashPassword(password)
    const result = await pool.query(
      `INSERT INTO customer_accounts (name, email, password_hash)
       VALUES ($1, $2, $3)
      RETURNING id, name, email, role`,
      [name, email, passwordHash],
    )
    const account = result.rows[0]
    await createSession(account.id, response)
    return response.status(201).json({ account: publicAccount(account) })
  } catch (error) {
    if (error.code === '23505') {
      return response.status(409).json({ error: 'Ya existe una cuenta con ese correo.' })
    }
    throw error
  }
})

router.post('/login', verifyOrigin, authRateLimit, async (request, response) => {
  const email = typeof request.body.email === 'string' ? request.body.email.trim().toLowerCase() : ''
  const password = typeof request.body.password === 'string' ? request.body.password : ''

  if (!email || !password) {
    return response.status(400).json({ error: 'Escribe tu correo y contraseña.' })
  }

  const result = await pool.query(
    `SELECT id, name, email, password_hash, role
            , is_banned
     FROM customer_accounts
     WHERE email = $1`,
    [email],
  )
  const account = result.rows[0]

  if (!account || !(await verifyPassword(password, account.password_hash))) {
    return response.status(401).json({ error: 'Correo o contraseña incorrectos.' })
  }
  if (account.is_banned) {
    return response.status(403).json({ error: 'La cuenta está suspendida. Contacta con el equipo.' })
  }

  await createSession(account.id, response)
  return response.json({ account: publicAccount(account) })
})

router.get('/me', async (request, response) => {
  const token = getSessionToken(request)
  if (!token) return response.json({ account: null })

  const result = await pool.query(
    `SELECT account.id, account.name, account.email, account.role, account.is_banned
     FROM customer_sessions AS session
     JOIN customer_accounts AS account ON account.id = session.account_id
     WHERE session.token_hash = $1 AND session.expires_at > NOW()`,
    [hashToken(token)],
  )

  if (!result.rows[0] || result.rows[0].is_banned) {
    await pool.query('DELETE FROM customer_sessions WHERE token_hash = $1', [hashToken(token)])
    clearSessionCookie(response)
    return response.json({ account: null })
  }

  return response.json({ account: publicAccount(result.rows[0]) })
})

router.get('/admin/accounts', requireOwner, adminRateLimit, async (request, response) => {
  const search = typeof request.query.search === 'string' ? request.query.search.trim().slice(0, 100) : ''
  const clientIdMatch = /^OH-(\d{1,15})$/i.exec(search)
  const exactId = clientIdMatch?.[1] ?? (/^\d{1,15}$/.test(search) ? search : null)
  const result = await pool.query(
    `SELECT id, name, email, role, is_banned, banned_at, banned_reason, created_at
     FROM customer_accounts
     WHERE ($1::bigint IS NOT NULL AND id = $1::bigint)
        OR POSITION($2 IN LOWER(name)) > 0
        OR POSITION($2 IN LOWER(email)) > 0
     ORDER BY id ASC
     LIMIT 50`,
    [exactId, search.toLowerCase()],
  )

  return response.json({ accounts: result.rows.map(adminAccountView) })
})

router.get('/admin/audit', requireOwner, adminRateLimit, async (request, response) => {
  const parsedLimit = Number.parseInt(request.query.limit, 10)
  const limit = Number.isInteger(parsedLimit) ? Math.max(1, Math.min(30, parsedLimit)) : 15
  const result = await pool.query(
    `SELECT audit.id, audit.action, audit.previous_value, audit.new_value,
            audit.details, audit.created_at,
            actor.name AS actor_name, target.name AS target_name, target.id AS target_id
     FROM customer_admin_audit AS audit
     LEFT JOIN customer_accounts AS actor ON actor.id = audit.actor_id
     JOIN customer_accounts AS target ON target.id = audit.target_id
     ORDER BY audit.created_at DESC, audit.id DESC
     LIMIT $1`,
    [limit],
  )

  return response.json({ events: result.rows })
})

router.post('/admin/accounts/:id/role', verifyOrigin, requireOwner, adminRateLimit, async (request, response) => {
  const targetId = parseAccountId(request.params.id)
  const nextRole = typeof request.body.role === 'string' ? request.body.role : ''
  if (!targetId) return response.status(400).json({ error: 'El ID de cuenta no es válido.' })
  if (!accountRoleById[nextRole]) return response.status(400).json({ error: 'El rol seleccionado no es válido.' })

  const client = await pool.connect()
  let transactionOpen = false
  try {
    await client.query('BEGIN')
    transactionOpen = true
    await client.query('SELECT pg_advisory_xact_lock($1)', [ownerManagementLockId])
    const targetResult = await client.query(
      'SELECT id, name, email, role, is_banned, banned_at, banned_reason, created_at FROM customer_accounts WHERE id = $1 FOR UPDATE',
      [targetId],
    )
    const target = targetResult.rows[0]
    if (!target) {
      await client.query('ROLLBACK')
      transactionOpen = false
      return response.status(404).json({ error: 'No se encontró esa cuenta.' })
    }
    if (String(target.id) === '1' && nextRole !== 'owner') {
      await client.query('ROLLBACK')
      transactionOpen = false
      return response.status(409).json({ error: 'La cuenta OH-000001 conserva el rol de Dueño.' })
    }
    if (String(target.id) === String(request.adminActor.id) && nextRole !== 'owner') {
      await client.query('ROLLBACK')
      transactionOpen = false
      return response.status(409).json({ error: 'No puedes quitarte tu propio rol de Dueño.' })
    }
    if (target.role === 'owner' && nextRole !== 'owner') {
      const owners = await client.query("SELECT COUNT(*)::int AS count FROM customer_accounts WHERE role = 'owner' AND is_banned = FALSE")
      if (owners.rows[0].count <= 1) {
        await client.query('ROLLBACK')
        transactionOpen = false
        return response.status(409).json({ error: 'No se puede quitar el último rol de Dueño.' })
      }
    }
    if (target.role === nextRole) {
      await client.query('COMMIT')
      transactionOpen = false
      return response.json({ account: adminAccountView(target) })
    }

    const updatedResult = await client.query(
      'UPDATE customer_accounts SET role = $1 WHERE id = $2 RETURNING id, name, email, role, is_banned, banned_at, banned_reason, created_at',
      [nextRole, targetId],
    )
    await client.query(
      `INSERT INTO customer_admin_audit (actor_id, target_id, action, previous_value, new_value)
       VALUES ($1, $2, 'role_changed', $3, $4)`,
      [request.adminActor.id, targetId, target.role, nextRole],
    )
    await client.query('COMMIT')
    transactionOpen = false
    return response.json({ account: adminAccountView(updatedResult.rows[0]) })
  } catch (error) {
    if (transactionOpen) await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
})

router.post('/admin/accounts/:id/ban', verifyOrigin, requireOwner, adminRateLimit, async (request, response) => {
  const targetId = parseAccountId(request.params.id)
  const { isBanned } = request.body
  const reason = typeof request.body.reason === 'string' ? request.body.reason.trim() : ''
  if (!targetId) return response.status(400).json({ error: 'El ID de cuenta no es válido.' })
  if (typeof isBanned !== 'boolean') return response.status(400).json({ error: 'Indica si la cuenta se suspende o reactiva.' })
  if (isBanned && (reason.length < 5 || reason.length > 250)) {
    return response.status(400).json({ error: 'Escribe un motivo de suspensión entre 5 y 250 caracteres.' })
  }

  const client = await pool.connect()
  let transactionOpen = false
  try {
    await client.query('BEGIN')
    transactionOpen = true
    await client.query('SELECT pg_advisory_xact_lock($1)', [ownerManagementLockId])
    const targetResult = await client.query(
      'SELECT id, name, email, role, is_banned, banned_at, banned_reason, created_at FROM customer_accounts WHERE id = $1 FOR UPDATE',
      [targetId],
    )
    const target = targetResult.rows[0]
    if (!target) {
      await client.query('ROLLBACK')
      transactionOpen = false
      return response.status(404).json({ error: 'No se encontró esa cuenta.' })
    }
    if (isBanned && target.role === 'owner') {
      await client.query('ROLLBACK')
      transactionOpen = false
      return response.status(409).json({ error: 'No se puede suspender una cuenta con rol de Dueño.' })
    }
    if (Boolean(target.is_banned) === isBanned) {
      await client.query('COMMIT')
      transactionOpen = false
      return response.json({ account: adminAccountView(target) })
    }

    const updatedResult = await client.query(
      `UPDATE customer_accounts
       SET is_banned = $1, banned_at = CASE WHEN $1 THEN NOW() ELSE NULL END,
           banned_reason = CASE WHEN $1 THEN $2 ELSE NULL END
       WHERE id = $3
       RETURNING id, name, email, role, is_banned, banned_at, banned_reason, created_at`,
      [isBanned, isBanned ? reason : null, targetId],
    )
    if (isBanned) {
      await client.query('DELETE FROM customer_sessions WHERE account_id = $1', [targetId])
    }
    await client.query(
      `INSERT INTO customer_admin_audit (actor_id, target_id, action, previous_value, new_value, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [request.adminActor.id, targetId, isBanned ? 'account_banned' : 'account_restored', String(target.is_banned), String(isBanned), reason || null],
    )
    await client.query('COMMIT')
    transactionOpen = false
    return response.json({ account: adminAccountView(updatedResult.rows[0]) })
  } catch (error) {
    if (transactionOpen) await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
})

router.post('/logout', verifyOrigin, async (request, response) => {
  const token = getSessionToken(request)
  if (token) {
    await pool.query('DELETE FROM customer_sessions WHERE token_hash = $1', [hashToken(token)])
  }
  clearSessionCookie(response)
  return response.status(204).end()
})

export default router