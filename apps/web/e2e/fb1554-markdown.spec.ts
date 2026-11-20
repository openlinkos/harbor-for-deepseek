// fb1554: required CI gate for 昊辰 2026-11-20 15:54「还有一些样式有问题」（长回答 markdown）.
// Picked up by `pnpm e2e` (ci.yml) through apps/web/playwright.config.ts, same as fb1344-parity.spec.ts:
// testDir ./e2e, testMatch *.spec.ts. There is no second playwright config.
// Corpus and rules: e2e/fixtures/fb1554-corpus.ts, e2e/lib/fb1554-md-checks.js.
// Official numbers: e2e/fixtures/official-fb1554.json (frozen offline render; do not edit in feature PRs).
// sha256 b32ab0665cec907d32b99fc2bd1489ac7a65f4444d289447936f00a9f36b5442.
// Staged SSE reuses e2e/lib/fb1344-sse.js. The route mock matches fb1344 (balance, models, messages).
// 34 cases = 4 cells × 7 + 1440 × 3 × 2. Red cases on master are test.fail() via knownFailure().
// IDs still open: fb1554-M1, M2, T1, and M4 only for the 390 cite wrap. A fix PR deletes only its own id.
// An unexpected pass fails the run. FB1554_STRICT=1 ignores knownFailure.
// FB1344_STRICT does not open this file: that switch is the fb1344 baseline.
import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { events, sse, EXPECT } from './fixtures/fb1554-corpus'
const HERE = dirname(fileURLToPath(import.meta.url))

// 语料按真实接口形状把正文在引用处切成多个 text block。规则在冻结官方 DOM 上全绿。
// 已知失败用 knownFailure(id)。FB1554_STRICT=1 时全部按真失败跑。修好一项就删掉对应 id，过期的 id 会让 test.fail 变红。
// fb1554-M1 多 text block 分开渲染（段落/列表被切断、跨块加粗残留 **、行首标点）：corpus-structure、corpus-no-literal
// fb1554-M2 中文标点旁的 ** 不渲染（CommonMark 左右侧规则；官方 micromark 已放宽）：cjk-strong-single-block
// fb1554-M4 只剩 390 的 cite-inline-same-line（角标单独换行，等官方补采）。cite-style 已对齐，不再挂这个 id。
//   1440 的 cite-inline-same-line 已经同行，不要标失败，否则意外通过会让 CI 变红。
// fb1554-M5 已删：搜索行 favicon 重叠 4px（.thinking > button 不再漏到 button.favicons）。
// fb1554-T1 「用时 N 秒」：正文阶段还在涨、刷新后变 1 秒、别的回答生成时旧回答也在涨：thought-seconds-*
const STRICT = process.env.FB1554_STRICT === '1'
const KNOWN: Record<string, string> = {
  'fb1554-M1': 'fb1554-M1: 每个 text block 一个 .prose，段落和列表在引用处断开',
  'fb1554-M2': 'fb1554-M2: **「…」** 原样显示',
  'fb1554-M4': 'fb1554-M4: 390 下列表项角标被单独换到下一行，等官方补采后再决定是否不断行',
  'fb1554-T1': 'fb1554-T1: 用时按挂载后墙钟、全局 streaming 计',
}
// Same shape as fb1344-parity.spec.ts. FB1344_STRICT is intentionally not read here.
const KNOWN_PASSING_CELLS: Record<string, string[]> = {}
const knownFailure = (id: string) => {
  if (STRICT || !KNOWN[id]) return
  const cell = test.info().titlePath.find((t) => t.startsWith('fb1554 '))?.slice(7) ?? ''
  if ((KNOWN_PASSING_CELLS[id] ?? []).includes(cell)) return
  test.fail(true, KNOWN[id])
}
const LIB = readFileSync(join(HERE, 'lib/fb1554-md-checks.js'), 'utf8')
const SSE = readFileSync(join(HERE, 'lib/fb1344-sse.js'), 'utf8')
const OFF = JSON.parse(readFileSync(join(HERE, 'fixtures/official-fb1554.json'), 'utf8'))

const boot = async (page: Page, theme: string, opts: { split?: boolean; staged?: boolean } = {}) => {
  await page.route('https://api.deepseek.com/**', async (route) => {
    const url = route.request().url()
    if (url.endsWith('/user/balance')) return route.fulfill({ json: { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '1', granted_balance: '0', topped_up_balance: '1' }] } })
    if (url.endsWith('/models')) return route.fulfill({ json: { data: [{ id: 'deepseek-flash' }] } })
    if (!url.includes('/messages')) return route.fulfill({ status: 404, json: {} })
    return route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse(events(JSON.parse(route.request().postData() || '{}'), { split: opts.split ?? true })) })
  })
  if (opts.staged) await page.addInitScript(SSE)
  await page.addInitScript((t) => localStorage.setItem('deepapi-theme', t), theme)
  await page.goto('/')
  await page.getByTestId('landing-send').click(); await page.getByTestId('key-input').fill('demo-local-key'); await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()
  await page.addStyleTag({ content: '*{transition-duration:0s!important;transition-delay:0s!important}' })
  for (const id of ['toggle-thinking', 'toggle-search']) { const c = (await page.getByTestId(id).getAttribute('class')) || ''; if (!c.includes('on')) await page.getByTestId(id).click() }
}
const ask = async (page: Page, text = '[筑衡测试] 长回答语料') => { await page.getByTestId('composer').fill(text); await page.getByTestId('send').click(); await page.getByTestId('assistant-text').first().waitFor(); await page.waitForTimeout(500) }
const md = async (page: Page, expectAll = true) => { await page.evaluate(LIB); return page.evaluate((x) => (window as any).__md('ours', x), expectAll ? EXPECT : null) }
const rules = (r: { fails: { rule: string }[] }) => [...new Set(r.fails.map((f) => f.rule))]
const titles = (page: Page) => page.evaluate(() => [...document.querySelectorAll('[data-testid=thinking] > button')].map((b) => (b.textContent || '').trim()))

