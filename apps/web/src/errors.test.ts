import { ApiClientError } from '@deepapi/api-client'
import { describe, expect, it } from 'vitest'
import { classifyApiError, classifyStatus, isRetryableApiError, replyErrorCode } from './errors.js'

describe('official error mapping', () => {
  it('classifies HTTP statuses the way chat-demo does', () => {
    expect(classifyStatus(401)).toBe('unauthorized')
    expect(classifyStatus(402)).toBe('insufficientBalance')
    expect(classifyStatus(413)).toBe('tooLarge')
    expect(classifyStatus(429)).toBe('rateLimited')
    expect(classifyStatus(503)).toBe('serverBusy')
    expect(classifyStatus(500)).toBe('serverBusy')
    expect(classifyStatus(400)).toBe('other')
    expect(classifyStatus(undefined)).toBe('other')
  })

  it('maps network and HTTP failures onto official reply codes', () => {
    expect(replyErrorCode(new ApiClientError('network', 'Failed to fetch'))).toBe('code:network')
    expect(replyErrorCode(new ApiClientError('http', 'busy', 503))).toBe('code:busy')
    expect(replyErrorCode(new ApiClientError('http', 'no quota', 402))).toBe('code:quota')
    expect(replyErrorCode(new ApiClientError('http', 'bad key', 401))).toBe('code:auth')
    expect(replyErrorCode(new ApiClientError('http', 'slow down', 429))).toBe('code:rate')
    expect(replyErrorCode(new ApiClientError('http', 'nope', 404))).toBe('code:fallback')
    expect(classifyApiError(new ApiClientError('protocol', 'bad stream', 200))).toBe('other')
  })

  it('treats network, rate limit, and server busy as retryable', () => {
    expect(isRetryableApiError(new ApiClientError('network', 'offline'))).toBe(true)
    expect(isRetryableApiError(new ApiClientError('http', 'slow', 429))).toBe(true)
    expect(isRetryableApiError(new ApiClientError('http', 'down', 500))).toBe(true)
    expect(isRetryableApiError(new ApiClientError('http', 'bad key', 401))).toBe(false)
    expect(isRetryableApiError(new ApiClientError('http', 'no quota', 402))).toBe(false)
  })
})
