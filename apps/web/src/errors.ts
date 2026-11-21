import { ApiClientError } from '@deepapi/api-client'
import type { MessageKey } from '@deepapi/i18n'

/**
 * Failure kinds, ported from deepseek-ai/chat-demo src/services/api/errors.ts
 * (MIT, commit 8ad7b56). Callers pick the sentence; this file only classifies.
 */
export type ApiErrorCondition =
  | 'unauthorized'
  | 'insufficientBalance'
  | 'tooLarge'
  | 'rateLimited'
  | 'serverBusy'
  | 'network'
  | 'other'

/** Classify an HTTP status. A missing status did not reach the server. */
export const classifyStatus = (status: number | undefined): ApiErrorCondition => {
  if (status === 401) return 'unauthorized'
  if (status === 402) return 'insufficientBalance'
  if (status === 413) return 'tooLarge'
  if (status === 429) return 'rateLimited'
  if ((status ?? 0) >= 500) return 'serverBusy'
  return 'other'
}

export const classifyApiError = (error: unknown): ApiErrorCondition => {
  if (!(error instanceof ApiClientError)) return 'other'
  if (error.status === undefined) return error.kind === 'network' ? 'network' : 'other'
  return classifyStatus(error.status)
}

/** Network, rate limit, and a busy server can succeed on another try. */
export const isRetryableApiError = (error: unknown): boolean => {
  const condition = classifyApiError(error)
  return (
    !(error instanceof ApiClientError) ||
    condition === 'network' ||
    condition === 'rateLimited' ||
    condition === 'serverBusy'
  )
}

/** Stored on the user message when the completion never started. */
export const HINT_NETWORK = 'hint:network'

const REPLY_CODE = {
  network: 'code:network',
  unauthorized: 'code:auth',
  insufficientBalance: 'code:quota',
  rateLimited: 'code:rate',
  serverBusy: 'code:busy',
  tooLarge: 'code:fallback',
  other: 'code:fallback',
} as const

const REPLY_KEY: Record<(typeof REPLY_CODE)[ApiErrorCondition], MessageKey> = {
  'code:network': 'hintNetworkError',
  'code:auth': 'invalidToken',
  'code:quota': 'usageLimitReached',
  'code:rate': 'requestFrequencyTooHigh',
  'code:busy': 'completionServerBusy',
  'code:fallback': 'hintFallback',
}

/** Stable code saved on the message. The UI turns it into the bundle sentence. */
export const replyErrorCode = (error: unknown): string => {
  if (!(error instanceof ApiClientError)) {
    return error instanceof Error && error.message ? error.message : 'code:fallback'
  }
  return REPLY_CODE[classifyApiError(error)]
}

export const replyErrorKey = (code: string | null): MessageKey | null =>
  code && code in REPLY_KEY ? REPLY_KEY[code as keyof typeof REPLY_KEY] : null

export type FileErrorCode = 'fileIdMissing' | 'fileDataMissing' | 'invalidFileId'

const FILE_ERROR_PATTERNS: ReadonlyArray<readonly [FileErrorCode, RegExp]> = [
  ['fileIdMissing', /file_ids do not exist or are not created under your account/i],
  ['fileDataMissing', /file data not found for file_id/i],
  ['invalidFileId', /\.source\.file_id: invalid file_id/i],
]

/** A 400 whose text says the attachment file_id is no longer valid. */
export const getFileErrorCode = (error: unknown): FileErrorCode | null => {
  if (!(error instanceof ApiClientError) || error.status !== 400) return null
  return FILE_ERROR_PATTERNS.find(([, pattern]) => pattern.test(error.message))?.[0] ?? null
}

export const extractFileIds = (message: string): string[] => [
  ...new Set(message.match(/file-api-[\w-]+/g) ?? []),
]

export type UploadErrorCode = 'fileCountLimit' | 'storageLimit' | 'parseFailed'

export type UploadErrorInfo = { code: UploadErrorCode; limit?: string }

const PARSE_FAILED_PATTERNS = [
  /You have uploaded an (unsupported|invalid) (file|image)/i,
  /The image is too large to process/i,
  /password-protected/i,
  /Failed to recognize the file/i,
]

/** Files API 400s that name a quota or a parse failure. */
export const getUploadErrorInfo = (error: unknown): UploadErrorInfo | null => {
  if (!(error instanceof ApiClientError) || error.status !== 400) return null
  const { message } = error
  const count = /User file count limit exceeded.*?limit (\d+)/i.exec(message)
  if (count) return { code: 'fileCountLimit', limit: count[1] }
  const storage = /User storage quota exceeded.*?limit ([\d.]+) GB/i.exec(message)
  if (storage) return { code: 'storageLimit', limit: storage[1] }
  if (PARSE_FAILED_PATTERNS.some((pattern) => pattern.test(message))) return { code: 'parseFailed' }
  return null
}
