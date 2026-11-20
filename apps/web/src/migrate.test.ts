import { describe, expect, it } from 'vitest'
import { migrateSessionMode, migrateStoredKeys } from './migrate.js'

const memory = () => {
  const values = new Map<string, string>()
  return {
    values,
    getItem(key: string) {
      return values.get(key) ?? null
    },
    setItem(key: string, value: string) {
      values.set(key, value)
    },
    key(index: number) {
      return [...values.keys()][index] ?? null
    },
    get length() {
      return values.size
    },
  }
}

describe('stored key migration', () => {
  it('copies Harbor settings, skins, votes, and the server mode', () => {
    const local = memory()
    local.setItem('harbor-theme', 'dark')
    local.setItem('harbor-ui', '{"format":"harbor-ui","schema":1}')
    local.setItem('harbor-vote:m1', 'up')
    local.setItem('harbor-feedback:m1', '1')
    local.setItem('harbor-voice', '旧音色')
    local.setItem('deepapi-voice', '海星')
    migrateStoredKeys(local)
    expect(local.getItem('deepapi-theme')).toBe('dark')
    expect(local.getItem('deepapi-ui')).toBe('{"format":"deepapi-ui","schema":1}')
    expect(local.getItem('deepapi-vote:m1')).toBe('up')
    expect(local.getItem('deepapi-feedback:m1')).toBe('1')
    expect(local.getItem('harbor-voice')).toBe('旧音色')
    expect(local.getItem('deepapi-voice')).toBe('海星')
    const session = memory()
    session.setItem('harbor-mode', 'local')
    migrateSessionMode(session)
    expect(session.getItem('deepapi-mode')).toBe('local')
  })
})
