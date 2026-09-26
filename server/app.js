import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { pool } from './db.js'

const app = express()
const allowedOrigins = new Set(
  (process.env.WEB_ORIGINS ?? process.env.WEB_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
)

app.use(helmet())
app.use(cors({
  origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)),
  credentials: true,
}))
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', async (_request, response) => {
  try {
    await pool.query('SELECT 1')
    response.json({ status: 'ok', database: 'connected' })
  } catch {
    response.status(503).json({ status: 'error', database: 'unavailable' })
  }
})

export default app