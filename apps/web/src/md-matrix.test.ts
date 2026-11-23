import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Markdown } from './markdown.js'

const rows = JSON.parse(readFileSync(new URL('./__fixtures__/md-matrix.json', import.meta.url), 'utf8')).rows as Array<{
  id: string
  input: string
  html: string
}>

const html = (text: string, streaming = false) => renderToStaticMarkup(createElement(Markdown, { text, streaming }))

const decode = (value: string) =>
  value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')

/** Compare emphasis, strong, delete, breaks, and text. Wrapper chrome is not semantic. */
const semantic = (value: string) =>
  decode(value)
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<button[\s\S]*?<\/button>/gi, '')
    .replace(/<div class="ds-markdown-code-copy-button">[\s\S]*?<\/div>/gi, '')
    .replace(/<span\b[^>]*>/gi, '')
    .replace(/<\/span>/gi, '')
    .replace(/<\/?(?:div|p|pre|i)\b[^>]*>/gi, '')
    .replace(/\sclass="[^"]*"/gi, '')
    .replace(/\sstyle="[^"]*"/gi, '')
    .replace(/<br\s*\/?>/gi, '<br>')
    .replace(/>\s+</g, '><')
    .trim()

const renderRow = (input: string, streaming = false) => {
  try {
    return semantic(html(input, streaming))
  } catch (error) {
    return 'THROW ' + (error instanceof Error ? error.message : String(error))
  }
}

describe('official markdown matrix', () => {
  it('renders all 561 rows with the same emphasis, strong, delete, and text', () => {
    expect(rows).toHaveLength(561)
    const bad = rows.flatMap((row) => {
      const ours = renderRow(row.input)
      const want = semantic(row.html)
      return ours === want ? [] : [{ id: row.id, ours, want }]
    })
    expect(bad).toEqual([])
  })

  it('matches the same rows when the streaming path is fed in chunks', () => {
    const bad = rows.flatMap((row) => {
      const step = Math.max(1, Math.ceil(row.input.length / 4))
      for (let end = step; end < row.input.length; end += step) renderRow(row.input.slice(0, end), true)
      const ours = renderRow(row.input, true)
      const want = semantic(row.html)
      return ours === want ? [] : [{ id: row.id, ours, want }]
    })
    expect(bad).toEqual([])
  })

  it('renders a single-line fence with no language as a code block (SP-MD-401)', () => {
    const bare = html('```\nprint(1)\n```')
    expect(bare).toContain('code-card')
    expect(bare).toContain('is-plain')
    expect(bare).not.toContain('inline-code')
    expect(bare).toContain('print(1)')
    const text = html('```text\nconst long = 1\n```')
    expect(text).toContain('code-card')
    expect(text).toContain('is-plain')
    const js = html('```js\nconst n = 1\n```')
    expect(js).toContain('code-card')
    expect(js).not.toContain('is-plain')
  })

  it('bolds the 昊辰 sentence and the punctuation edges around it (SP-MD-424)', () => {
    for (const sentence of ['持在**33°C**左右。', '当前水温维持在**33°C**左右。', '**33°C**左右']) {
      const markup = html(sentence)
      expect(markup).toContain('<strong>33°C</strong>')
      expect(markup).not.toContain('**')
    }
    expect(html('**33°**C左右')).toContain('<strong>33°</strong>')
    expect(html('**50%**左右')).toContain('<strong>50%</strong>')
    // U+2103 ℃ is a symbol, same flanking class as ° and %. SP-MD-424.
    expect(html('持在**33℃**左右。')).toContain('<strong>33℃</strong>')
    expect(html('持在**33℃**左右。')).not.toContain('**')
    expect(html('约**30%**的')).toContain('<strong>30%</strong>')
    expect(html('约**30%**的')).not.toContain('**')
  })
})
