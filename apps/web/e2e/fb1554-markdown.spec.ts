// fb1554: required CI gate for 昊辰 2026-11-20 15:54「还有一些样式有问题」（长回答 markdown）.
// Picked up by `pnpm e2e` (ci.yml) through apps/web/playwright.config.ts, same as fb1344-parity.spec.ts:
// testDir ./e2e, testMatch *.spec.ts. There is no second playwright config.
// Corpus and rules: e2e/fixtures/fb1554-corpus.ts, e2e/lib/fb1554-md-checks.js.
// Official numbers: e2e/fixtures/official-fb1554.json (frozen offline render; do not edit in feature PRs).
// sha256 b32ab0665cec907d32b99fc2bd1489ac7a65f4444d289447936f00a9f36b5442.
// Staged SSE reuses e2e/lib/fb1344-sse.js. The route mock matches fb1344 (balance, models, messages).
// 34 cases = 4 cells × 7 + 1440 × 3 × 2. Red cases on master are test.fail() via knownFailure().
// IDs still open: none. fb1554-M1 and fb1554-M2 are fixed. 390 的 cite-inline 已同行，不要再标 M4。T1 已随阶段标题删掉。A fix PR deletes only its own id.
// An unexpected pass fails the run. FB1554_STRICT=1 ignores knownFailure.
// FB1344_STRICT does not open this file: that switch is the fb1344 baseline.
import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { adjacentCitationEvents, events, sse, EXPECT } from './fixtures/fb1554-corpus'
const HERE = dirname(fileURLToPath(import.meta.url))

// 语料按真实接口形状把正文在引用处切成多个 text block。规则在冻结官方 DOM 上全绿。
// 已知失败用 knownFailure(id)。FB1554_STRICT=1 时全部按真失败跑。修好一项就删掉对应 id，过期的 id 会让 test.fail 变红。
// fb1554-M1 已修：一条回答一个 .prose。corpus-structure 不再标失败。
// fb1554-M2 已修：中文标点旁的 ** 会加粗。corpus-no-literal 与 cjk-strong-single-block 不再标失败。
// cite-inline-same-line 在 1440 和 390 都已同行，不要标失败，否则意外通过会让 CI 变红。cite-style 已对齐。
// fb1554-M5 已删：搜索行 favicon 重叠 4px（.thinking > button 不再漏到 button.favicons）。
// fb1554-T1 「用时 N 秒」已随阶段标题落地：秒数来自思考片段，正文阶段和刷新都不再按墙钟涨。key 已删，thought-seconds-* 必须真过。
const STRICT = process.env.FB1554_STRICT === '1'
const KNOWN: Record<string, string> = {}
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
  for (const id of ['toggle-thinking', 'toggle-search']) { if (!(await page.getByTestId(id).evaluate((node) => node.classList.contains('on')))) await page.getByTestId(id).click() }
}
const ask = async (page: Page, text = '[筑衡测试] 长回答语料') => { await page.getByTestId('composer').fill(text); await page.getByTestId('send').click(); await page.getByTestId('assistant-text').first().waitFor(); await page.waitForTimeout(500) }
const md = async (page: Page, expectAll = true) => { await page.evaluate(LIB); return page.evaluate((x) => (window as any).__md('ours', x), expectAll ? EXPECT : null) }
const rules = (r: { fails: { rule: string }[] }) => [...new Set(r.fails.map((f) => f.rule))]
const titles = (page: Page) => page.evaluate(() => [...document.querySelectorAll('[data-testid=thinking] > button')].map((b) => (b.textContent || '').trim()))

