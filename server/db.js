import pg from 'pg'
import { accountRoleIds, defaultAccountRole } from '../shared/roles.js'

const { Pool } = pg

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS customer_accounts (
      id BIGSERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(254) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role VARCHAR(32) NOT NULL DEFAULT '${defaultAccountRole}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await pool.query(`
    ALTER TABLE customer_accounts
    ADD COLUMN IF NOT EXISTS role VARCHAR(32) NOT NULL DEFAULT '${defaultAccountRole}'
  `)

  const allowedRoles = accountRoleIds.map((role) => `'${role}'`).join(', ')
  await pool.query('ALTER TABLE customer_accounts DROP CONSTRAINT IF EXISTS customer_accounts_role_check')
  await pool.query(`
    ALTER TABLE customer_accounts
    ADD CONSTRAINT customer_accounts_role_check CHECK (role IN (${allowedRoles}))
  `)

  const ownerAssignment = await pool.query(
    'UPDATE customer_accounts SET role = $1 WHERE id = $2 RETURNING id',
    ['owner', 1],
  )
  if (ownerAssignment.rowCount === 0) {
    console.warn('Owner role migration skipped: customer account OH-000001 was not found.')
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS customer_sessions (
      token_hash CHAR(64) PRIMARY KEY,
      account_id BIGINT NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS customer_sessions_expires_at_idx
    ON customer_sessions (expires_at)
  `)
}

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error)
})