for (const theme of ['light', 'dark']) for (const [w, h] of [[1440, 900], [390, 844]]) {
  test.describe(`fb1554 ${theme} ${w}`, () => {
    test.use({ viewport: { width: w, height: h }, colorScheme: theme as 'light' | 'dark', bypassCSP: true })
    test('corpus-structure', async ({ page }) => { knownFailure('fb1554-M1'); await boot(page, theme); await ask(page); const r = await md(page)
      expect(rules(r).filter((x) => ['one-markdown-root', 'count-topLevelP', 'count-li', 'count-table', 'count-tableRows', 'count-katex', 'cite-numbers', 'kinsoku-line-start'].includes(x))).toEqual([]) })
    test('corpus-no-literal', async ({ page }) => { knownFailure('fb1554-M1'); await boot(page, theme); await ask(page); expect((await md(page)).metrics.literal).toEqual([]) })
    test('cjk-strong-single-block', async ({ page }) => { knownFailure('fb1554-M2'); await boot(page, theme, { split: false }); await ask(page); const r = await md(page, false)
      expect(r.metrics.counts.strong).toEqual(EXPECT.strong); expect(r.metrics.literal).toEqual([]) })
    test('cite-inline-same-line', async ({ page }) => { if (w < 768) knownFailure('fb1554-M4'); await boot(page, theme); await ask(page); const r = await md(page)
      expect(r.fails.filter((f: { rule: string }) => f.rule === 'cite-inline-same-line')).toEqual([]) })
    test('browse-unique', async ({ page }) => { await boot(page, theme); await ask(page); const r = await md(page)
      expect(r.metrics.browse.count).toBe(EXPECT.browseLinks); expect(r.metrics.labels.browse).toBe(`浏览 ${EXPECT.browseLinks} 个页面`) })
    if (w === 1440) {
      const o = OFF.cells[theme]
      test('browse-style', async ({ page }) => { await boot(page, theme); await ask(page); const b = (await md(page)).metrics.browse
        expect(b.link).toEqual(o.browseLink); expect(b.icon).toEqual(o.browseIcon); expect(Math.abs(b.rowGap - o.browseItemGap)).toBeLessThanOrEqual(0.5) })
      test('cite-style', async ({ page }) => { await boot(page, theme); await ask(page); const m = (await md(page)).metrics
        for (const k of Object.keys(o.cite).filter((k) => !/Px$|PrevChar$/.test(k))) expect(m.citeStyle[k], k).toBe(o.cite[k])
        expect(Math.abs(m.cites[0].dyTop - o.cite.dyTopVsPrevChar)).toBeLessThanOrEqual(0.5); expect(Math.abs(m.cites[0].dxGap - o.cite.firstGapPx)).toBeLessThanOrEqual(0.5) })
      test('favicon-overlap', async ({ page }) => { await boot(page, theme); await ask(page); const m = (await md(page)).metrics
        expect(m.search.icon).toEqual(o.searchFavicon); expect(m.pill.icon).toEqual(o.pillFavicon) })
    }
    // 「用时 N 秒」：思考结束后冻结、刷新后不变、别的回答生成时不变
    test('thought-seconds-frozen', async ({ page }) => { knownFailure('fb1554-T1'); await boot(page, theme, { staged: true })
      await page.getByTestId('composer').fill('[筑衡测试] 用时'); await page.getByTestId('send').click(); await page.waitForFunction(() => (window as any).__sse.count() > 0)
      const ev = events({}); const iText = ev.findIndex((e: any) => e.type === 'content_block_start' && e.content_block.type === 'text')
      await page.evaluate((e) => (window as any).__sse.push(e), ev.slice(0, iText)); await page.waitForTimeout(1500)
      await page.evaluate((e) => (window as any).__sse.push(e), ev.slice(iText, iText + 2)); await page.waitForTimeout(300); const a = await titles(page)
      await page.waitForTimeout(2500); const b = await titles(page); expect(b).toEqual(a)
      await page.evaluate((e) => { (window as any).__sse.push(e); (window as any).__sse.end() }, ev.slice(iText + 2)); await page.waitForTimeout(500); const c = await titles(page)
      await page.reload(); await page.getByTestId('thinking').first().waitFor(); expect(await titles(page)).toEqual(c) })
    test('thought-seconds-isolated', async ({ page }) => { knownFailure('fb1554-T1'); await boot(page, theme, { staged: true }); const ev = events({})
      await page.getByTestId('composer').fill('[筑衡测试] 第一问'); await page.getByTestId('send').click(); await page.waitForFunction(() => (window as any).__sse.count() === 1)
      await page.evaluate((e) => { (window as any).__sse.push(e, 0); (window as any).__sse.end(0) }, ev); await page.waitForTimeout(600); const first = (await titles(page))[0]
      await page.getByTestId('composer').fill('[筑衡测试] 第二问'); await page.getByTestId('send').click(); await page.waitForFunction(() => (window as any).__sse.count() === 2)
      await page.evaluate((e) => (window as any).__sse.push(e.slice(0, 3), 1), ev); await page.waitForTimeout(3000)
      expect((await titles(page))[0]).toBe(first) })
  })
}
