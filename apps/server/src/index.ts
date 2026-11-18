import { serve } from '@hono/node-server'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { createServer } from './app.js'
import { log } from './log.js'

const dataDir = process.env.DATA_DIR ?? '/data'
const port = Number(process.env.PORT ?? '8080')

const masterKey = async (): Promise<Buffer> => {
  if (process.env.KEY_ENCRYPTION_SECRET) {
    const raw = process.env.KEY_ENCRYPTION_SECRET
    const buffer = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw)
    if (buffer.length !== 32) {
      throw new Error('KEY_ENCRYPTION_SECRET must be 32 bytes or 64 hex characters')
    }
    return buffer
  }
  await mkdir(dataDir, { recursive: true })
  const path = `${dataDir}/master.key`
  try {
    const existing = await readFile(path)
    if (existing.length === 32) {
      return existing
    }
  } catch {
    // Create it below.
  }
  const created = Buffer.from(crypto.getRandomValues(new Uint8Array(32)))
  await writeFile(path, created, { mode: 0o600 })
  return created
}

const databaseUrl = async (): Promise<string> => {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL
  }
  const path = `${dataDir}/db-password`
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const password = (await readFile(path, 'utf8')).trim()
      const host = process.env.DB_HOST ?? 'db'
      return `postgres://harbor:${encodeURIComponent(password)}@${host}:5432/harbor`
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }
  throw new Error('database password was not ready')
}

const main = async () => {
  const server = await createServer({
    databaseUrl: await databaseUrl(),
    masterKey: await masterKey(),
    upstream: process.env.DEEPSEEK_API_ORIGIN,
    staticDir: process.env.STATIC_DIR,
    trustProxy: process.env.TRUST_PROXY === '1',
  })
  if (process.env.E2E_RESET === '1') {
    await server.sql.unsafe(`
      truncate table
        run_events, chat_runs, usage_events, usage_daily, alerts, balance_snapshots,
        messages, tombstones, conversations, files, auth_sessions, invite_codes,
        api_keys, user_counters, users
      restart identity cascade
    `)
  }
  serve({ fetch: server.app.fetch, port }, () => {
    log('info', 'listening', { port })
  })
}

void main()
