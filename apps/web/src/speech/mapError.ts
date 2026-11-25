import { ApiClientError } from '@deepapi/api-client'
import type { MessageKey } from '@deepapi/i18n'
import { classifyApiError } from '../errors.js'

const isAbort = (error: unknown): boolean =>
  (error instanceof DOMException && error.name === 'AbortError') ||
  (error instanceof Error && error.name === 'AbortError')

export const isSpeechAbort = isAbort

const sharedKey = (error: unknown): MessageKey | null => {
  if (!(error instanceof ApiClientError)) return null
  const kind = classifyApiError(error)
  if (kind === 'unauthorized') return 'invalidToken'
  if (kind === 'insufficientBalance') return 'usageLimitReached'
  if (kind === 'rateLimited') return 'requestFrequencyTooHigh'
  if (kind === 'network') return 'hintNetworkError'
  return null
}

export const mapVoiceError = (error: unknown): MessageKey => {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') return 'voiceInputPermissionDenied'
    if (error.name === 'NotFoundError' || error.name === 'NotReadableError') return 'voiceInputNoDevice'
  }
  if (error instanceof ApiClientError) {
    if (error.status === 413) return 'voiceInputTooLong'
    if (error.status === 400) return 'voiceInputFailed'
    return sharedKey(error) ?? 'voiceInputFailed'
  }
  return 'voiceInputFailed'
}

export const mapTtsError = (error: unknown): MessageKey => {
  if (error instanceof ApiClientError) {
    if (error.status === 400 || error.kind === 'protocol') return 'ttsUnavailable'
    if (error.status === 413) return 'ttsTooLong'
    return sharedKey(error) ?? 'ttsFailed'
  }
  return 'ttsFailed'
}
