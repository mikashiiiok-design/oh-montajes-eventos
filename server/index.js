import 'dotenv/config'
import app from './app.js'
import { pool } from './db.js'

const port = Number(process.env.PORT ?? 3001)

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be configured before starting the API')
}

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`API listening on http://localhost:${port}`)
})

const shutdown = () => {
  server.close(async () => {
    await pool.end()
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)