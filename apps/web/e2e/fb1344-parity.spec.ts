// fb1344: required CI parity gate for 昊辰 2026-11-20 13:44 / 14:05 feedback (样式、不居中、分享、流式阶段).
// Picked up by `pnpm e2e` (ci.yml) through apps/web/playwright.config.ts, same as interaction-gate.spec.ts:
// testDir ./e2e, testMatch *.spec.ts. playwright.fb1344.config.ts is not a second runner.
// Official numbers: e2e/fixtures/official-fb1344.json (BASELINE, frozen from the official DOM+CSS; do not edit in feature PRs).
// Failures measured on master 4734e7f are test.fail() via knownFailure(). IDs are fb1344-P1 … fb1344-P7,
// one prefix per fix PR. Each fix PR deletes its own lines. An unexpected pass fails the run.
// FB1344_STRICT=1 ignores knownFailure (used to prove the red on master). There is no test.skip except the desktop-only tooltip.
import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const HERE = dirname(fileURLToPath(import.meta.url))
const OFF = JSON.parse(readFileSync(join(HERE, 'fixtures/official-fb1344.json'), 'utf8'))
const LIB = readFileSync(join(HERE, 'lib/fb1344-measure.js'), 'utf8') + ';\n' + readFileSync(join(HERE, 'lib/fb1344-components.js'), 'utf8')
const SSE = readFileSync(join(HERE, 'lib/fb1344-sse.js'), 'utf8')
const STRICT = process.env.FB1344_STRICT === '1'

// 在 master 4734e7f 上会失败的用例。修复 PR 删掉自己那几条；修好了却没删，会因为意外通过让 CI 变红。
// fb1344-P2 回答底部：pill-geometry、pill-bg-dark、action-color-dark、share-tooltip。
// fb1344-P3 设置行内按钮（含 label/file-input）：settings-buttons、centring-scan（导入 label |dx|>1）。
// fb1344-P5 流式阶段标题和 shimmer：phase-thinking、phase-searching、phase-browsing。phase-done 在 master 已通过，不要标失败。
// fb1344-P6 并发生成：concurrent-send。
// fb1344-P7 分享选择模式不在本文件。interaction-gate.spec.ts 里已有分享 knownFailure，本 PR 不改那个 spec。
const KNOWN: Record<string, string> = {
  // fb1344-P2 回答底部（胶囊几何、深色底色、深色操作栏、hover tooltip）
  'pill-geometry': 'fb1344-P2: 来源胶囊高 32.1 / 左内边距 6，官方 34 / 4',
  'pill-bg-dark': 'fb1344-P2: 深色来源胶囊底色 rgb(44,44,46)，官方 rgb(21,21,23)',
  'action-color-dark': 'fb1344-P2: 深色操作栏图标色 rgb(129,133,140)，官方 rgb(173,178,184)',
  'share-tooltip': 'fb1344-P2: 操作栏 tooltip 在按钮上方且无箭头，官方 placement bottom',
  // fb1344-P3 设置行内按钮，label/file-input 也算按钮；居中误差 >1px
  'settings-buttons': 'fb1344-P3: 设置行内按钮：导入是 label 72×40 文字偏 9px；全部按钮 padding 12px（官方 14px），深色边框 .16（官方 .12）',
  'centring-scan': 'fb1344-P3: 全站居中扫描：导入 label |dx|>1。用户行不在这次扫描里，归 fb1344-P4 的 user-row-centre',
  // fb1344-P5 分阶段 SSE：正在思考 / 正在搜索 / 正在浏览网页
  'phase-thinking': 'fb1344-P5: 流式中标题一直是「已思考（用时 N 秒）」，没有「正在思考」与 shimmer',
  'phase-searching': 'fb1344-P5: 搜索进行中无「正在搜索」标题，也没有进行中的搜索行',
  'phase-browsing': 'fb1344-P5: 浏览进行中无「正在浏览网页」',
  // fb1344-P6 另一会话生成中再发送
  'concurrent-send': 'fb1344-P6: 另一会话生成中时新会话的发送键是停止键，点击会中断第一条；没有「有消息正在生成，请稍后再试」',
}
// Cells where master already matches (an expected failure that passes would fail the run).
const KNOWN_PASSING_CELLS: Record<string, string[]> = {}
const knownFailure = (id: string) => {
  if (STRICT || !KNOWN[id]) return
  const cell = test.info().titlePath.find((t) => t.startsWith('fb1344 '))?.slice(7) ?? ''
  if ((KNOWN_PASSING_CELLS[id] ?? []).includes(cell)) return
  test.fail(true, KNOWN[id])
}

