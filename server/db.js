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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_conversations (
      id BIGSERIAL PRIMARY KEY,
      customer_id BIGINT NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
      status VARCHAR(16) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      closed_at TIMESTAMPTZ
    )
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS chat_conversations_customer_idx
    ON chat_conversations (customer_id, last_message_at DESC)
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS chat_conversations_open_idx
    ON chat_conversations (last_message_at DESC) WHERE status = 'open'
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_quote_items (
      id BIGSERIAL PRIMARY KEY,
      chat_id BIGINT NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
      product_id VARCHAR(80) NOT NULL,
      product_name VARCHAR(160) NOT NULL,
      category_name VARCHAR(100) NOT NULL,
      unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
      quantity SMALLINT NOT NULL CHECK (quantity BETWEEN 1 AND 99)
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id BIGSERIAL PRIMARY KEY,
      chat_id BIGINT NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
      sender_id BIGINT REFERENCES customer_accounts(id) ON DELETE SET NULL,
      body VARCHAR(2000),
      image_data BYTEA,
      image_mime VARCHAR(32),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (body IS NOT NULL OR image_data IS NOT NULL)
    )
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS chat_messages_chat_idx
    ON chat_messages (chat_id, created_at, id)
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_typing_status (
      chat_id BIGINT NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
      account_id BIGINT NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (chat_id, account_id)
    )
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS chat_typing_status_updated_idx
    ON chat_typing_status (chat_id, updated_at DESC)
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_read_status (
      chat_id BIGINT NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
      reader_side VARCHAR(8) NOT NULL CHECK (reader_side IN ('client', 'staff')),
      last_read_message_id BIGINT NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
      PRIMARY KEY (chat_id, reader_side)
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_quote_versions (
      id BIGSERIAL PRIMARY KEY,
      chat_id BIGINT NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
      version INTEGER NOT NULL CHECK (version > 0),
      status VARCHAR(16) NOT NULL CHECK (status IN ('sent', 'accepted', 'superseded')),
      total_amount BIGINT NOT NULL CHECK (total_amount >= 0),
      currency CHAR(3) NOT NULL DEFAULT 'COP',
      terms VARCHAR(2000) NOT NULL DEFAULT '',
      valid_until DATE,
      created_by BIGINT NOT NULL REFERENCES customer_accounts(id) ON DELETE RESTRICT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      accepted_by BIGINT REFERENCES customer_accounts(id) ON DELETE SET NULL,
      accepted_at TIMESTAMPTZ,
      UNIQUE (chat_id, version)
    )
  `)

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS chat_quote_one_accepted_idx
    ON chat_quote_versions (chat_id) WHERE status = 'accepted'
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_quote_version_items (
      id BIGSERIAL PRIMARY KEY,
      quote_version_id BIGINT NOT NULL REFERENCES chat_quote_versions(id) ON DELETE CASCADE,
      product_id VARCHAR(80),
      product_name VARCHAR(160) NOT NULL,
      category_name VARCHAR(100) NOT NULL DEFAULT '',
      description VARCHAR(300) NOT NULL DEFAULT '',
      unit_price BIGINT NOT NULL CHECK (unit_price >= 0),
      quantity SMALLINT NOT NULL CHECK (quantity BETWEEN 1 AND 99),
      customizations JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(customizations) = 'object')
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id BIGSERIAL PRIMARY KEY,
      chat_id BIGINT NOT NULL REFERENCES chat_conversations(id) ON DELETE RESTRICT,
      quote_version_id BIGINT NOT NULL UNIQUE REFERENCES chat_quote_versions(id) ON DELETE RESTRICT,
      status VARCHAR(20) NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'scheduled', 'in_progress', 'completed', 'cancelled')),
      event_name VARCHAR(160) NOT NULL,
      venue VARCHAR(240) NOT NULL,
      setup_at TIMESTAMPTZ NOT NULL,
      event_at TIMESTAMPTZ NOT NULL,
      dismantle_at TIMESTAMPTZ NOT NULL,
      coordinator_id BIGINT NOT NULL REFERENCES customer_accounts(id) ON DELETE RESTRICT,
      created_by BIGINT NOT NULL REFERENCES customer_accounts(id) ON DELETE RESTRICT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (setup_at <= event_at AND event_at <= dismantle_at)
    )
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS orders_status_schedule_idx
    ON orders (status, setup_at)
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id BIGSERIAL PRIMARY KEY,
      order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      source_quote_item_id BIGINT REFERENCES chat_quote_version_items(id) ON DELETE SET NULL,
      product_id VARCHAR(80),
      product_name VARCHAR(160) NOT NULL,
      category_name VARCHAR(100) NOT NULL DEFAULT '',
      description VARCHAR(300) NOT NULL DEFAULT '',
      unit_price BIGINT NOT NULL CHECK (unit_price >= 0),
      quantity SMALLINT NOT NULL CHECK (quantity BETWEEN 1 AND 99),
      customizations JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(customizations) = 'object')
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS order_tasks (
      id BIGSERIAL PRIMARY KEY,
      order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      task_key VARCHAR(32) NOT NULL CHECK (task_key IN ('preparation', 'delivery', 'installation', 'dismantling', 'return_check')),
      label VARCHAR(120) NOT NULL,
      assigned_to BIGINT NOT NULL REFERENCES customer_accounts(id) ON DELETE RESTRICT,
      status VARCHAR(16) NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'completed', 'blocked')),
      updated_by BIGINT REFERENCES customer_accounts(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (order_id, task_key)
    )
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS order_tasks_assignee_idx
    ON order_tasks (assigned_to, status)
  `)
}

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error)
})