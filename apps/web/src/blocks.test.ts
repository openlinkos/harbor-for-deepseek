import { describe, expect, it } from 'vitest'
import type { TextCitation } from '@deepapi/types'
import { markSearchCitations, presentBlocks, tidyMarkdown } from './blocks.js'

const cite = (url: string, cited_text: string, at?: number): TextCitation => ({
  type: 'web_search_result_location',
  url,
  title: '模型标题',
  cited_text,
  encrypted_index: '',
  ...(at === undefined ? {} : { at }),
})

const sources = [
  { url: 'https://example.com/pop', title: '冰岛人口统计', site: '国家统计局' },
  { url: 'https://example.com/a', title: '甲', site: '甲站' },
  { url: 'https://example.com/b', title: '乙', site: '乙站' },
  { url: 'https://example.com/c', title: '丙', site: '丙站' },
  { url: 'https://example.com/city', title: '雷克雅未克概况', site: '地理志' },
]

describe('presentBlocks', () => {
  it('folds a stray full stop into the previous sentence', () => {
    const blocks = presentBlocks([
      { type: 'text', text: '上海今天多云', citations: [{ type: 'web_search_result_location', url: 'https://example.com', title: '天气', cited_text: '多云', encrypted_index: '' }] },
      { type: 'text', text: '。' },
      { type: 'text', text: '明天也是。\n\n。' },
    ])
    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toMatchObject({ type: 'text', text: '上海今天多云。' })
    expect(blocks[1]).toMatchObject({ type: 'text', text: '明天也是。' })
  })

  it('folds a citation-only list item onto the previous line and drops a lone full stop item', () => {
    const text = tidyMarkdown('- 成都鲁诺企业管理有限公司\n- 〔1〕〔11〕〔12〕\n- 。\n- 昆明鑫川杰管业有限公司')
    expect(text).toBe('- 成都鲁诺企业管理有限公司〔1〕〔11〕〔12〕。\n- 昆明鑫川杰管业有限公司')
  })
})

describe('markSearchCitations', () => {
  const answer = '冰岛大约有三十九万人。首都是雷克雅未克。'
  const first = '冰岛大约有三十九万人。'

  it('numbers badges by search-result order and parks them at the sentence that was just written', () => {
    const marked = markSearchCitations(
      answer,
      [
        cite('https://example.com/pop', 'Population of Iceland is about 390,000 according to the source page.', first.length),
        cite('https://example.com/city', 'Reykjavik is the capital city listed on the source page.', answer.length),
      ],
      sources,
    )
    expect(marked.text).toBe('冰岛大约有三十九万人。〔1〕首都是雷克雅未克。〔5〕')
    expect(marked.citations[0]?.title).toBe('冰岛人口统计')
    expect(marked.citations[4]?.title).toBe('雷克雅未克概况')
    expect(marked.sites[0]).toBe('国家统计局')
    expect(marked.sites[4]).toBe('地理志')
    expect(marked.text).not.toContain('〔2〕')
  })

  it('orders two marks on one sentence by result index', () => {
    const line = '同一句。'
    const marked = markSearchCitations(
      line,
      [cite('https://example.com/city', 'later', line.length), cite('https://example.com/pop', 'earlier', line.length)],
      sources,
    )
    expect(marked.text).toBe('同一句。〔1〕〔5〕')
  })

  it('uses cited_text when a stored answer has no stream offset', () => {
    const marked = markSearchCitations(
      answer,
      [cite('https://example.com/pop', '三十九万'), cite('https://example.com/city', '雷克雅未克')],
      sources,
    )
    expect(marked.text).toBe('冰岛大约有三十九万人。〔1〕首都是雷克雅未克。〔5〕')
  })

  it('does not rewrite an answer that has no search results', () => {
    const text = '人口约 394,000〔1〕〔2〕'
    const citations = [cite('https://example.com/pop', '394,000'), cite('https://example.com/city', '人口')]
    expect(markSearchCitations(text, citations, [])).toEqual({ text, citations, sites: [], cards: [] })
  })
})