const sse = (events: unknown[]) => events.map((e) => `event: ${(e as { type: string }).type}\ndata: ${JSON.stringify(e)}\n\n`).join('')
const ICON = (c: string) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" rx="3" fill="${c}"/></svg>`)
const RESULTS = Array.from({ length: 17 }, (_, i) => ({ type: 'web_search_result', title: `来源 ${i + 1}`, url: `https://site${i + 1}.example/a`, snippet: `摘要 ${i + 1}`, site_name: `站点${i + 1}`, site_icon: ICON(`hsl(${i * 21} 70% 50%)`), page_age: '2026-11-19T00:00:00Z', encrypted_content: 'x' }))
const PH = {
  thinking: [{ type: 'message_start', message: { id: 'r', model: 'deepseek-flash' } }, { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } }, { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: '用户想知道今天上海的天气。' } }],
  searching: [{ type: 'content_block_stop', index: 0 }, { type: 'content_block_start', index: 1, content_block: { type: 'server_tool_use', id: 's1', name: 'deepseek_web_search', input: { action: 'search', queries: ['上海今日天气'] } } }, { type: 'content_block_stop', index: 1 }],
  browsing: [{ type: 'content_block_start', index: 2, content_block: { type: 'web_search_tool_result', tool_use_id: 's1', content: RESULTS } }, { type: 'content_block_stop', index: 2 }, { type: 'content_block_start', index: 3, content_block: { type: 'server_tool_use', id: 'f0', name: 'deepseek_web_fetch', input: { action: 'open_page', url: RESULTS[0].url } } }, { type: 'content_block_stop', index: 3 }],
  answer: [{ type: 'content_block_start', index: 4, content_block: { type: 'text', text: '' } }, { type: 'content_block_delta', index: 4, delta: { type: 'text_delta', text: '今天上海降温。' } }, { type: 'content_block_stop', index: 4 }, { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null, title: '流式' }, usage: { input_tokens: 1, output_tokens: 1 } }, { type: 'message_stop' }],
}
const whole = (req: { thinking?: { type?: string }; tools?: { name?: string }[] }) => {
  const ev: unknown[] = [...PH.thinking, ...PH.searching, ...PH.browsing, ...PH.answer]
  return sse(req.tools?.some((t) => /search/.test(t.name || '')) ? ev : [PH.thinking[0], ...PH.answer])
}
const boot = async (page: Page, theme: string, staged = false) => {
  await page.route('https://api.deepseek.com/**', async (route) => {
    const url = route.request().url()
    if (url.endsWith('/user/balance')) return route.fulfill({ json: { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '1', granted_balance: '0', topped_up_balance: '1' }] } })
    if (url.endsWith('/models')) return route.fulfill({ json: { data: [{ id: 'deepseek-flash' }] } })
    if (!url.includes('/messages')) return route.fulfill({ status: 404, json: {} })
    return route.fulfill({ status: 200, contentType: 'text/event-stream', body: whole(JSON.parse(route.request().postData() || '{}')) })
  })
  if (staged) await page.addInitScript(SSE)
  await page.addInitScript((t) => localStorage.setItem('deepapi-theme', t), theme)
  await page.goto('/')
  await page.getByTestId('landing-send').click(); await page.getByTestId('key-input').fill('demo-local-key'); await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()
  await page.addStyleTag({ content: '*{transition-duration:0s!important;transition-delay:0s!important}' })
}
const chip = async (page: Page, id: string, on: boolean) => { const c = (await page.getByTestId(id).getAttribute('class')) || ''; if (c.includes('on') !== on) await page.getByTestId(id).click() }
const ask = async (page: Page) => { await chip(page, 'toggle-thinking', true); await chip(page, 'toggle-search', true); await page.getByTestId('composer').fill('[筑衡测试] 上海天气'); await page.getByTestId('send').click(); await page.getByTestId('assistant-text').last().waitFor(); await page.waitForTimeout(300) }
const comp = async (page: Page) => { await page.evaluate(LIB); return page.evaluate(() => (window as any).__comp('ours')) }
const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1440) < 768
const drawer = async (page: Page) => { if (isMobile(page) && !(await page.locator('.nav-open').count())) { await page.getByTestId('menu').click(); await page.waitForTimeout(400) } }
const settings = async (page: Page, tab?: string) => { await drawer(page); await page.getByTestId('user-menu').click(); await page.getByTestId('settings-open').click(); await page.getByRole('button', { name: '通用设置' }).waitFor(); if (tab) await page.getByRole('button', { name: tab }).click(); await page.waitForTimeout(200) }

