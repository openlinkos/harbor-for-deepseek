import { describe, expect, it } from 'vitest'
import { GLYPHS } from './glyphs.js'
import { measureInk } from './iconInk.js'

/** Official ink at 1920, from the filled chat.deepseek.com glyphs. Coverage floor is 0.7× official. */
const OFFICIAL = {
  settingsGeneral: { size: 16, w: 16, h: 16, coverage: 0.41 },
  settingsAccount: { size: 16, w: 14, h: 14, coverage: 0.34 },
  settingsData: { size: 16, w: 14, h: 14, coverage: 0.28 },
  settingsPolicy: { size: 16, w: 13, h: 15, coverage: 0.22 },
  dismiss: { size: 14, w: 10, h: 10, coverage: 0.27 },
} as const

describe('official settings glyphs', () => {
  it.each(Object.entries(OFFICIAL))('%s keeps the official ink size and weight', (name, official) => {
    const glyph = GLYPHS[name as keyof typeof GLYPHS]
    expect(glyph.vb).toBe('0 0 16 16')
    expect(glyph.paths.length).toBeGreaterThan(0)
    const fill = 'fill' in glyph ? glyph.fill : 'nonzero'
    const ink = measureInk(glyph.paths, glyph.vb, official.size, fill)
    expect(ink.w).toBeGreaterThanOrEqual(official.w - 2)
    expect(ink.h).toBeGreaterThanOrEqual(official.h - 2)
    expect(ink.w).toBeLessThanOrEqual(official.w + 2)
    expect(ink.h).toBeLessThanOrEqual(official.h + 2)
    expect(ink.coverage).toBeGreaterThanOrEqual(official.coverage * 0.7)
  })
})
