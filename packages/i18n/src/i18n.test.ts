import { describe, expect, it } from 'vitest'
import { translate } from './index.js'

describe('i18n', () => {
  it('uses the full product name in both languages', () => {
    expect(translate('zh', 'product')).toBe('DeepAPI')
    expect(translate('en', 'product')).toBe('DeepAPI')
    expect(translate('zh', 'composerPlaceholder')).toBe('给 DeepAPI 发送消息')
    expect(translate('en', 'composerPlaceholder')).toBe('Message DeepAPI')
    expect(translate('zh', 'search')).toBe('智能搜索')
    expect(translate('en', 'imported', { added: 2, skipped: 1 })).toBe('Imported 2, skipped 1.')
  })

  it('keeps the trademark note in the footer and does not claim a partnership', () => {
    expect(translate('zh', 'footerAbout')).toBe('OpenLinkOS 发起的开源项目')
    expect(translate('en', 'footerAbout')).toBe('Open source by OpenLinkOS')
    expect(translate('en', 'footerMark')).toContain('not affiliated with DeepSeek')
    expect(translate('zh', 'footerMark')).toContain('商标')
    const blob = `${translate('zh', 'footerMark')} ${translate('en', 'footerMark')} ${translate('zh', 'tagline')} ${translate('zh', 'product')}`
    expect(blob).not.toContain('平替')
    expect(blob.toLowerCase()).not.toContain('official partner')
    expect(blob).not.toContain('非官方社区项目')
  })
})
