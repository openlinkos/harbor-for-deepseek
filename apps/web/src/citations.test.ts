import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { TextCitation } from '@deepapi/types'
import type { SearchCiteCard } from './blocks.js'
import { composeCitationMarkdown, joinAnswerText, joinTextBlocks, stripPartialCitation } from './citations.js'
import { Markdown } from './markdown.js'

const cite = (url: string, at?: number): TextCitation => ({
  type: 'web_search_result_location',
  url,
  title: '来源标题',
  cited_text: '摘录',
  encrypted_index: '',
  ...(at === undefined ? {} : { at }),
})

const sources = [
  { url: 'https://example.com/a', title: '甲来源', site: '甲站' },
  { url: 'https://example.com/b', title: '乙来源', site: '乙站' },
]

const html = (text: string, citations?: TextCitation[], cards?: SearchCiteCard[], streaming = false) =>
  renderToStaticMarkup(createElement(Markdown, { text, citations, cards, streaming }))

const badgeCount = (markup: string, n: string) => markup.match(new RegExp(`<a class="cite(?: wide)?"[^>]*>${n}</a>`, 'g'))?.length ?? 0

describe('joinTextBlocks', () => {
  it('maps each citation offset onto the concatenated document', () => {
    const first = 'abc'
    const second = '。def'
    const joined = joinTextBlocks([
      { type: 'text', text: first, citations: [cite('https://example.com/a', first.length)] },
      { type: 'text', text: second, citations: [cite('https://example.com/b', 1)] },
    ])
    expect(joined.text).toBe('abc。def')
    expect(joined.citations.map((item) => item.at)).toEqual([3, 4])
  })
})

describe('stripPartialCitation', () => {
  it('hides a trailing half marker only while streaming', () => {
    expect(stripPartialCitation('流式[citation:', true)).toBe('流式')
    expect(stripPartialCitation('流式[citation:12', true)).toBe('流式')
    expect(stripPartialCitation('流式[cita', true)).toBe('流式')
    expect(stripPartialCitation('完成[citation:1]', true)).toBe('完成[citation:1]')
    const finishedC = '写完[c'
    const finishedR = '写完[r'
    expect(stripPartialCitation(finishedC)).toBe(finishedC)
    expect(stripPartialCitation(finishedR)).toBe(finishedR)
  })
})

describe('joinAnswerText', () => {
  it('inserts a blank line when a tool block sits between text blocks', () => {
    const joined = joinAnswerText([
      { type: 'text', text: '甲' },
      { type: 'thinking', thinking: '想', signature: '' },
      { type: 'text', text: '乙' },
    ])
    expect(joined.text).toBe('甲\n\n乙')
  })

  it('keeps adjacent text blocks in one paragraph', () => {
    const joined = joinAnswerText([
      { type: 'text', text: '甲' },
      { type: 'text', text: '。乙' },
    ])
    expect(joined.text).toBe('甲。乙')
  })
})

