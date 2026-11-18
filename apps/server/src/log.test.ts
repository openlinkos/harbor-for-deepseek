import { describe, expect, it, vi } from 'vitest'
import { log, setLogLevel } from './log.js'

describe('log', () => {
  it('drops credentials and message content', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    log('info', 'balance', {
      keyId: 'abc',
      apiKey: 'sk-demopoolsecret',
      token: 'session-token-value',
      path: '/api/admin/keys',
      text: 'the user asked for the key sk-demopoolsecret',
      status: 200,
    })
    const line = String(spy.mock.calls[0]?.[0])
    const parsed = JSON.parse(line) as { message: string; keyId?: string; path?: string; text?: string; time: string }
    expect(parsed.message).toBe('balance')
    expect(parsed.path).toBe('/api/admin/keys')
    expect(parsed.keyId).toBe('abc')
    expect(parsed.time).toContain('T')
    expect(parsed.text).toBeUndefined()
    expect(line).not.toContain('sk-demopoolsecret')
    expect(line).not.toContain('session-token-value')
    expect(line).not.toContain('the user asked')
    spy.mockRestore()
  })

  it('omits info lines when the level is warn', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    setLogLevel('warn')
    try {
      log('info', 'request', { path: '/healthz' })
      expect(spy).not.toHaveBeenCalled()
    } finally {
      setLogLevel('info')
      spy.mockRestore()
    }
  })
})