for (const theme of ['light', 'dark']) for (const [w, h] of [[1440, 900], [390, 844]]) {
  test.describe(`fb1554 ${theme} ${w}`, () => {
    test.use({ viewport: { width: w, height: h }, colorScheme: theme as 'light' | 'dark', bypassCSP: true })
    test('corpus-structure', async ({ page }) => { await boot(page, theme); await ask(page); const r = await md(page)
      expect(rules(r).filter((x) => ['one-markdown-root', 'count-topLevelP', 'count-li', 'count-table', 'count-tableRows', 'count-katex', 'cite-numbers', 'kinsoku-line-start'].includes(x))).toEqual([]) })
    test('corpus-no-literal', async ({ page }) => { await boot(page, theme); await ask(page); expect((await md(page)).metrics.literal).toEqual([]) })
    test('cjk-strong-single-block', async ({ page }) => { await boot(page, theme, { split: false }); await ask(page); const r = await md(page, false)
      expect(r.metrics.counts.strong).toEqual(EXPECT.strong); expect(r.metrics.literal).toEqual([]) })
    test('cite-inline-same-line', async ({ page }) => { await boot(page, theme); await ask(page); const r = await md(page)
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
      test('adjacent-citations', async ({ page }) => {
        await boot(page, theme)
        await page.unroute('https://api.deepseek.com/**')
        await page.route('https://api.deepseek.com/**', async (route) => {
          const url = route.request().url()
          if (url.endsWith('/user/balance')) return route.fulfill({ json: { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '1', granted_balance: '0', topped_up_balance: '1' }] } })
          if (url.endsWith('/models')) return route.fulfill({ json: { data: [{ id: 'deepseek-flash' }] } })
          if (!url.includes('/messages')) return route.fulfill({ status: 404, json: {} })
          return route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse(adjacentCitationEvents(JSON.parse(route.request().postData() || '{}'))) })
        })
        await ask(page, '[筑衡测试] 相邻引用')
        const gap = await page.evaluate(() => {
          const group = document.querySelector('[data-citation-group]')
          const cites = [...(group?.querySelectorAll('.cite') ?? [])]
          if (cites.length < 2) return null
          const a = cites[0].getBoundingClientRect()
          const b = cites[1].getBoundingClientRect()
          return { n: cites.length, gap: b.left - a.right, oneGroup: group === cites[1].parentElement }
        })
        expect(gap?.oneGroup).toBe(true)
        expect(gap?.n).toBe(2)
        expect(Math.abs((gap?.gap ?? 99) - 2)).toBeLessThanOrEqual(0.5)
      })
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

// 一行收成一组。组内相邻角标间距 2px：每个 .cite 的水平 margin 是 2px，.cite + .cite 把左间距清掉（SP-CITE-113）。
const cite = (url: string) => ({ type: 'web_search_result_location', url, title: 't', cited_text: '', encrypted_index: '' })
const groupEvents = () => {
  const results = [1, 2].map((n) => ({ type: 'web_search_result', title: `来源${n}`, url: `https://site${n}.example/g`, snippet: 's', site_name: `站${n}`, site_icon: null, page_age: null, encrypted_content: 'x' }))
  const mark = (url: string, index = 1) => ({ type: 'content_block_delta', index, delta: { type: 'citations_delta', citation: cite(url) } })
  const text = (value: string, index = 1) => ({ type: 'content_block_delta', index, delta: { type: 'text_delta', text: value } })
  return [
    { type: 'message_start', message: { id: 'g', model: 'deepseek-flash' } },
    { type: 'content_block_start', index: 0, content_block: { type: 'web_search_tool_result', tool_use_id: 's', content: results } },
    { type: 'content_block_stop', index: 0 },
    { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
    text('第一句。'), mark(results[0].url), text('第二句。'), mark(results[1].url),
    { type: 'content_block_stop', index: 1 },
    { type: 'content_block_start', index: 2, content_block: { type: 'thinking', thinking: '', signature: '' } },
    { type: 'content_block_delta', index: 2, delta: { type: 'thinking_delta', thinking: '想' } },
    { type: 'content_block_stop', index: 2 },
    { type: 'content_block_start', index: 3, content_block: { type: 'text', text: '' } },
    text('甲', 3), mark(results[0].url, 3), text('，乙。', 3), mark(results[1].url, 3),
    text('\n\n第一句', 3), mark(results[0].url, 3), text('\n第二句', 3),
    text('\n\n见**结论**', 3), mark(results[1].url, 3), text('。\n\n写完[c', 3),
    text('\n\n~~~\n[citation:1]\n~~~\n\n行内 \\(a+[citation:1]\\) 结束\n\n算式 $b+[citation:1]$ 完\n\n$$c+[citation:1]$$\n\n```\n[citation:1]\n', 3),
    { type: 'content_block_stop', index: 3 },
    { type: 'message_delta', delta: { stop_reason: 'end_turn', title: '组' }, usage: { input_tokens: 1, output_tokens: 1 } },
    { type: 'message_stop' },
  ]
}
test.describe('fb1554 citation group', () => {
  test.use({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', bypassCSP: true })
  test('line-groups-literals-and-gap', async ({ page }) => {
    await page.route('https://api.deepseek.com/**', async (route) => {
      const url = route.request().url()
      if (url.endsWith('/user/balance')) return route.fulfill({ json: { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '1', granted_balance: '0', topped_up_balance: '1' }] } })
      if (url.endsWith('/models')) return route.fulfill({ json: { data: [{ id: 'deepseek-flash' }] } })
      if (!url.includes('/messages')) return route.fulfill({ status: 404, json: {} })
      return route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse(groupEvents()) })
    })
    await page.addInitScript(() => localStorage.setItem('deepapi-theme', 'light'))
    await page.goto('/')
    await page.getByTestId('landing-send').click(); await page.getByTestId('key-input').fill('demo-local-key'); await page.getByTestId('key-save').click()
    await page.getByTestId('composer').fill('[筑衡测试] 引用组'); await page.getByTestId('send').click()
    await page.getByTestId('assistant-text').waitFor()
    const info = await page.getByTestId('assistant-text').evaluate((root) => {
      const side = (group: Element) => {
        const parent = group.parentElement
        let before = ''
        let after = ''
        let seen = false
        for (const node of parent?.childNodes ?? []) {
          if (node === group) { seen = true; continue }
          const value = node.textContent ?? ''
          if (seen) after += value
          else before += value
        }
        const badges = [...group.querySelectorAll(':scope > a.cite')]
        const style = getComputedStyle(group)
        const prev = before.trimEnd()
        const last = [...parent?.childNodes ?? []].filter((node) => node.compareDocumentPosition(group) & Node.DOCUMENT_POSITION_FOLLOWING && node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim()).pop()
        let firstGap: number | null = null
        if (badges[0] && last && last.nodeType === Node.TEXT_NODE && last.textContent) {
          const data = last.textContent
          const at = data.trimEnd().length - 1
          if (at >= 0) {
            const range = document.createRange()
            range.setStart(last, at)
            range.setEnd(last, at + 1)
            const box = range.getClientRects()[0]
            if (box) firstGap = badges[0].getBoundingClientRect().left - box.right
          }
        }
        const inner = badges.length >= 2 ? badges[1].getBoundingClientRect().left - badges[0].getBoundingClientRect().right : null
        return {
          cites: badges.map((node) => node.textContent),
          onlyAnchors: group.childElementCount > 0 && [...group.children].every((el) => el.tagName === 'A' && el.classList.contains('cite')),
          inStrong: Boolean(group.closest('strong')),
          before: prev,
          after,
          marginLeft: style.marginLeft,
          marginRight: style.marginRight,
          firstGap,
          inner,
          paragraph: [...root.querySelectorAll('p')].indexOf(parent as HTMLParagraphElement),
        }
      }
      const groups = [...root.querySelectorAll('[data-citation-group]')].map(side)
      const fence = [...root.querySelectorAll('pre')].map((node) => node.textContent ?? '')
      const math = [...root.querySelectorAll('.katex')].map((node) => ({
        error: node.classList.contains('katex-error') || Boolean(node.querySelector('.katex-error')),
        tex: node.querySelector('annotation')?.textContent ?? '',
        cite: Boolean(node.querySelector('.cite')),
      }))
      return {
        groups,
        fence,
        math,
        paren: (root.textContent ?? '').includes('行内') && (root.textContent ?? '').includes('[citation:1]'),
        privateUse: (root.textContent ?? '').includes('\uE000'),
        finished: (root.textContent ?? '').includes('写完[c'),
      }
    })
    expect(info.groups).toHaveLength(4)
    expect(info.groups.every((group) => group.onlyAnchors && !group.inStrong)).toBe(true)
    const [sentences, comma, soft, bold] = info.groups
    expect(sentences?.cites).toEqual(['1', '2'])
    expect(sentences?.before.includes('第一句。')).toBe(true)
    expect(sentences?.before.endsWith('第二句。')).toBe(true)
    expect(sentences?.after.trim()).toBe('')
    expect(comma?.cites).toEqual(['1', '2'])
    expect(comma?.before.endsWith('甲，乙。')).toBe(true)
    expect(comma?.paragraph).not.toBe(sentences?.paragraph)
    expect(sentences?.before.includes('甲')).toBe(false)
    expect(soft?.cites).toEqual(['1'])
    expect(soft?.before.includes('第一句')).toBe(true)
    expect(soft?.after.includes('第二句')).toBe(true)
    expect(bold?.cites).toEqual(['2'])
    expect(bold?.before.includes('结论')).toBe(true)
    expect(info.fence.some((code) => code.includes('[citation:1]'))).toBe(true)
    expect(info.fence.every((code) => !code.includes('\uE000'))).toBe(true)
    expect(info.paren).toBe(true)
    expect(info.privateUse).toBe(false)
    expect(info.math.length).toBeGreaterThan(0)
    expect(info.math.every((item) => !item.error && !item.cite)).toBe(true)
    expect(info.math.some((item) => item.tex.includes('[citation:1]'))).toBe(true)
    expect(info.finished).toBe(true)
    expect(sentences?.marginLeft).toBe('2px')
    expect(sentences?.marginRight).toBe('2px')
    expect(Math.abs((sentences?.inner ?? 99) - 2)).toBeLessThanOrEqual(0.5)
    expect(Math.abs((sentences?.firstGap ?? 99) - OFF.cells.light.cite.firstGapPx)).toBeLessThanOrEqual(0.5)
  })

  test('half-marker-only-while-streaming', async ({ page }) => {
    await page.route('https://api.deepseek.com/**', async (route) => {
      const url = route.request().url()
      if (url.endsWith('/user/balance')) return route.fulfill({ json: { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '1', granted_balance: '0', topped_up_balance: '1' }] } })
      if (url.endsWith('/models')) return route.fulfill({ json: { data: [{ id: 'deepseek-flash' }] } })
      if (!url.includes('/messages')) return route.fulfill({ status: 404, json: {} })
      return route.fulfill({ status: 404, json: {} })
    })
    await page.addInitScript(SSE)
    await page.addInitScript(() => localStorage.setItem('deepapi-theme', 'light'))
    await page.goto('/')
    await page.getByTestId('landing-send').click(); await page.getByTestId('key-input').fill('demo-local-key'); await page.getByTestId('key-save').click()
    await page.getByTestId('composer').fill('[筑衡测试] 半截'); await page.getByTestId('send').click()
    await page.waitForFunction(() => (window as any).__sse.count() === 1)
    const partial = [
      { type: 'message_start', message: { id: 'h', model: 'deepseek-flash' } },
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '答案[citation:' } },
    ]
    await page.evaluate((events) => (window as any).__sse.push(events), partial)
    await page.getByTestId('assistant-text').waitFor()
    await expect(page.getByTestId('assistant-text')).toHaveText('答案')
    await page.evaluate(() => (window as any).__sse.end())
    await expect(page.getByTestId('assistant-text')).toContainText('[citation:')
  })
})
