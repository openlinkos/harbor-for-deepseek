const SECRET = /key|password|token|authorization|secret|cookie|ciphertext|passphrase/i

/** Structured logs. Fields that look like credentials are dropped, never printed. */
export const log = (level: 'info' | 'warn' | 'error', message: string, fields: Record<string, unknown> = {}) => {
  const safe: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(fields)) {
    if (SECRET.test(key)) {
      continue
    }
    if (typeof value === 'string' && value.length > 500) {
      safe[key] = `${value.slice(0, 120)}…`
      continue
    }
    safe[key] = value
  }
  const line = JSON.stringify({ level, message, ...safe })
  if (level === 'error') {
    console.error(line)
  } else {
    console.log(line)
  }
}
