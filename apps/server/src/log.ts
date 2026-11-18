import { redactText } from './crypto.js'

const SECRET_FIELD = /(password|token|authorization|secret|cookie|ciphertext|passphrase|api[-_]?key|^key$)/i
const CONTENT_FIELD = /^(text|content|blocks|prompt|messages|body|completion|thinking|title|message_text)$/i

const RANK = { info: 10, warn: 20, error: 30 } as const
type Level = keyof typeof RANK

let minimum: Level = 'info'

export const setLogLevel = (level: string): void => {
  if (level === 'info' || level === 'warn' || level === 'error') {
    minimum = level
  }
}

const sanitize = (value: unknown): unknown => {
  if (typeof value === 'string') {
    if (value.length > 200) {
      return '[omitted]'
    }
    return redactText(value, [])
  }
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return value
  }
  return '[omitted]'
}

/** One JSON object per line. Message text and credentials are not written. */
export const log = (level: Level, message: string, fields: Record<string, unknown> = {}): void => {
  if (RANK[level] < RANK[minimum]) {
    return
  }
  const safe: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(fields)) {
    if (SECRET_FIELD.test(key) || CONTENT_FIELD.test(key)) {
      continue
    }
    safe[key] = sanitize(value)
  }
  const line = JSON.stringify({
    time: new Date().toISOString(),
    level,
    message: redactText(message, []),
    ...safe,
  })
  if (level === 'error') {
    console.error(line)
  } else {
    console.log(line)
  }
}
