// fb1721-M/L/N: required CI gate for 昊辰 2026-11-20 17:21 — \[ \] / \( \) formulas shown raw (`[ \boxed{…} ]`),
// and markdown inside the thinking block styled wrong.
// Picked up by `pnpm e2e` (ci.yml) through apps/web/playwright.config.ts, same as fb1554-markdown.spec.ts.
// Official: e2e/fixtures/official-fb1721.json → markdown.parser (offline official parser) and markdown.reference
// (official DOM shape + frozen CSS). sha256 8ba1a80f43671876169d6528e2210c9d409f0ffb9ca42697cda4e9ea0eee319a.
// Corpus: e2e/fixtures/fb1721-math-corpus.ts. The same text is sent as answer body and as thinking.
// Every case runs in BOTH containers: answer body (.prose / .ds-markdown) and thinking
// (.think-copy / .ds-think-content .ds-markdown), × light/dark × 1440/390.
// fb1721-M (math delimiters) is asserted directly. List spacing covers fb1721-L and fb1721-N.
import { expect, test, type Page } from '@playwright/test'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { boot, chip } from './lib/fb1721-boot'
import { LISTS, MATH, MATH_EXPECT } from './fixtures/fb1721-math-corpus'
const HERE = dirname(fileURLToPath(import.meta.url))
const LIB = readFileSync(join(HERE, 'lib/fb1721-md.js'), 'utf8')
const OFF_ALL = JSON.parse(readFileSync(join(HERE, 'fixtures/official-fb1721.json'), 'utf8'))
const OFF = OFF_ALL.markdown
const PARSER = OFF.parser.MATH.counts
const SHOTS = process.env.SHOTS
const reply = (where: 'body' | 'think', text: string) => (_req: unknown) => {
  const ev: unknown[] = [{ type: 'message_start', message: { id: 'm', model: 'deepseek-flash' } }]
  let i = 0
  ev.push({ type: 'content_block_start', index: i, content_block: { type: 'thinking', thinking: '', signature: '' } },
    { type: 'content_block_delta', index: i, delta: { type: 'thinking_delta', thinking: where === 'think' ? text : '先想一想。' } }, { type: 'content_block_stop', index: i }); i++
  ev.push({ type: 'content_block_start', index: i, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: i, delta: { type: 'text_delta', text: where === 'body' ? text : '见上。' } }, { type: 'content_block_stop', index: i })
  ev.push({ type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null, title: '公式' }, usage: { input_tokens: 1, output_tokens: 1 } }, { type: 'message_stop' })
  return ev
}
// container lookup: ours first, official selectors second (so the same spec can run on a replayed official page)
const container = (page: Page, where: 'body' | 'think') => where === 'body'
  ? page.locator('[data-testid=assistant-text] , .ds-message .ds-markdown:not(.ds-think-content .ds-markdown)').first()
  : page.locator('.timeline-think, .ds-think-content .ds-markdown').first()
const run = async (page: Page, theme: string, where: 'body' | 'think', text: string) => {
  await boot(page, theme, { body: reply(where, text) }); await chip(page, 'toggle-thinking', true)
  await page.getByTestId('composer').fill('[筑衡测试] 100 以内质数'); await page.getByTestId('send').click()
  await page.getByTestId('assistant-text').first().waitFor(); await page.waitForTimeout(600)
  if (where === 'think' && !(await container(page, 'think').isVisible())) { await page.getByTestId('thinking-toggle').first().click(); await page.waitForTimeout(300) }
  await page.evaluate(LIB)
  return container(page, where)
}
for (const theme of ['light', 'dark']) for (const [w, h] of [[1440, 900], [390, 844]]) for (const where of ['body', 'think'] as const) {
  const cell = `${theme} ${w} ${where}`
  test.describe(`fb1721 md ${cell}`, () => {
    test.use({ viewport: { width: w, height: h }, colorScheme: theme as 'light' | 'dark', bypassCSP: true })
    test('math-delimiters', async ({ page }) => { const c = await run(page, theme, where, MATH)
      if (SHOTS) { mkdirSync(SHOTS, { recursive: true }); await c.screenshot({ path: join(SHOTS, `math-${cell.replace(/ /g, '-')}.png`) }) }
      const m = await c.evaluate((e) => (window as any).__mdm(e))
      const leaked = MATH_EXPECT.literalForbidden.filter((s) => m.plain.includes(s))
      expect.soft(leaked, 'raw TeX left in text').toEqual([])
      expect.soft(MATH_EXPECT.literalMustStay.filter((s) => !m.plain.includes(s)), '"$5 和 $10" must stay text').toEqual([])
      expect.soft(m.errors, 'katex-error').toBe(0)
      expect.soft(m.inline, 'inline formulas').toBe(PARSER.inlineMath)
      expect(m.display, 'display formulas').toBe(PARSER.math) })
    test('math-display-style', async ({ page }) => { const c = await run(page, theme, where, MATH)
      const m = await c.evaluate((e) => (window as any).__mdm(e))
      expect(m.display).toBe(PARSER.math)
      for (const d of m.display_) { expect.soft(d.textAlign).toBe(OFF.math.displayTextAlign); expect.soft(d.padding).toBe(OFF.math.displayPadding); expect.soft(d.overflowX).toBe(OFF.math.displayOverflowX)
        if (!d.overflowing) expect.soft(Math.abs(d.centreDx), 'formula centred in column').toBeLessThanOrEqual(1) }
      // official katex.css: .katex{font:1.21em/1.2 …}
      expect(m.katexFontRatio).toEqual([1.21]) })
    test('lists-spacing', async ({ page }) => { const c = await run(page, theme, where, LISTS)
      const L = await c.evaluate((e) => (window as any).__lists(e))
      if (SHOTS) { mkdirSync(SHOTS, { recursive: true }); await c.screenshot({ path: join(SHOTS, `lists-${cell.replace(/ /g, '-')}.png`) }) }
      const ref = OFF.reference[`${theme}|${w}`][where]
      // SP-MD-039. Think paragraph+list margin-top is 4px. The fixture still records p>ul as 12.
      const expectGap = (from: string, to: string) => (where === 'think' && from === 'p' && (to === 'ul' || to === 'ol') ? 4 : ref.gaps[`${from}>${to}`])
      const bad = L.gaps.filter((g: { from: string; to: string; gap: number }) => Math.abs(g.gap - expectGap(g.from, g.to)) > 0.5).map((g: { from: string; to: string; gap: number }) => `${g.from}>${g.to} ${g.gap}≠${expectGap(g.from, g.to)}`)
      expect.soft(L.kinds, 'block sequence').toEqual(['p', 'p', 'ul', 'p', 'ol', 'p'])
      expect.soft(bad, 'block gaps').toEqual([])
      expect.soft(L.liGaps, 'li gap').toEqual(ref.liGaps)
      expect.soft(L.nested, 'nested list gap').toEqual(ref.nested)
      expect.soft(L.indent, 'list text indent').toBe(ref.indent)
      expect.soft(L.liFont, 'li font').toEqual(ref.liFont)
      expect.soft(L.liColor, 'li colour').toBe(ref.liColor)
      expect.soft(L.marker, 'marker colour').toBe(ref.marker)
      expect(L.pFont, 'p font').toEqual(ref.pFont) })
  })
}
