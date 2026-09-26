import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto'
import { promisify } from 'node:util'
import express from 'express'
import { rateLimit } from 'express-rate-limit'
import { pool } from './db.js'
import { isAllowedOrigin } from './security.js'

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

router.use((_request, response, next) => {
  response.setHeader('Cache-Control', 'no-store')
  next()
})

function verifyOrigin(request, response, next) {
  const origin = request.get('origin')
  if (!origin || !isAllowedOrigin(origin)) {
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
  return { id: account.id, name: account.name, email: account.email }
}

router.post('/register', verifyOrigin, authRateLimit, async (request, response) => {
  const name = typeof request.body.name === 'string' ? request.body.name.trim() : ''
  const email = typeof request.body.email === 'string' ? request.body.email.trim().toLowerCase() : ''
  const password = typeof request.body.password === 'string' ? request.body.password : ''

  if (name.length < 2 || name.length > 100) {
    return response.status(400).json({ error: 'Escribe tu nombre (de 2 a 100 caracteres).' })
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
       RETURNING id, name, email`,
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
    `SELECT id, name, email, password_hash
     FROM customer_accounts
     WHERE email = $1`,
    [email],
  )
  const account = result.rows[0]

  if (!account || !(await verifyPassword(password, account.password_hash))) {
    return response.status(401).json({ error: 'Correo o contraseña incorrectos.' })
  }

  await createSession(account.id, response)
  return response.json({ account: publicAccount(account) })
})

router.get('/me', async (request, response) => {
  const token = getSessionToken(request)
  if (!token) return response.json({ account: null })

  const result = await pool.query(
    `SELECT account.id, account.name, account.email
     FROM customer_sessions AS session
     JOIN customer_accounts AS account ON account.id = session.account_id
     WHERE session.token_hash = $1 AND session.expires_at > NOW()`,
    [hashToken(token)],
  )

  if (!result.rows[0]) {
    clearSessionCookie(response)
    return response.json({ account: null })
  }

  return response.json({ account: publicAccount(result.rows[0]) })
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