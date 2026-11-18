import { describe, expect, it } from 'vitest'
import { translate } from './index.js'

describe('i18n', () => {
  it('uses Harbor as the product name in both languages', () => {
    expect(translate('zh', 'product')).toBe('Harbor')
    expect(translate('en', 'product')).toBe('Harbor')
    expect(translate('zh', 'disclaimer')).toContain('非官方')
    expect(translate('en', 'disclaimer')).toContain('not affiliated')
    expect(translate('en', 'imported', { added: 2, skipped: 1 })).toBe('Imported 2, skipped 1.')
  })

  it('does not use forbidden branding in either catalog', () => {
    const blob = `${translate('zh', 'disclaimerLong')} ${translate('en', 'disclaimerLong')} ${translate('zh', 'tagline')}`
    expect(blob).not.toContain('平替')
    expect(blob.toLowerCase()).not.toContain('official partner')
  })
})
