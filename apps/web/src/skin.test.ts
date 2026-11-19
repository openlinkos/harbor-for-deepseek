import { describe, expect, it } from 'vitest'
import { parseSkin } from './skin.js'

describe('parseSkin', () => {
  it('accepts an official-shaped package and rejects a secret', () => {
    const pack = parseSkin(JSON.stringify({
      format: 'harbor-ui',
      schema: 1,
      name: '暖色',
      scripts: 'forbidden',
      tokens: { light: { '--dsw-specific-sidebar-fill': '#f6f0e8' } },
      layout: { sidebar: { widthPx: 240 } },
    }))
    expect(pack.layout?.sidebar?.widthPx).toBe(240)
    expect(() => parseSkin(JSON.stringify({ format: 'harbor-ui', schema: 1, name: 'x', scripts: 'forbidden', tokens: { light: { '--dsw-alias-brand-primary': 'sk-shortkey' } } }))).toThrow()
    expect(() => parseSkin('{"format":"harbor-ui","schema":1,"name":"x","scripts":"ok"}')).toThrow()
  })
})
