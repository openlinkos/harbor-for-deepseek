// fb1721-D: required CI gate for 昊辰 2026-11-20 17:21「运行蓝色，运行结束灰色，这种动态，你也丢失了」.
// Picked up by `pnpm e2e` (ci.yml) through apps/web/playwright.config.ts, same as fb1554-markdown.spec.ts.
// Official: e2e/fixtures/official-fb1721.json → state (frozen CSS tokens + official DOM class toggle probe).
// sha256 8ba1a80f43671876169d6528e2210c9d409f0ffb9ca42697cda4e9ea0eee319a.
// Staged SSE (e2e/lib/fb1344-sse.js) holds the stream in each official state; computed style of the thinking
// timeline is sampled mid-state AND across the transition (every animation frame), with real transitions (not frozen).
// Official rules (main.5a15ff2247.js, frozen main.dc093a796f.css):
//   think fragment dot  .a510c7ce        WIP thinking  → brand-primary, animation 1.5s linear infinite (scale 1→1.3)
//                       .a510c7ce._0652043 otherwise  → label-tertiary, animation none
//                       only the LAST, still-streaming think fragment is blue
//   title icon          ._970ac5e        brand-primary; + .dea47b2e when useCollapsibleAreaStopped (no answer text && status≠WIP:
//                                         stop / error / interrupted) → label-tertiary
//   vertical line       ._9ecc93a        border-left 1px label-dimmed in every state (no state selector exists)
//   no transition on dot/icon colour (transition-duration 0s): the switch is a single frame.
// IDs: fb1721-D1 WIP dot stays known. fb1721-D2 stop/error title icon is green on this PR, so its key is gone.
// A fix PR deletes only its own id. FB1721_STRICT=1 ignores knownFailure.
import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { boot, chip } from './lib/fb1721-boot'
const HERE = dirname(fileURLToPath(import.meta.url))
const LIB = readFileSync(join(HERE, 'lib/fb1721-state.js'), 'utf8')
const OFF = JSON.parse(readFileSync(join(HERE, 'fixtures/official-fb1721.json'), 'utf8')).state
const STRICT = process.env.FB1721_STRICT === '1'
const KNOWN: Record<string, string> = {
  'fb1721-D1': 'fb1721-D1: 思考点永远灰色、无脉动；进行中应为品牌蓝 + 1.5s 脉动，结束后灰',
}
const knownFailure = (id: string) => { if (!STRICT && KNOWN[id]) test.fail(true, KNOWN[id]) }
const ICON = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="#888"/></svg>')
const RES = Array.from({ length: 5 }, (_, i) => ({ type: 'web_search_result', title: `来源 ${i + 1}`, url: `https://s${i + 1}.example/a`, snippet: 's', site_name: `站${i + 1}`, site_icon: ICON, page_age: '2026-11-19T00:00:00Z', encrypted_content: 'x' }))
const E = {
  think0: [{ type: 'message_start', message: { id: 'r', model: 'deepseek-flash' } }, { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } }, { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: '先想清楚题意：\n\n- 质数定义\n- 范围 100' } }],
  search: [{ type: 'content_block_stop', index: 0 }, { type: 'content_block_start', index: 1, content_block: { type: 'server_tool_use', id: 's1', name: 'deepseek_web_search', input: { action: 'search', queries: ['质数表'] } } }, { type: 'content_block_stop', index: 1 }],
  results: [{ type: 'content_block_start', index: 2, content_block: { type: 'web_search_tool_result', tool_use_id: 's1', content: RES } }, { type: 'content_block_stop', index: 2 }],
  think1: [{ type: 'content_block_start', index: 3, content_block: { type: 'thinking', thinking: '', signature: '' } }, { type: 'content_block_delta', index: 3, delta: { type: 'thinking_delta', thinking: '再核对一遍。' } }],
  answer: [{ type: 'content_block_stop', index: 3 }, { type: 'content_block_start', index: 4, content_block: { type: 'text', text: '' } }, { type: 'content_block_delta', index: 4, delta: { type: 'text_delta', text: '共有 25 个质数。' } }],
  end: [{ type: 'content_block_stop', index: 4 }, { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null, title: '质数' }, usage: { input_tokens: 1, output_tokens: 1 } }, { type: 'message_stop' }],
  error: [{ type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }],
}
const push = (page: Page, ev: unknown[]) => page.evaluate((e) => (window as any).__sse.push(e), ev)
const st = (page: Page) => page.evaluate(() => { (window as any).__state || 0; return (window as any).__state() })
const start = async (page: Page, theme: string) => {
  await boot(page, theme, { staged: true, freezeTransitions: false }); await chip(page, 'toggle-thinking', true); await chip(page, 'toggle-search', true)
  await page.getByTestId('composer').fill('[筑衡测试] 100 以内质数'); await page.getByTestId('send').click(); await page.waitForFunction(() => (window as any).__sse.count() > 0)
  await page.evaluate(LIB)
}
for (const theme of ['light', 'dark'] as const) for (const [w, h] of [[1440, 900], [390, 844]]) {
  const B = OFF.brand[theme], T = OFF.tertiary[theme], DIM = OFF.dimmed[theme]
  test.describe(`fb1721 state ${theme} ${w}`, () => {
    test.use({ viewport: { width: w, height: h }, colorScheme: theme, bypassCSP: true })
    test('wip-thinking-dot-blue-pulsing', async ({ page }) => { knownFailure('fb1721-D1'); await start(page, theme); await push(page, E.think0); await page.waitForTimeout(400)
      const a = await st(page); await page.waitForTimeout(600); const b = await st(page)
      for (const s of [a, b]) { expect(s.dots.length, 'one think dot').toBe(1); expect(s.dots[0].bg).toBe(B); expect(s.dots[0].anim).toBe(`${OFF.dot.animationDuration} ${OFF.dot.animationTimingFunction} infinite`) }
      expect(a.icon, 'title icon while WIP').toBe(B); expect(a.lines.every((c: string) => c === DIM), `line colours ${a.lines}`).toBe(true) })
    test('dot-turns-grey-when-think-ends', async ({ page }) => { await start(page, theme); await push(page, E.think0); await page.waitForTimeout(400)
      // Sample one frame of the live brand dot before the search block replaces it. The pulse stays a known failure on the other D1 tests.
      await page.evaluate(() => (window as any).__sampler.start())
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      await push(page, E.search); await page.waitForTimeout(500); const rec = await page.evaluate(() => (window as any).__sampler.stop())
      const seq = rec.map((r: { s?: { dots?: { bg: string }[] } }) => r.s?.dots?.[0]?.bg).filter(Boolean); const uniq = seq.filter((c: string, i: number) => c !== seq[i - 1])
      expect(uniq, 'dot colour sequence across the transition: blue then grey, no intermediate frames').toEqual([B, T])
      const s = await st(page); expect(s.dots[0].anim).toBe('none'); expect(s.icon).toBe(B) })
    test('only-last-think-fragment-blue', async ({ page }) => { knownFailure('fb1721-D1'); await start(page, theme)
      for (const p of [E.think0, E.search, E.results, E.think1]) await push(page, p); await page.waitForTimeout(500)
      const s = await st(page); expect(s.dots.map((d: { bg: string }) => d.bg)).toEqual([T, B]); expect(s.dots.map((d: { anim: string }) => d.anim)).toEqual(['none', `${OFF.dot.animationDuration} ${OFF.dot.animationTimingFunction} infinite`]) })
    test('answer-streaming-and-done-all-grey', async ({ page }) => { // green on master (guard: the fix must not leave dots blue)
      await start(page, theme)
      for (const p of [E.think0, E.search, E.results, E.think1, E.answer]) await push(page, p); await page.waitForTimeout(500)
      const a = await st(page); await push(page, E.end); await page.evaluate(() => (window as any).__sse.end()); await page.waitForTimeout(600); const b = await st(page)
      await page.reload(); await page.getByTestId('thinking').first().waitFor(); await page.evaluate(LIB); await page.waitForTimeout(300)
      const toggle = page.getByTestId('thinking-toggle').last(); if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click(); await page.waitForTimeout(300); const c = await st(page)
      for (const [k, s] of [['answer streaming', a], ['done', b], ['after reload', c]] as const) { expect(s.dots.length, k).toBe(2); expect(s.dots.map((d: { bg: string }) => d.bg), k).toEqual([T, T]); expect(s.dots.every((d: { anim: string }) => d.anim === 'none'), k).toBe(true); expect(s.icon, k).toBe(B) }
      expect(b.anims, 'no infinite animation left after done').toEqual([]) })
    test('stopped-mid-thinking-icon-grey', async ({ page }) => { knownFailure('fb1721-D2'); await start(page, theme); await push(page, E.think0); await page.waitForTimeout(400)
      await page.getByTestId('stop').click(); await page.waitForTimeout(500); const s = await st(page)
      expect(s.icon, 'title icon after stop').toBe(T); expect(s.dots.map((d: { bg: string }) => d.bg)).toEqual([T]); expect(s.anims).toEqual([]) })
    test('error-mid-thinking-icon-grey', async ({ page }) => { knownFailure('fb1721-D2'); await start(page, theme); await push(page, E.think0); await page.waitForTimeout(400)
      await push(page, E.error); await page.evaluate(() => (window as any).__sse.end()); await page.waitForTimeout(600); const s = await st(page)
      expect(s.icon, 'title icon after error').toBe(T); expect(s.dots.map((d: { bg: string }) => d.bg)).toEqual([T]); expect(s.anims).toEqual([]) })
  })
}
