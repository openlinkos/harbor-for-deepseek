import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CONTENT_SECURITY_POLICY } from './csp.js'

describe('content security policy', () => {
  it('allows the official API and site icons, and no eval or third-party scripts', () => {
    expect(CONTENT_SECURITY_POLICY).toContain('https://api.deepseek.com')
    expect(CONTENT_SECURITY_POLICY).toContain('https://cdn.deepseek.com')
    expect(CONTENT_SECURITY_POLICY).not.toContain('unsafe-eval')
    expect(CONTENT_SECURITY_POLICY).toContain("style-src-attr 'unsafe-inline'")
    expect(CONTENT_SECURITY_POLICY).not.toContain("script-src 'self' 'unsafe-inline'")
    expect(CONTENT_SECURITY_POLICY).not.toContain("style-src 'self' 'unsafe-inline'")
    expect(CONTENT_SECURITY_POLICY).not.toContain("script-src 'self' https")
    expect(CONTENT_SECURITY_POLICY.startsWith("default-src 'self'")).toBe(true)
  })

  it('ships the same policy in the Cloudflare Pages _headers file', () => {
    const headers = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8')
    expect(headers).toMatch(/^\/\*/m)
    expect(headers).toContain('Strict-Transport-Security: max-age=31536000; includeSubDomains')
    expect(headers).toContain('X-Content-Type-Options: nosniff')
    expect(headers).toContain('Referrer-Policy: no-referrer')
    expect(headers).toContain('X-Frame-Options: DENY')
    expect(headers).toContain('Permissions-Policy: camera=(), microphone=(), geolocation=()')
    expect(headers).toContain(`Content-Security-Policy: ${CONTENT_SECURITY_POLICY}`)
    expect(headers).not.toContain('unsafe-eval')
  })

  it('keeps the service worker off the API host', () => {
    const worker = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8')
    expect(worker).toContain('api.deepseek.com')
    expect(worker).toContain('origin')
    expect(worker).toContain("'/api/'")
    expect(worker).not.toContain('cache.add')
  })
})
