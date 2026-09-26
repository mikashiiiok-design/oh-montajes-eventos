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

  await pool.query(`
    ALTER TABLE customer_accounts
    ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS banned_reason VARCHAR(250)
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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS customer_admin_audit (
      id BIGSERIAL PRIMARY KEY,
      actor_id BIGINT REFERENCES customer_accounts(id) ON DELETE SET NULL,
      target_id BIGINT NOT NULL REFERENCES customer_accounts(id) ON DELETE RESTRICT,
      action VARCHAR(32) NOT NULL CHECK (action IN ('role_changed', 'account_banned', 'account_restored')),
      previous_value VARCHAR(250),
      new_value VARCHAR(250),
      details VARCHAR(500),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS customer_admin_audit_created_at_idx
    ON customer_admin_audit (created_at DESC)
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS attendance_records (
      id BIGSERIAL PRIMARY KEY,
      account_id BIGINT NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
      attendance_date DATE NOT NULL,
      status VARCHAR(32) NOT NULL CHECK (status IN ('present', 'late', 'late_justified', 'absent')),
      notes VARCHAR(250),
      created_by BIGINT REFERENCES customer_accounts(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      record_hash CHAR(64) NOT NULL,
      UNIQUE (account_id, attendance_date)
    )
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS attendance_records_date_idx
    ON attendance_records (attendance_date DESC)
  `)
}

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error)
})