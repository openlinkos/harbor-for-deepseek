import { describe, expect, it, vi } from 'vitest'
import { log } from './log.js'

describe('log', () => {
  it('drops credential fields', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    log('info', 'balance', { keyId: 'abc', apiKey: 'demo-pool-key', token: 'session', path: '/api/admin/keys' })
    const line = String(spy.mock.calls[0]?.[0])
    expect(line).toContain('balance')
    expect(line).toContain('/api/admin/keys')
    expect(line).not.toContain('demo-pool-key')
    expect(line).not.toContain('session')
    spy.mockRestore()
  })
})
