import { describe, expect, it } from 'vitest'
import { validateServerUrl } from './serverUrl.js'

describe('validateServerUrl', () => {
  it('accepts https and opted-in private http, and rejects public http', () => {
    expect(validateServerUrl('https://harbor.example/app', false)).toBe('https://harbor.example')
    expect(validateServerUrl('http://192.168.1.20:8080', true)).toBe('http://192.168.1.20:8080')
    expect(validateServerUrl('http://10.0.2.2:8080', true)).toBe('http://10.0.2.2:8080')
    expect(() => validateServerUrl('http://harbor.example', true)).toThrow(/invalid/)
    expect(() => validateServerUrl('http://192.168.1.20', false)).toThrow(/invalid/)
    expect(() => validateServerUrl('https://user:pass@harbor.example', false)).toThrow(/invalid/)
  })
})
