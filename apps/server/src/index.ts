import { serve } from '@hono/node-server'
import { createServer } from './app.js'
import { readEnv } from './env.js'
import { log, setLogLevel } from './log.js'

process.on('uncaughtException', (error) => {
  log('error', 'uncaught exception', { name: error instanceof Error ? error.name : 'error' })
})
process.on('unhandledRejection', (reason) => {
  log('error', 'unhandled rejection', { name: reason instanceof Error ? reason.name : 'error' })
})

const startupMessage = (error: unknown): string => {
  if (!(error instanceof Error)) {
    return 'startup failed'
  }
  if (/^(KEY_|DATABASE_|ADMIN_|BOOTSTRAP_|CORS_|DEEPSEEK_|INVITE_|PORT |COOKIE_|LOG_)/.test(error.message)) {
    return error.message
  }
  if (/:\/\//.test(error.message)) {
    return 'startup failed'
  }
  return error.message
}

const main = async () => {
  const config = readEnv(process.env)
  setLogLevel(config.logLevel)
  const server = await createServer({
    databaseUrl: config.databaseUrl,
    masterKey: config.masterKey,
    upstream: config.upstream,
    staticDir: config.staticDir,
    trustProxy: config.trustProxy,
    hsts: config.hsts,
    cookieSecure: config.cookieSecure,
    corsOrigins: config.corsOrigins,
    bootstrapToken: config.bootstrapToken,
    bootstrapAdmin: config.bootstrapAdmin,
    allowOpenSetup: config.allowOpenSetup,
    inviteTtlHours: config.inviteTtlHours,
  })
  if (config.e2eReset) {
    await server.sql.unsafe(`
      truncate table
        run_events, chat_runs, usage_events, usage_daily, alerts, balance_snapshots,
        messages, tombstones, conversations, files, auth_sessions, invite_codes,
        api_keys, user_counters, users
      restart identity cascade
    `)
  }
  const admins = await server.sql`select id from users where role = 'admin' limit 1`
  if (admins.length === 0 && !config.allowOpenSetup && !config.bootstrapToken) {
    log('error', 'no admin bootstrap is configured')
  }
  let closing = false
  const listener = serve({ fetch: server.app.fetch, port: config.port }, () => {
    log('info', 'listening', { port: config.port })
  })
  const shutdown = (signal: string) => {
    if (closing) {
      return
    }
    closing = true
    log('info', 'shutting down', { signal })
    listener.close(() => {
      void server.close().finally(() => process.exit(0))
    })
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

void main().catch((error: unknown) => {
  log('error', startupMessage(error))
  process.exit(1)
})
