import { describe, expect, it } from 'vitest'
import { parseCorsOrigins, parseMasterKey, readEnv } from './env.js'

const base = {
  DATABASE_URL: 'postgres://harbor:harbor@127.0.0.1:5432/harbor',
  KEY_ENCRYPTION_SECRET: '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff',
  BOOTSTRAP_TOKEN: 'one-time-token-value',
}

describe('readEnv', () => {
  it('reads a hex master key and refuses secrets inside the upstream origin', () => {
    const config = readEnv(base)
    expect(config.masterKey).toHaveLength(32)
    expect(config.masterKey.toString('hex')).toBe(base.KEY_ENCRYPTION_SECRET)
    expect(parseMasterKey('0123456789abcdef0123456789abcdef')).toHaveLength(32)
    expect(() => parseMasterKey(undefined)).toThrow(/KEY_ENCRYPTION_SECRET/)
    expect(() => readEnv({ ...base, DATABASE_URL: '' })).toThrow(/DATABASE_URL/)
    expect(() => readEnv({ ...base, BOOTSTRAP_TOKEN: '' })).toThrow(/BOOTSTRAP_TOKEN or ADMIN_USERNAME/)
    expect(() => readEnv({ ...base, DEEPSEEK_API_ORIGIN: 'https://user:sk-secret@api.deepseek.com' })).toThrow(/credentials/)
    expect(readEnv({ ...base, DEEPSEEK_API_ORIGIN: 'https://api.deepseek.com/v1' }).upstream).toBe('https://api.deepseek.com')
  })

  it('rejects a wildcard origin and keeps an explicit list', () => {
    expect(parseCorsOrigins('https://harbor.example, http://localhost:8080')).toEqual([
      'https://harbor.example',
      'http://localhost:8080',
    ])
    expect(parseCorsOrigins(' capacitor://localhost ')).toEqual(['capacitor://localhost'])
    expect(() => parseCorsOrigins('*')).toThrow(/CORS_ORIGINS/)
    expect(() => readEnv({ ...base, ADMIN_USERNAME: 'ada' })).toThrow(/together/)
    expect(readEnv({ ...base, ADMIN_USERNAME: 'ada', ADMIN_PASSWORD: 'correct-horse' }).bootstrapAdmin?.username).toBe('ada')
    expect(readEnv({ ...base, E2E_RESET: '1', NODE_ENV: 'production' }).e2eReset).toBe(false)
    expect(readEnv({ ...base, E2E_RESET: '1' }).e2eReset).toBe(true)
  })
})