describe('citation markdown', () => {
  const one = [cite('https://example.com/a')]
  const two = [cite('https://example.com/a'), cite('https://example.com/b')]

  it('does not turn plain (1) or [2] into badges when citations exist', () => {
    const text = '步骤(1)见[2]结束。'
    const marked = composeCitationMarkdown(text, [cite(sources[0].url, text.length)], sources)
    const markup = html(marked.text, marked.citations, marked.cards)
    expect(markup).toContain('步骤(1)')
    expect(markup).toContain('见[2]')
    expect(badgeCount(markup, '1')).toBe(1)
    expect(markup).not.toContain('>2</a>')
  })

  it('renders a citation inside strong, a table cell, and a heading as a badge', () => {
    const strong = html('见**结论**[citation:1]。', one)
    expect(strong).toMatch(/<strong>结论<\/strong>/)
    expect(strong).not.toMatch(/<strong>[\s\S]*data-citation-group[\s\S]*<\/strong>/)
    expect(strong).toContain('data-citation-group')

    const split = html('主管**风险控制**[citation:1]与合规。', one)
    expect(split).toContain('<strong>风险控制</strong>')
    expect(split).toMatch(/<\/strong>与合规。<span[^>]*data-citation-group/)
    expect(split).not.toContain('[citation')

    const table = html('| 列 |\n| --- |\n| 单元格[citation:1]。 |\n', one)
    expect(table).toMatch(/<td>[\s\S]*data-citation-group[\s\S]*<\/td>/)
    expect(table).not.toContain('[citation')

    const heading = html('## 标题[citation:1]。', one)
    expect(heading).toMatch(/<h2>[\s\S]*data-citation-group[\s\S]*<\/h2>/)
    expect(heading).not.toContain('[citation')
  })

  it('does not show a trailing half [citation: marker while streaming', () => {
    expect(html('流式[citation:', undefined, undefined, true)).not.toContain('[citation')
    expect(html('流式[citation:12', undefined, undefined, true)).not.toContain('citation')
    expect(html('写完[c', one)).toContain('[c')
    expect(html('写完[r', one)).toContain('[r')
  })

  it('merges adjacent citations into one group after the period', () => {
    const markup = html('结束[citation:1][citation:2]。', two)
    expect(markup.match(/data-citation-group/g)).toEqual(['data-citation-group'])
    const badge = markup.indexOf('>1</a>')
    const period = markup.lastIndexOf('。', badge)
    expect(period).toBeGreaterThan(-1)
    expect(markup.slice(period + 1, badge)).not.toMatch(/\p{Script=Han}/u)
    expect(markup.slice(markup.indexOf('data-citation-group'))).toContain('>2</a>')
    expect(badgeCount(markup, '1')).toBe(1)
    expect(badgeCount(markup, '2')).toBe(1)
  })

  it('collects every citation on one line into a single group at the block end', () => {
    const markup = html('第一句。[citation:1]第二句。[citation:2]', two)
    expect(markup.match(/data-citation-group/g)).toEqual(['data-citation-group'])
    const group = markup.slice(markup.indexOf('data-citation-group'))
    expect(group.indexOf('>1</a>')).toBeLessThan(group.indexOf('>2</a>'))
    expect(markup.indexOf('第二句。')).toBeLessThan(markup.indexOf('data-citation-group'))
    expect(markup.slice(markup.indexOf('>'), markup.indexOf('data-citation-group'))).toContain('第一句。第二句。')
    const inner = /<span data-citation-group=""[^>]*>([\s\S]*?)<\/span>/.exec(markup)?.[1] ?? ''
    expect(inner).not.toMatch(/[\u4e00-\u9fff]/)
    expect(inner).not.toContain('<span')
  })

  it('keeps comma-before and period-after citations in source order', () => {
    const markup = html('甲[citation:1]，乙。[citation:2]', two)
    const group = markup.slice(markup.indexOf('data-citation-group'))
    expect(markup.match(/data-citation-group/g)).toHaveLength(1)
    expect(group.indexOf('>1</a>')).toBeLessThan(group.indexOf('>2</a>'))
    expect(markup.indexOf('甲，乙。')).toBeLessThan(markup.indexOf('data-citation-group'))
  })

  it('parks a citation before a soft line break', () => {
    const markup = html('第一句[citation:1]\n第二句', one)
    expect(markup.indexOf('data-citation-group')).toBeLessThan(markup.indexOf('第二句'))
    expect(markup.indexOf('第一句')).toBeLessThan(markup.indexOf('data-citation-group'))
  })

  it('places a citation after bold outside the strong element', () => {
    const markup = html('见**结论**[citation:1]。', one)
    expect(markup).toMatch(/<strong>结论<\/strong>[\s\S]*data-citation-group/)
    expect(markup).not.toMatch(/<strong>[\s\S]*data-citation-group[\s\S]*<\/strong>/)
  })

  it('leaves citation markers inside fences and math as literal text', () => {
    const tilde = html('~~~\n[citation:1]\n~~~\n', one)
    expect(tilde).toContain('[citation:1]')
    expect(tilde).not.toContain('data-citation-group')
    expect(tilde).not.toContain('\uE000')
    const openFence = html('说明\n```\n[citation:1]\n', one)
    expect(openFence).toContain('[citation:1]')
    expect(openFence).not.toContain('data-citation-group')
    const math = html('算式 $E=mc^2$。', one)
    expect(math).toContain('katex')
    expect(math).not.toContain('data-citation-group')
    const dollar = html('算式 $b+[citation:1]$ 完', one)
    expect(dollar).toContain('[citation:1]')
    expect(dollar).not.toContain('data-citation-group')
    expect(dollar).not.toContain('katex-error')
    const displayDollar = html('展示 $$c+[citation:1]$$\n', one)
    expect(displayDollar).toContain('[citation:1]')
    expect(displayDollar).not.toContain('data-citation-group')
    expect(displayDollar).not.toContain('katex-error')
    const inline = html('行内 \\(a+[citation:1]\\) 结束', one)
    expect(inline).toContain('[citation:1]')
    expect(inline).not.toContain('data-citation-group')
    const display = html('展示 \\[a+[citation:1]\\]\n', one)
    expect(display).toContain('[citation:1]')
    expect(display).not.toContain('data-citation-group')
  })

  it('dedupes the same number inside one group', () => {
    const markup = html('结束。[citation:1][citation:1]', one)
    expect(badgeCount(markup, '1')).toBe(1)
    expect(markup.match(/data-citation-group/g)).toHaveLength(1)
  })

  it('leaves a citation marker inside code as text', () => {
    const markup = html('看 `[citation:1]` 和\n\n```\n[citation:2]\n```\n', two)
    expect(markup).toContain('[citation:1]')
    expect(markup).toContain('[citation:2]')
    expect(markup).not.toContain('data-citation-group')
  })

  it('joins a citation that arrived before the next block onto the end of the paragraph', () => {
    const blocks = joinTextBlocks([
      { type: 'text', text: '实际表现', citations: [cite(sources[1]!.url, '实际表现'.length)] },
      { type: 'text', text: '。因此，结束。' },
    ])
    expect(blocks.citations[0]?.at).toBe('实际表现'.length)
    const marked = composeCitationMarkdown(blocks.text, blocks.citations, sources)
    const markup = html(marked.text, marked.citations, marked.cards)
    expect(markup.match(/<p[\s>]/g)).toHaveLength(1)
    expect(markup).toContain('。因此，结束。')
    expect(markup).toMatch(/结束。<span[^>]*data-citation-group[\s\S]*>2<\/a>/)
    expect(markup).not.toMatch(/<p[^>]*>。/)
  })

  it('keeps a sentence that continues after a citation inside the same list item', () => {
    const markup = html('- 转型[citation:1]。他于2025年底卸任。', one)
    expect(markup).toContain('他于2025年底卸任。')
    expect(markup).toMatch(/卸任。<span[^>]*data-citation-group/)
    expect(markup).not.toMatch(/<li[^>]*>。/)
  })
})
