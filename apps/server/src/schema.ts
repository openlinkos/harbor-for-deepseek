import type { Sql } from 'postgres'

const INIT = `
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'member')),
  status text NOT NULL DEFAULT 'active',
  token_quota bigint NOT NULL DEFAULT 2000000,
  search_quota integer NOT NULL DEFAULT 100,
  page_quota integer NOT NULL DEFAULT 80,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);
CREATE TABLE IF NOT EXISTS user_counters (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  next_rev bigint NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS invite_codes (
  id uuid PRIMARY KEY,
  code text UNIQUE NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id),
  max_uses integer NOT NULL DEFAULT 1,
  used_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  revoked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS auth_sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text UNIQUE NOT NULL,
  csrf text NOT NULL,
  device_name text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY,
  label text NOT NULL,
  ciphertext bytea NOT NULL,
  nonce bytea NOT NULL,
  last4 text NOT NULL,
  priority integer NOT NULL DEFAULT 100,
  weight integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active',
  account_group text NOT NULL,
  last_balance_cny numeric,
  is_available boolean,
  last_checked_at timestamptz,
  last_used_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS balance_snapshots (
  id uuid PRIMARY KEY,
  api_key_id uuid NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  taken_at timestamptz NOT NULL DEFAULT now(),
  is_available boolean NOT NULL,
  total_cny numeric,
  granted_cny numeric,
  topped_up_cny numeric
);
CREATE TABLE IF NOT EXISTS conversations (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  title_source text NOT NULL DEFAULT 'default',
  model text NOT NULL DEFAULT 'deepseek-flash',
  thinking boolean NOT NULL DEFAULT true,
  search boolean NOT NULL DEFAULT false,
  read_link boolean NOT NULL DEFAULT false,
  effort text NOT NULL DEFAULT 'high',
  pinned boolean NOT NULL DEFAULT false,
  archived boolean NOT NULL DEFAULT false,
  active_leaf_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  rev bigint NOT NULL,
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS conversations_user_rev ON conversations (user_id, rev);
CREATE TABLE IF NOT EXISTS messages (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id text NOT NULL,
  parent_id text,
  role text NOT NULL,
  status text NOT NULL,
  blocks_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  usage_json jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  rev bigint NOT NULL,
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS messages_user_rev ON messages (user_id, rev);
CREATE INDEX IF NOT EXISTS messages_conversation ON messages (conversation_id);
CREATE TABLE IF NOT EXISTS tombstones (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity text NOT NULL,
  entity_id text NOT NULL,
  rev bigint NOT NULL,
  deleted_at timestamptz NOT NULL,
  PRIMARY KEY (user_id, entity, entity_id)
);
CREATE INDEX IF NOT EXISTS tombstones_user_rev ON tombstones (user_id, rev);
CREATE TABLE IF NOT EXISTS chat_runs (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id text NOT NULL,
  message_id text NOT NULL,
  api_key_id uuid,
  status text NOT NULL,
  last_seq integer NOT NULL DEFAULT 0,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE TABLE IF NOT EXISTS run_events (
  run_id uuid NOT NULL REFERENCES chat_runs(id) ON DELETE CASCADE,
  seq integer NOT NULL,
  payload jsonb NOT NULL,
  PRIMARY KEY (run_id, seq)
);
CREATE TABLE IF NOT EXISTS usage_events (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  api_key_id uuid,
  conversation_id text,
  request_id text,
  taken_at timestamptz NOT NULL DEFAULT now(),
  is_peak boolean NOT NULL,
  model text,
  input_tokens integer NOT NULL DEFAULT 0,
  cache_read_input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  thinking_tokens integer NOT NULL DEFAULT 0,
  tool_search integer NOT NULL DEFAULT 0,
  tool_fetch integer NOT NULL DEFAULT 0,
  tool_image_search integer NOT NULL DEFAULT 0,
  web_search_requests integer NOT NULL DEFAULT 0,
  web_fetch_requests integer NOT NULL DEFAULT 0,
  file_pages integer NOT NULL DEFAULT 0,
  estimated_cny numeric NOT NULL DEFAULT 0,
  http_status integer,
  error text
);
CREATE INDEX IF NOT EXISTS usage_events_user_time ON usage_events (user_id, taken_at);
CREATE TABLE IF NOT EXISTS usage_daily (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day date NOT NULL,
  api_key_id uuid NOT NULL,
  input_tokens bigint NOT NULL DEFAULT 0,
  cache_read_input_tokens bigint NOT NULL DEFAULT 0,
  output_tokens bigint NOT NULL DEFAULT 0,
  tool_search integer NOT NULL DEFAULT 0,
  tool_fetch integer NOT NULL DEFAULT 0,
  tool_image_search integer NOT NULL DEFAULT 0,
  file_pages integer NOT NULL DEFAULT 0,
  estimated_cny numeric NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day, api_key_id)
);
CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY,
  api_key_id uuid REFERENCES api_keys(id) ON DELETE CASCADE,
  kind text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE TABLE IF NOT EXISTS files (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_file_id text NOT NULL,
  filename text NOT NULL,
  purpose text,
  bytes integer,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL
);
INSERT INTO app_settings (key, value) VALUES ('low_balance_cny', '50'::jsonb) ON CONFLICT (key) DO NOTHING;
INSERT INTO app_settings (key, value) VALUES (
  'cors_origins',
  '["capacitor://localhost","https://localhost","http://localhost"]'::jsonb
) ON CONFLICT (key) DO NOTHING;
`

const INVITE_EXPIRY = `
UPDATE invite_codes
SET expires_at = created_at + interval '7 days'
WHERE expires_at IS NULL;
CREATE INDEX IF NOT EXISTS invite_codes_expires_at ON invite_codes (expires_at);
`

export const MIGRATIONS: ReadonlyArray<{ id: string; sql: string }> = [
  { id: '001_init', sql: INIT },
  { id: '002_invite_expiry', sql: INVITE_EXPIRY },
]

const LOCK_KEY = 764521

export const applyMigrations = async (sql: Sql): Promise<void> => {
  await sql`select pg_advisory_lock(${LOCK_KEY})`
  try {
    await sql.unsafe(`
      create table if not exists schema_migrations (
        id text primary key,
        applied_at timestamptz not null default now()
      )
    `)
    for (const migration of MIGRATIONS) {
      const done = await sql<{ id: string }[]>`select id from schema_migrations where id = ${migration.id}`
      if (done.length > 0) {
        continue
      }
      await sql.begin(async (tx) => {
        await tx.unsafe(migration.sql)
        await tx`insert into schema_migrations (id) values (${migration.id})`
      })
    }
  } finally {
    await sql`select pg_advisory_unlock(${LOCK_KEY})`
  }
}
