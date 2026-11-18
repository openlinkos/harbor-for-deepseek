export type BootstrapAdmin = {
  username: string
  password: string
}

export type ServerEnv = {
  port: number
  databaseUrl: string
  masterKey: Buffer
  upstream?: string
  staticDir?: string
  trustProxy: boolean
  hsts: boolean
  cookieSecure?: boolean
  corsOrigins?: string[]
  bootstrapToken?: string
  bootstrapAdmin?: BootstrapAdmin
  allowOpenSetup: boolean
  inviteTtlHours: number
  logLevel: string
  e2eReset: boolean
}

const USERNAME = /^[a-zA-Z0-9_-]{3,32}$/

export const parseMasterKey = (raw: string | undefined): Buffer => {
  if (!raw) {
    throw new Error('KEY_ENCRYPTION_SECRET is required (32 bytes, or 64 hex characters)')
  }
  const buffer = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw)
  if (buffer.length !== 32) {
    throw new Error('KEY_ENCRYPTION_SECRET must be 32 bytes or 64 hex characters')
  }
  return buffer
}

export const parseCorsOrigins = (raw: string | undefined): string[] | undefined => {
  if (!raw || !raw.trim()) {
    return undefined
  }
  const origins = raw.split(',').map((item) => item.trim()).filter(Boolean)
  if (origins.some((item) => item === '*' || /\s/.test(item))) {
    throw new Error('CORS_ORIGINS must be a comma-separated list of explicit origins')
  }
  for (const origin of origins) {
    if (origin === 'capacitor://localhost' || origin === 'ionic://localhost') {
      continue
    }
    let url: URL
    try {
      url = new URL(origin)
    } catch {
      throw new Error('CORS_ORIGINS contains a value that is not an origin')
    }
    if (url.origin !== origin || url.username || url.password) {
      throw new Error('CORS_ORIGINS entries must be origins without a path, query, or credentials')
    }
  }
  return origins
}

const parseUpstream = (raw: string | undefined): string | undefined => {
  if (!raw || !raw.trim()) {
    return undefined
  }
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error('DEEPSEEK_API_ORIGIN must be an http or https origin')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('DEEPSEEK_API_ORIGIN must be an http or https origin')
  }
  if (url.username || url.password) {
    throw new Error('DEEPSEEK_API_ORIGIN must not include credentials')
  }
  return url.origin
}

const parseHours = (raw: string | undefined): number => {
  if (!raw || !raw.trim()) {
    return 168
  }
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 1 || value > 24 * 30) {
    throw new Error('INVITE_TTL_HOURS must be an integer from 1 to 720')
  }
  return value
}

export const readEnv = (env: NodeJS.ProcessEnv): ServerEnv => {
  const databaseUrl = env.DATABASE_URL?.trim()
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required')
  }
  if (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://')) {
    // Accepted. The driver reports a bad URL later if the rest is unusable.
  } else {
    throw new Error('DATABASE_URL must start with postgres:// or postgresql://')
  }
  const username = env.ADMIN_USERNAME?.trim() ?? ''
  const password = env.ADMIN_PASSWORD ?? ''
  if ((username && !password) || (!username && password)) {
    throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD must be set together')
  }
  let bootstrapAdmin: BootstrapAdmin | undefined
  if (username || password) {
    if (!USERNAME.test(username) || password.length < 8) {
      throw new Error('ADMIN_USERNAME or ADMIN_PASSWORD is not acceptable')
    }
    bootstrapAdmin = { username, password }
  }
  const bootstrapToken = env.BOOTSTRAP_TOKEN?.trim() || undefined
  if (bootstrapToken && bootstrapToken.length < 16) {
    throw new Error('BOOTSTRAP_TOKEN must be at least 16 characters')
  }
  if (!bootstrapAdmin && !bootstrapToken && env.ALLOW_OPEN_SETUP !== '1') {
    throw new Error('BOOTSTRAP_TOKEN or ADMIN_USERNAME and ADMIN_PASSWORD is required')
  }
  const port = Number(env.PORT ?? '8080')
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer from 1 to 65535')
  }
  const cookieRaw = env.COOKIE_SECURE?.trim()
  let cookieSecure: boolean | undefined
  if (cookieRaw === '1') {
    cookieSecure = true
  } else if (cookieRaw === '0') {
    cookieSecure = false
  } else if (cookieRaw && cookieRaw !== 'auto') {
    throw new Error('COOKIE_SECURE must be 1, 0, or auto')
  }
  const logLevel = env.LOG_LEVEL?.trim() || 'info'
  if (logLevel !== 'info' && logLevel !== 'warn' && logLevel !== 'error') {
    throw new Error('LOG_LEVEL must be info, warn, or error')
  }
  return {
    port,
    databaseUrl,
    masterKey: parseMasterKey(env.KEY_ENCRYPTION_SECRET),
    upstream: parseUpstream(env.DEEPSEEK_API_ORIGIN),
    staticDir: env.STATIC_DIR?.trim() || undefined,
    trustProxy: env.TRUST_PROXY === '1',
    hsts: env.HARBOR_HSTS === '1',
    cookieSecure,
    corsOrigins: parseCorsOrigins(env.CORS_ORIGINS),
    bootstrapToken,
    bootstrapAdmin,
    allowOpenSetup: env.ALLOW_OPEN_SETUP === '1',
    inviteTtlHours: parseHours(env.INVITE_TTL_HOURS),
    logLevel,
    e2eReset: env.E2E_RESET === '1' && env.NODE_ENV !== 'production',
  }
}
