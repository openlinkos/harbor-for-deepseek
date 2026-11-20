import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MATH } from '../e2e/fixtures/fb1721-math-corpus.js'
import { Markdown } from './markdown.js'

const official = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../e2e/fixtures/official-fb1721.json'), 'utf8')) as {
  markdown: { parser: { MATH: { inlineMath: string[]; math: string[] } } }
}

const html = (text: string, streaming = false) => renderToStaticMarkup(createElement(Markdown, { text, streaming }))

const decode = (value: string) => value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')

const texOf = (markup: string) =>
  [...markup.matchAll(/<annotation encoding="application\/x-tex">([\s\S]*?)<\/annotation>/g)].map((match) => decode(match[1] ?? ''))

describe('deepseek math delimiters', () => {
  const inline = official.markdown.parser.MATH.inlineMath
  const block = official.markdown.parser.MATH.math
  const order = [inline[0], inline[1], block[0], inline[2], block[1], block[2], block[3], inline[3], inline[4]]

  it('renders \\(\\) / \\[\\] and keeps "$5 和 $10" as text', () => {
    const markup = html(MATH)
    expect(markup).toContain('$5 和 $10')
    expect(markup).not.toContain('katex-error')
    expect(markup.match(/class="katex-display/g)).toHaveLength(4)
    expect(texOf(markup)).toEqual(order)
    expect(markup).toMatch(/<li><p>偶数质数只有 ?<span class="katex"/)
    expect(markup).toMatch(/<li><p>共有 ?<span class="katex"/)
  })

  it('turns red if a closing $ before a digit starts math', () => {
    const markup = html('价格 $5 和 $10 不是公式，而 $25$ 是。')
    expect(markup).toContain('$5 和 $10')
    expect(texOf(markup)).toEqual(['25'])
  })

  it('closes a partial \\( / \\[ only while streaming', () => {
    const partial = html('只需检验到 \\(\\sqrt{100}', true)
    expect(texOf(partial)).toEqual(['\\sqrt{100}'])
    expect(partial).not.toContain('katex-error')
    const bare = html('价格 \\(', true)
    expect(bare).not.toContain('katex')
    expect(bare).not.toContain('\\(')
    const held = html('价格 \\(\\sqrt{100}', false)
    expect(held).not.toContain('class="katex"')
  })
})