for (const theme of ['light', 'dark']) for (const [w, h] of [[1440, 900], [390, 844]]) {
  const cell = OFF.cells[`${theme}|${w}x${h}`]; const K = OFF.constants
  test.describe(`fb1344 ${theme} ${w}`, () => {
    test.use({ viewport: { width: w, height: h }, colorScheme: theme as 'light' | 'dark', bypassCSP: true })
    test('think-lead-icon', async ({ page }) => { knownFailure('think-lead-icon'); await boot(page, theme); await ask(page); const c = await comp(page)
      expect(c.thinkHead.iconLead.dHash).toBe(cell.thinkLeadHash); expect(c.thinkHead.iconLead.fill).toBe(cell.thinkLeadFill) })
    test('think-chevron', async ({ page }) => { knownFailure('think-chevron'); await boot(page, theme); await ask(page); const c = await comp(page)
      expect(c.thinkHead.iconChevron.dir).toBe('down'); expect(c.thinkHead.iconChevron.box.w).toBe(cell.thinkChevronW) })
    test('think-label-color', async ({ page }) => { knownFailure('think-label-color'); await boot(page, theme); await ask(page); const c = await comp(page)
      expect([c.thinkHead.label.cs['font-size'], c.thinkHead.label.cs['line-height']]).toEqual(cell.thinkLabelFont); expect(c.thinkHead.label.cs.color).toBe(cell.thinkLabelColor) })
    test('search-icon-size', async ({ page }) => { knownFailure('search-icon-size'); await boot(page, theme); await ask(page); const c = await comp(page)
      expect(c.searchRow.icon.dHash).toBe(cell.searchIconHash); expect(c.searchRow.icon.box.w).toBe(cell.searchIconW); expect(c.searchRow.labelCs.color).toBe(cell.searchColor) })
    test('browse-icon', async ({ page }) => { knownFailure('browse-icon'); await boot(page, theme); await ask(page); const c = await comp(page)
      expect(c.browseRow.icon.dHash).toBe(cell.browseIconHash); expect(c.browseRow.icon.box.w).toBe(cell.browseIconW) })
    test('pill-geometry', async ({ page }) => { knownFailure('pill-geometry'); await boot(page, theme); await ask(page); const c = await comp(page)
      expect(Math.abs(c.pill.box.h - cell.pillH)).toBeLessThanOrEqual(0.5); expect([c.pill.cs['padding-left'], c.pill.cs['padding-right']]).toEqual(cell.pillPad)
      expect(c.pill.border.color).toBe(cell.pillBorder); expect(Math.abs(c.pill.contentOff.dx)).toBeLessThanOrEqual(1); expect(Math.abs(c.pill.contentOff.dy)).toBeLessThanOrEqual(1) })
    test('pill-bg', async ({ page }) => { if (theme === 'dark') knownFailure('pill-bg-dark'); await boot(page, theme); await ask(page); const c = await comp(page); expect(c.pill.bg).toBe(cell.pillBg) })
    test('action-icons', async ({ page }) => { if (theme === 'dark') knownFailure('action-color-dark'); await boot(page, theme); await ask(page); const c = await comp(page)
      expect(c.actions.buttons.map((b: any) => b.color)).toEqual(Array(c.actions.n).fill(cell.actionColor)); expect(c.actions.buttons.map((b: any) => b.svg.dHash)).toEqual(cell.actionHashes) })
    test('share-tooltip', async ({ page }) => { test.skip(w < 768, 'hover tooltip is desktop only'); knownFailure('share-tooltip'); await boot(page, theme); await ask(page)
      const b = page.locator('.action-row button[aria-label="分享"]').last(); await b.hover(); await page.waitForTimeout(400)
      const tip = page.getByRole('tooltip').filter({ hasText: '分享' }); const bb = (await b.boundingBox())!
      // the tooltip must be a real element (role=tooltip) below the button, like the official ds-tooltip placement:"bottom"
      await expect(tip).toBeVisible(); const tb = (await tip.boundingBox())!; expect(tb.y).toBeGreaterThan(bb.y + bb.height - 1) })
    test('settings-buttons', async ({ page }) => { knownFailure('settings-buttons'); await boot(page, theme)
      const bad: string[] = []
      for (const tab of [undefined, '账号管理', '数据管理']) { await settings(page, tab); await page.evaluate(LIB)
        const bs = (await page.evaluate(() => (window as any).__settingsButtons())).filter((b: any) => b.box.h <= 40)
        const right = Math.max(...bs.map((b: any) => b.right))
        for (const b of bs) { const e: string[] = []
          if (Math.abs(b.box.h - K.settingsButton.h) > 0.5) e.push(`h=${b.box.h}`); if (b.box.w < K.settingsButton.minW - 0.5) e.push(`w=${b.box.w}`)
          if (b.cs['padding-left'] !== K.settingsButton.padX || b.cs['padding-right'] !== K.settingsButton.padX) e.push(`pad=${b.cs['padding-left']}`)
          if (![K.settingsButton.border[theme], 'rgb(236, 19, 19)'].includes(b.border.color)) e.push(`border=${b.border.color}`)
          if (!b.textOff || Math.abs(b.textOff.dx) > 1 || Math.abs(b.textOff.dy) > 1) e.push(`textOff=${JSON.stringify(b.textOff)}`)
          if (Math.abs(b.right - right) > 1) e.push(`right=${b.right}≠${right}`)
          if (e.length) bad.push(`${tab ?? '通用设置'}/${b.row}/${b.text}: ${e.join(' ')}`) }
        await page.keyboard.press('Escape'); await page.waitForTimeout(200) }
      expect(bad).toEqual([]) })
    test('user-row-centre', async ({ page }) => { knownFailure('user-row-centre'); await boot(page, theme); await drawer(page); const u = (await comp(page)).userRow
      for (const [k, v] of [['avatar', u.avatar.inRowOff.dy], ['avatarGlyph', u.avatar.glyphOff.dy], ['name', u.name.inRowOff.dy], ['more', u.more.inRowOff.dy]]) expect(Math.abs(v as number), k as string).toBeLessThanOrEqual(1)
      expect(u.avatar.cs['font-weight']).toBe(cell.avatarWeight); expect(u.avatar.cs.color).toBe(cell.avatarColor) })
    test('centring-scan', async ({ page }) => { knownFailure('centring-scan'); await boot(page, theme); await ask(page)
      const bad: string[] = []
      const scan = async (where: string) => { await page.evaluate(LIB); const r = await page.evaluate(() => (window as any).__m.centering())
        for (const e of r) if ((e.dy !== null && Math.abs(e.dy) > 1) || (e.dx !== null && Math.abs(e.dx) > 1)) bad.push(`${where} ${e.el} 「${e.text}」 dx=${e.dx} dy=${e.dy}`) }
      await scan('answer'); await drawer(page); await scan('sidebar')
      for (const tab of [undefined, '账号管理', '数据管理', '服务协议']) { await settings(page, tab); await scan(`settings-${tab ?? '通用设置'}`); await page.keyboard.press('Escape'); await page.waitForTimeout(200) }
      expect(bad).toEqual([]) })
    // ---- streaming phases (staged SSE held at each phase)
    const staged = async (page: Page) => { await boot(page, theme, true); await chip(page, 'toggle-thinking', true); await chip(page, 'toggle-search', true)
      await page.getByTestId('composer').fill('[筑衡测试] 流式'); await page.getByTestId('send').click(); await page.waitForFunction(() => (window as any).__sse.count() > 0) }
    const push = (page: Page, ev: unknown[]) => page.evaluate((e) => (window as any).__sse.push(e), ev)
    const head = (page: Page) => page.getByTestId('thinking').last().locator('button').first()
    const shimmer = (page: Page) => head(page).evaluate((h) => [...h.querySelectorAll('*')].map((e) => getComputedStyle(e)).filter((s) => s.animationName !== 'none' && s.animationIterationCount === 'infinite').map((s) => ({ d: s.animationDuration, t: s.animationTimingFunction })))
    test('phase-thinking', async ({ page }) => { knownFailure('phase-thinking'); await staged(page); await push(page, PH.thinking); await page.waitForTimeout(1200)
      await expect(head(page)).toHaveText(K.phaseTitles.thinking); expect(await shimmer(page)).toContainEqual({ d: K.shimmer.duration, t: K.shimmer.timing }) })
    test('phase-searching', async ({ page }) => { knownFailure('phase-searching'); await staged(page); await push(page, PH.thinking); await push(page, PH.searching); await page.waitForTimeout(500)
      await expect(head(page)).toHaveText(K.phaseTitles.searching); expect((await shimmer(page)).length).toBeGreaterThan(0) })
    test('phase-browsing', async ({ page }) => { knownFailure('phase-browsing'); await staged(page); for (const p of [PH.thinking, PH.searching, PH.browsing]) await push(page, p); await page.waitForTimeout(500)
      await expect(head(page)).toHaveText(K.phaseTitles.browsing) })
    test('phase-done', async ({ page }) => { await staged(page); for (const p of [PH.thinking, PH.searching, PH.browsing, PH.answer]) await push(page, p); await page.evaluate(() => (window as any).__sse.end()); await page.waitForTimeout(500)
      await expect(head(page)).toHaveText(new RegExp(K.phaseTitles.done)); expect(await shimmer(page)).toEqual([]) })
    test('concurrent-send', async ({ page }) => { knownFailure('concurrent-send'); await staged(page); await push(page, PH.thinking); await page.waitForTimeout(300)
      await drawer(page); await page.getByTestId('new-chat').click(); await page.waitForTimeout(300); if (isMobile(page) && (await page.locator('.nav-open').count())) await page.keyboard.press('Escape')
      await page.getByTestId('composer').fill('[筑衡测试] 第二条'); await page.locator('[data-testid=send], [data-testid=stop]').first().click(); await page.waitForTimeout(500)
      expect(await page.evaluate(() => (window as any).__sse.aborted.includes(0)), 'first reply must keep generating').toBe(false)
      await expect(page.getByText(K.busyHint)).toBeVisible() })
  })
}
