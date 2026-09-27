import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'
import { pool } from './db.js'
import authRouter from './auth.js'
import chatRouter from './chat.js'
import { isAllowedOrigin } from './security.js'

const app = express()
app.set('trust proxy', 1)

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'", 'https://static.cloudflareinsights.com', 'https://*.cloudflare.com'],
      'script-src-elem': ["'self'", "'unsafe-inline'", 'https://static.cloudflareinsights.com', 'https://*.cloudflare.com'],
      'connect-src': ["'self'", 'https://*.pages.dev', 'https://render-backend-test.oh-montajes-eventos.pages.dev', 'https://*.cloudflare.com'],
      'img-src': ["'self'", 'data:', 'https:'],
      'style-src': ["'self'", "'unsafe-inline'"],
      'font-src': ["'self'", 'data:', 'https:'],
    },
  },
}))
app.use(cors({
  origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
  credentials: true,
}))
app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Espera un momento y vuelve a probar.' },
}))
app.use('/api/chats', chatRouter)
app.use(express.json({ limit: '32kb' }))
app.use('/api/auth', authRouter)

app.get('/api/health', async (_request, response) => {
  try {
    await pool.query('SELECT 1')
    response.json({ status: 'ok', database: 'connected' })
  } catch {
    response.status(503).json({ status: 'error', database: 'unavailable' })
  }
})

export default app