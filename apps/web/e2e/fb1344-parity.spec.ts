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
// fb1344-P5 流式阶段标题和 shimmer：phase-thinking、phase-searching、phase-browsing 已落地。phase-done 保持通过。
// fb1344-P6 并发生成：concurrent-send。
// fb1344-P7 分享选择模式不在本文件。interaction-gate.spec.ts 里已有分享 knownFailure，本 PR 不改那个 spec。
const KNOWN: Record<string, string> = {
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
const idbMessages = (page: Page) => page.evaluate(async () => {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('deepapi')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  const rows = await new Promise<Array<{ role: string; status: string; blocks: Array<{ type: string; text?: string }> }>>((resolve) => {
    const request = db.transaction('messages', 'readonly').objectStore('messages').getAll()
    request.onsuccess = () => resolve(request.result as Array<{ role: string; status: string; blocks: Array<{ type: string; text?: string }> }>)
  })
  db.close()
  return rows
})
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
      expect(c.actions.buttons.map((b: any) => b.color)).toEqual(Array(c.actions.n).fill(cell.actionColor))
      // V05/V06 read-aloud inserts IconPlayMediaOutline16 (d886c2b) between 不喜欢 and 分享.
      // The other five hashes stay on the frozen official list. official-fb1344.json is unchanged.
      const labels = c.actions.buttons.map((b: { label: string }) => b.label)
      expect(labels).toEqual(['复制', '重新生成', '喜欢', '不喜欢', '朗读', '分享'])
      const hashes = c.actions.buttons.map((b: { svg: { dHash: string } }) => b.svg.dHash)
      expect(hashes.filter((_: string, index: number) => labels[index] !== '朗读')).toEqual(cell.actionHashes)
      expect(hashes[labels.indexOf('朗读')]).toBe('d886c2b') })
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
          // Danger border is not in fixtures/official-fb1344.json. Frozen main.dc093a796f.css is a single line (line 1):
          // .ds-button.ds-button--outlined.ds-button--error { --dsl-button-border-color: var(--dsw-alias-state-error-primary) }
          // light: --dsw-alias-state-error-primary: var(--dsw-static-red-600); --dsw-static-red-600:#ec1313 → rgb(236, 19, 19)
          // dark body[data-ds-dark-theme]: --dsw-alias-state-error-primary: var(--dsw-static-red-400); --dsw-static-red-400:#f25a5a → rgb(242, 90, 90)
          if (![K.settingsButton.border[theme], theme === 'dark' ? 'rgb(242, 90, 90)' : 'rgb(236, 19, 19)'].includes(b.border.color)) e.push(`border=${b.border.color}`)
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
    test('phase-live', async ({ page }) => {
      const lead = cell.thinkLeadFill
      const label = cell.thinkLabelColor
      const dot = theme === 'dark' ? 'rgb(173, 178, 184)' : 'rgb(129, 133, 140)'
      const stopBg = theme === 'dark' ? 'rgb(86, 134, 254)' : 'rgb(57, 100, 254)'
      const capsule = theme === 'dark' ? 'rgb(67, 69, 74)' : 'rgb(255, 255, 255)'
      const capsuleBorder = theme === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)'
      const sweep = async () => head(page).evaluate((h) => [...h.querySelectorAll('*')].map((e) => getComputedStyle(e)).filter((s) => s.animationIterationCount === 'infinite' && s.animationName !== 'none').map((s) => ({ name: s.animationName, d: s.animationDuration, t: s.animationTimingFunction })))
      const bar = async () => head(page).locator('.phase-shimmer-bar').evaluate((e) => getComputedStyle(e).backgroundImage)
      await staged(page)
      await expect(page.getByTestId('reply-dots').locator('i')).toHaveCount(3)
      await expect(page.getByTestId('reply-dots').locator('i').first()).toHaveCSS('background-color', dot)
      await expect(page.getByTestId('stop').locator('.send-spinner')).toBeVisible()
      await expect(page.getByTestId('stop').locator('.stop-square')).toHaveCount(0)
      await expect(page.getByTestId('thinking')).toHaveCount(0)
      const spin = await page.getByTestId('stop').locator('.send-spinner').evaluate((e) => getComputedStyle(e).animationName)
      expect(spin).toBe('send-spin')
      await push(page, PH.thinking)
      await expect(head(page)).toHaveText(K.phaseTitles.thinking)
      await expect(head(page).locator('.phase-label')).toHaveCSS('color', label)
      expect(await sweep()).toContainEqual({ name: '_5a7d2fc', d: K.shimmer.duration, t: K.shimmer.timing })
      await expect(head(page).locator('.phase-shimmer-bar')).toHaveCSS('width', '120px')
      expect(await bar()).toContain('109.02%')
      expect(await bar()).toContain(theme === 'dark' ? 'rgba(21, 21, 23, 0.5)' : 'rgba(255, 255, 255, 0.7)')
      let c = await comp(page)
      expect(c.thinkHead.iconLead.dHash).toBe(cell.thinkLeadHash)
      expect(c.thinkHead.iconLead.fill).toBe(lead)
      expect(c.thinkHead.iconChevron.dir).toBe('down')
      const stopBtn = page.getByTestId('stop')
      await expect(stopBtn).toHaveAttribute('aria-label', '停止生成')
      await expect(stopBtn).toHaveAttribute('data-tip', '停止生成')
      await expect(stopBtn.locator('.stop-square')).toBeVisible()
      await expect(stopBtn).toHaveCSS('background-color', stopBg)
      await expect(stopBtn.locator('.stop-square rect')).toHaveCSS('fill', 'rgb(255, 255, 255)')
      await push(page, PH.searching)
      await expect(head(page)).toHaveText(K.phaseTitles.searching)
      await expect(page.getByTestId('search-pending')).toHaveText('搜索')
      expect((await sweep()).length).toBeGreaterThan(0)
      await push(page, PH.browsing)
      await expect(head(page)).toHaveText(K.phaseTitles.browsing)
      await expect(page.getByTestId('search-pending')).toHaveCount(0)
      await expect(page.locator('.timeline-search').last()).toContainText('搜索到 17 个网页')
      await expect(page.locator('.timeline-browse').last()).toContainText('浏览 1 个页面')
      expect(await sweep()).toContainEqual({ name: '_5a7d2fc', d: K.shimmer.duration, t: K.shimmer.timing })
      await stopBtn.click()
      await expect(head(page)).toHaveText('已停止')
      expect(await sweep()).toEqual([])
      await expect(page.getByTestId('thinking')).toContainText('用户想知道今天上海的天气')
      c = await comp(page)
      expect(c.thinkHead.iconLead.dHash).toBe(cell.thinkLeadHash)
      expect(c.thinkHead.iconLead.fill).toBe(dot)
      expect(c.thinkHead.iconChevron.dir).toBe('down')
      const below = await page.evaluate(() => {
        const body = document.querySelector('.thinking-body')!.getBoundingClientRect()
        const row = document.querySelector('.action-row')!.getBoundingClientRect()
        return row.top >= body.bottom - 1
      })
      expect(below).toBe(true)
      const cont = page.getByTestId('continue')
      await expect(cont).toHaveText('继续生成')
      await expect(cont).toHaveCSS('background-color', capsule)
      await expect(cont).toHaveCSS('border-top-color', capsuleBorder)
      const edge = await page.evaluate(() => {
        const row = document.querySelector('.action-row')!.getBoundingClientRect()
        const button = document.querySelector('[data-testid=continue]')!.getBoundingClientRect()
        return { gap: row.right - button.right, left: button.left - row.left }
      })
      expect(Math.abs(edge.gap)).toBeLessThanOrEqual(2)
      expect(edge.left).toBeGreaterThan(40)
    })
    test('phase-revisit', async ({ page }) => {
      const noDone = async () => {
        const titles = await page.locator('[data-testid=thinking] button').allTextContents()
        expect(titles.join('\n')).not.toContain('已思考')
      }
      const liveHead = async () => {
        await expect(head(page)).toHaveText(K.phaseTitles.thinking)
        await expect(page.getByTestId('thinking').last()).toHaveAttribute('data-phase', 'thinking')
        expect(await shimmer(page)).toContainEqual({ d: K.shimmer.duration, t: K.shimmer.timing })
        const names = await head(page).evaluate((node) => [...node.querySelectorAll('*')].map((el) => getComputedStyle(el).animationName))
        expect(names).toContain('_5a7d2fc')
        await noDone()
      }
      await staged(page)
      await noDone()
      await push(page, [PH.thinking[0]])
      await noDone()
      await push(page, [PH.thinking[1]])
      await liveHead()
      await push(page, [PH.thinking[2]])
      await liveHead()
      await push(page, [{ type: 'content_block_stop', index: 0 }])
      await liveHead()
      await drawer(page)
      await page.getByTestId('new-chat').click()
      await page.waitForTimeout(200)
      if (isMobile(page) && (await page.locator('.nav-open').count())) await page.keyboard.press('Escape')
      await drawer(page)
      await page.locator('.chat-link').first().click()
      if (isMobile(page) && (await page.locator('.nav-open').count())) await page.keyboard.press('Escape')
      await liveHead()
      await page.waitForFunction(async (snippet) => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('deepapi')
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })
        const rows = await new Promise<Array<{ status: string; blocks: unknown }>>((resolve) => {
          const request = db.transaction('messages', 'readonly').objectStore('messages').getAll()
          request.onsuccess = () => resolve(request.result as Array<{ status: string; blocks: unknown }>)
        })
        db.close()
        return rows.some((row) => row.status === 'streaming' && JSON.stringify(row.blocks).includes(String(snippet)))
      }, '用户想知道今天上海的天气')
      await page.reload()
      // Local refresh kills the fetch. A streaming row left in IndexedDB is the stopped state.
      await expect(head(page)).toHaveText('已停止')
      await expect(page.getByTestId('thinking').last()).toHaveAttribute('data-phase', 'stopped')
      expect(await shimmer(page)).toEqual([])
      await expect(page.getByTestId('continue')).toHaveText('继续生成')
      await expect(page.getByTestId('thinking')).toContainText('用户想知道今天上海的天气')
      await noDone()
    })
    test('phase-tool-titles', async ({ page }) => {
      const fetchResult = (id: string, index: number) => [{ type: 'content_block_start', index, content_block: { type: 'web_fetch_tool_result', tool_use_id: id, content: { type: 'web_fetch_result', url: RESULTS[0].url, content: { title: '上海' } } } }, { type: 'content_block_stop', index }]
      await staged(page)
      await push(page, PH.thinking)
      await push(page, PH.searching)
      await expect(head(page)).toHaveText(K.phaseTitles.searching)
      await push(page, [PH.browsing[0], PH.browsing[1]])
      await expect(head(page)).toHaveText(K.phaseTitles.thinking)
      await push(page, [PH.browsing[2], PH.browsing[3]])
      await expect(head(page)).toHaveText(K.phaseTitles.browsing)
      await push(page, fetchResult('f0', 8))
      await expect(head(page)).toHaveText(K.phaseTitles.thinking)
      await push(page, [{ type: 'content_block_start', index: 9, content_block: { type: 'server_tool_use', id: 'g0', name: 'deepseek_web_fetch', input: { action: 'find_in_page', url: RESULTS[0].url, pattern: '气温' } } }, { type: 'content_block_stop', index: 9 }])
      await expect(head(page)).toHaveText(K.phaseTitles.browsing)
      await expect(head(page)).not.toHaveText('正在查找')
      await push(page, fetchResult('g0', 10))
      await expect(head(page)).toHaveText(K.phaseTitles.thinking)
    })
    test('phase-shimmer-sweep', async ({ page }) => {
      const sample = () => head(page).locator('.phase-shimmer-sweep').evaluate((node) => {
        const title = (node.parentElement ?? node).getBoundingClientRect()
        const anim = node.getAnimations().find((item) => item instanceof CSSAnimation)
        const points = [0, 0.45, 0.9]
        return points.map((p) => {
          if (anim) anim.currentTime = p * 2000
          const sweep = node.getBoundingClientRect()
          const bar = node.querySelector('.phase-shimmer-bar')?.getBoundingClientRect()
          const matrix = new DOMMatrix(getComputedStyle(node).transform)
          return {
            p,
            tx: matrix.m41,
            sweep: sweep.width,
            barLeft: bar?.left ?? 0,
            barRight: bar?.right ?? 0,
            titleLeft: title.left,
            titleRight: title.right,
          }
        })
      })
      const expectSweep = (frames: Awaited<ReturnType<typeof sample>>) => {
        expect(frames).toHaveLength(3)
        expect(Math.abs(frames[0].sweep - 136)).toBeLessThanOrEqual(1)
        expect(Math.abs(frames[0].tx + frames[0].sweep)).toBeLessThanOrEqual(1)
        expect(Math.abs(frames[2].tx - frames[2].sweep)).toBeLessThanOrEqual(1)
        expect(frames[0].barRight).toBeLessThanOrEqual(frames[0].titleLeft + 1)
        expect(frames[2].barLeft).toBeGreaterThanOrEqual(frames[2].titleRight - 1)
      }
      await staged(page)
      await push(page, PH.thinking)
      await expect(head(page)).toHaveText(K.phaseTitles.thinking)
      expectSweep(await sample())
      await push(page, PH.searching)
      await expect(head(page)).toHaveText(K.phaseTitles.searching)
      expectSweep(await sample())
      await push(page, PH.browsing)
      await expect(head(page)).toHaveText(K.phaseTitles.browsing)
      expectSweep(await sample())
    })
    test('phase-persist', async ({ page }) => {
      await page.addInitScript(() => {
        const orig = IDBObjectStore.prototype.put
        const bag = { n: 0 }
        ;(window as unknown as { __msgPuts: { n: number } }).__msgPuts = bag
        IDBObjectStore.prototype.put = function (this: IDBObjectStore, ...args: unknown[]) {
          if (this.name === 'messages') bag.n += 1
          return orig.apply(this, args as never)
        }
      })
      await staged(page)
      await push(page, PH.thinking)
      await page.waitForTimeout(250)
      const base = await page.evaluate(() => (window as unknown as { __msgPuts: { n: number } }).__msgPuts.n)
      const deltas = Array.from({ length: 24 }, (_, i) => ({ type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: `第${i}句。` } }))
      await push(page, deltas)
      await page.waitForTimeout(40)
      const burst = await page.evaluate(() => (window as unknown as { __msgPuts: { n: number } }).__msgPuts.n) - base
      expect(burst).toBeLessThanOrEqual(3)
      const wroteAt = Date.now()
      await expect.poll(async () => page.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('deepapi')
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })
        const rows = await new Promise<unknown[]>((resolve) => {
          const request = db.transaction('messages', 'readonly').objectStore('messages').getAll()
          request.onsuccess = () => resolve(request.result as unknown[])
        })
        db.close()
        return JSON.stringify(rows).includes('第23句')
      }), { timeout: 700 }).toBe(true)
      expect(Date.now() - wroteAt).toBeLessThan(500)
      const landed = await page.evaluate(async () => {
        const start = performance.now()
        ;(document.querySelector('[data-testid=stop]') as HTMLButtonElement).click()
        while (performance.now() - start < 180) {
          const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open('deepapi')
            request.onsuccess = () => resolve(request.result)
            request.onerror = () => reject(request.error)
          })
          const rows = await new Promise<Array<{ status: string }>>((resolve) => {
            const request = db.transaction('messages', 'readonly').objectStore('messages').getAll()
            request.onsuccess = () => resolve(request.result as Array<{ status: string }>)
          })
          db.close()
          if (rows.some((row) => row.status === 'aborted')) return performance.now() - start
          await new Promise((resolve) => setTimeout(resolve, 15))
        }
        return -1
      })
      expect(landed).toBeGreaterThanOrEqual(0)
      expect(landed).toBeLessThan(180)
    })
    test('phase-persist-continuous', async ({ page }) => {
      test.skip(!(theme === 'light' && w === 1440), 'one cell covers the continuous stream')
      await staged(page)
      await push(page, [PH.thinking[0], PH.thinking[1]])
      const thinking = Array.from({ length: 20 }, (_, i) => `思${String(i).padStart(2, '0')}`)
      const answer = Array.from({ length: 20 }, (_, i) => `文${String(i).padStart(2, '0')}`)
      await page.evaluate(async ({ thinking: thoughts, answer: words }) => {
        const sse = (window as unknown as { __sse: { push: (events: unknown[]) => void } }).__sse
        for (const piece of thoughts) {
          sse.push([{ type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: piece } }])
          await new Promise((resolve) => setTimeout(resolve, 50))
        }
        sse.push([{ type: 'content_block_stop', index: 0 }, { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } }])
        for (const piece of words) {
          sse.push([{ type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: piece } }])
          await new Promise((resolve) => setTimeout(resolve, 50))
        }
      }, { thinking, answer })
      const kept = async (target: Page) => {
        const text = await target.locator('.turn.assistant').innerText()
        expect(text).toContain('思00')
        expect(text).toContain('思19')
        expect(text).toContain('文00')
        const last = answer.filter((piece) => text.includes(piece)).length
        expect(last).toBeGreaterThanOrEqual(19)
      }
      await page.reload()
      await expect(page.locator('.turn.assistant')).toBeVisible()
      await kept(page)
      await page.close()
      const again = await page.context().newPage()
      await again.goto('/')
      await expect(again.locator('.turn.assistant')).toBeVisible()
      await kept(again)
    })
    test('phase-continue', async ({ page }) => {
      test.skip(!(theme === 'light' && w === 1440), 'one cell covers continuation')
      await staged(page)
      await push(page, [
        ...PH.thinking,
        { type: 'content_block_start', index: 4, content_block: { type: 'text', text: '' } },
        { type: 'content_block_delta', index: 4, delta: { type: 'text_delta', text: '原文甲。' } },
      ])
      await expect(page.getByTestId('assistant-text')).toContainText('原文甲')
      await page.getByTestId('stop').click()
      await page.getByTestId('continue').click()
      await page.waitForFunction(() => (window as unknown as { __sse: { count: () => number } }).__sse.count() > 1)
      const request = await page.evaluate(() => (window as unknown as { __sse: { requests: Array<{ messages: Array<{ role: string; content: unknown }> }> } }).__sse.requests.at(-1))
      expect(request?.messages.at(-1)?.role).toBe('assistant')
      expect(JSON.stringify(request?.messages.at(-1)?.content)).toContain('原文甲')
      await push(page, [
        { type: 'message_start', message: { id: 'c', model: 'deepseek-flash' } },
        { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '续写乙。' } },
        { type: 'content_block_stop', index: 0 },
        { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { input_tokens: 1, output_tokens: 1 } },
        { type: 'message_stop' },
      ])
      await expect(page.getByTestId('message-assistant')).toHaveCount(1)
      await expect(page.locator('.turn.assistant')).toContainText('原文甲')
      await expect(page.locator('.turn.assistant')).toContainText('续写乙')
      await expect(page.getByTestId('versions')).toHaveCount(0)
    })
    test('phase-persist-refresh', async ({ page }) => {
      test.skip(!(theme === 'light' && w === 1440), 'one cell covers a refresh off the one-second boundary')
      await staged(page)
      await push(page, [PH.thinking[0], PH.thinking[1], { type: 'content_block_stop', index: 0 }, { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } }])
      const answer = Array.from({ length: 12 }, (_, i) => `段${String(i).padStart(2, '0')}`)
      await page.evaluate(async (words) => {
        const sse = (window as unknown as { __sse: { push: (events: unknown[]) => void } }).__sse
        for (const piece of words) {
          sse.push([{ type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: piece } }])
          await new Promise((resolve) => setTimeout(resolve, 50))
        }
      }, answer)
      await page.reload()
      await expect(page.locator('.turn.assistant')).toBeVisible()
      const body = await page.locator('.turn.assistant').innerText()
      const kept = answer.filter((piece) => body.includes(piece)).length
      expect(kept).toBeGreaterThanOrEqual(answer.length - 1)
      expect(body).toContain(answer[0])
    })
    test('phase-continue-thinking', async ({ page }) => {
      test.skip(!(theme === 'light' && w === 1440), 'one cell covers the thinking retry')
      await staged(page)
      await push(page, [
        ...PH.thinking,
        { type: 'content_block_stop', index: 0 },
        { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
        { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: '原文甲。' } },
      ])
      await expect(page.getByTestId('assistant-text')).toContainText('原文甲')
      await page.getByTestId('stop').click()
      await page.evaluate(() => {
        const sse = (window as unknown as { __sse: { decide: ((body: { messages?: Array<{ role?: string; content?: unknown }> }) => number) | null } }).__sse
        sse.decide = (body) => {
          const last = body?.messages?.at(-1)
          const encoded = JSON.stringify(last?.content ?? '')
          if (last?.role === 'assistant' && encoded.includes('thinking')) return 400
          return 200
        }
      })
      await page.getByTestId('continue').click()
      await page.waitForFunction(() => {
        const sse = (window as unknown as { __sse: { count: () => number; requests: Array<{ messages: Array<{ role: string; content: unknown }> }> } }).__sse
        const continuations = sse.requests.filter((item) => item.messages.at(-1)?.role === 'assistant')
        return sse.count() > 1 && continuations.some((item) => !JSON.stringify(item.messages.at(-1)?.content).includes('thinking'))
      })
      const requests = await page.evaluate(() => (window as unknown as { __sse: { requests: Array<{ messages: Array<{ role: string; content: unknown }> }> } }).__sse.requests)
      const continuations = requests.filter((item) => item.messages.at(-1)?.role === 'assistant')
      expect(JSON.stringify(continuations[0]?.messages.at(-1)?.content)).toContain('thinking')
      expect(continuations.length).toBeGreaterThan(1)
      expect(JSON.stringify(continuations.at(-1)?.messages.at(-1)?.content)).not.toContain('thinking')
      await push(page, [
        { type: 'message_start', message: { id: 'c', model: 'deepseek-flash' } },
        { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '续写乙。' } },
        { type: 'content_block_stop', index: 0 },
        { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { input_tokens: 1, output_tokens: 1 } },
        { type: 'message_stop' },
      ])
      await expect(page.getByTestId('message-assistant')).toHaveCount(1)
      await expect(page.locator('.turn.assistant')).toContainText('原文甲')
      await expect(page.locator('.turn.assistant')).toContainText('续写乙')
    })
    test('phase-continue-search', async ({ page }) => {
      test.skip(!(theme === 'light' && w === 1440), 'one cell covers folded search continuation')
      await staged(page)
      await push(page, [
        ...PH.thinking,
        { type: 'content_block_stop', index: 0 },
        { type: 'content_block_start', index: 1, content_block: { type: 'server_tool_use', id: 's1', name: 'deepseek_web_search', input: { action: 'search', queries: ['上海天气'] } } },
        { type: 'content_block_stop', index: 1 },
        { type: 'content_block_start', index: 2, content_block: { type: 'web_search_tool_result', tool_use_id: 's1', content: [{ type: 'web_search_result', title: '天气来源', url: 'https://weather.example/a', snippet: '晴' }] } },
        { type: 'content_block_stop', index: 2 },
        { type: 'content_block_start', index: 3, content_block: { type: 'text', text: '' } },
        { type: 'content_block_delta', index: 3, delta: { type: 'text_delta', text: '原文甲。' } },
      ])
      await expect(page.getByTestId('assistant-text')).toContainText('原文甲')
      await expect(page.getByTestId('search-results')).toBeVisible()
      await expect(page.locator('.found-line')).toContainText('搜索到 1 个网页')
      await page.getByTestId('stop').click()
      await expect(page.getByTestId('continue')).toBeVisible()
      await page.getByTestId('continue').click()
      await page.waitForFunction(() => (window as unknown as { __sse: { count: () => number } }).__sse.count() > 1)
      const request = await page.evaluate(() => (window as unknown as { __sse: { requests: Array<{ tools?: Array<{ type?: string; name?: string }>; messages: Array<{ role: string; content: unknown }> }> } }).__sse.requests.at(-1))
      const last = request?.messages.at(-1)
      expect(last?.role).toBe('assistant')
      const encoded = JSON.stringify(last?.content)
      expect(encoded).toContain('thinking')
      expect(encoded).toContain('天气来源')
      expect(encoded).toContain('https://weather.example/a')
      expect(encoded).not.toContain('server_tool_use')
      expect(encoded).not.toContain('web_search_tool_result')
      expect(JSON.stringify(request?.tools ?? [])).not.toContain('deepseek_web_search')
      const blocks = last?.content
      expect(Array.isArray(blocks)).toBe(true)
      const content = blocks as Array<{ type?: string; text?: string }>
      expect(content.at(-1)).toEqual({ type: 'text', text: '原文甲。' })
      const partialAt = content.findIndex((block) => block.type === 'text' && block.text === '原文甲。')
      expect(partialAt).toBe(content.length - 1)
      expect(content.slice(0, partialAt).some((block) => block.type === 'text' && (block.text ?? '').includes('https://weather.example/a'))).toBe(true)
      expect(content.slice(partialAt + 1).some((block) => block.type === 'text' && (block.text ?? '').includes('https://weather.example/a'))).toBe(false)
      await push(page, [
        { type: 'message_start', message: { id: 'c', model: 'deepseek-flash' } },
        { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '续写乙。' } },
        { type: 'content_block_stop', index: 0 },
        { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { input_tokens: 1, output_tokens: 1 } },
        { type: 'message_stop' },
      ])
      await expect(page.getByTestId('message-assistant')).toHaveCount(1)
      await expect(page.locator('.turn.assistant')).toContainText('原文甲')
      await expect(page.locator('.turn.assistant')).toContainText('续写乙')
      await expect(page.getByTestId('search-results')).toBeVisible()
      await expect(page.locator('.found-line')).toContainText('搜索到 1 个网页')
      await expect(page.locator('.prose')).not.toContainText('https://weather.example/a')
      await expect(page.locator('.prose')).not.toContainText('天气来源')
      await expect.poll(async () => {
        const rows = await idbMessages(page)
        const assistant = rows.find((row) => row.role === 'assistant')
        const types = assistant?.blocks.map((block) => block.type) ?? []
        const text = assistant?.blocks.filter((block) => block.type === 'text').map((block) => block.text ?? '').join('\n') ?? ''
        return `${types.slice(0, 4).join(',')}|${text.includes('原文甲')}|${text.includes('续写乙')}|${text.includes('https://weather.example/a')}|${text.includes('天气来源')}`
      }).toBe('thinking,server_tool_use,web_search_tool_result,text|true|true|false|false')
    })
    test('phase-continue-search-reject', async ({ page }) => {
      test.skip(!(theme === 'light' && w === 1440), 'one cell covers the regenerate fallback')
      await staged(page)
      await push(page, [
        ...PH.thinking,
        { type: 'content_block_stop', index: 0 },
        { type: 'content_block_start', index: 1, content_block: { type: 'server_tool_use', id: 's1', name: 'deepseek_web_search', input: { action: 'search', queries: ['上海天气'] } } },
        { type: 'content_block_stop', index: 1 },
        { type: 'content_block_start', index: 2, content_block: { type: 'web_search_tool_result', tool_use_id: 's1', content: [{ type: 'web_search_result', title: '天气来源', url: 'https://weather.example/a', snippet: '晴' }] } },
        { type: 'content_block_stop', index: 2 },
        { type: 'content_block_start', index: 3, content_block: { type: 'text', text: '' } },
        { type: 'content_block_delta', index: 3, delta: { type: 'text_delta', text: '原文甲。' } },
      ])
      await expect(page.getByTestId('assistant-text')).toContainText('原文甲')
      await page.getByTestId('stop').click()
      await page.evaluate(() => {
        const sse = (window as unknown as { __sse: { decide: ((body: { messages?: Array<{ role?: string }> }) => number) | null } }).__sse
        sse.decide = (body) => (body?.messages?.at(-1)?.role === 'assistant' ? 400 : 200)
      })
      await page.getByTestId('continue').click()
      await page.waitForFunction(() => {
        const requests = (window as unknown as { __sse: { requests: Array<{ messages: Array<{ role: string }> }> } }).__sse.requests
        return requests.some((item) => item.messages.at(-1)?.role === 'assistant') && requests.some((item) => item.messages.at(-1)?.role === 'user' && requests.indexOf(item) > 0)
      })
      await push(page, [
        { type: 'message_start', message: { id: 'regen', model: 'deepseek-flash' } },
        { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '重新生成。' } },
        { type: 'content_block_stop', index: 0 },
        { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { input_tokens: 1, output_tokens: 1 } },
        { type: 'message_stop' },
      ])
      await expect(page.locator('.turn.assistant')).toContainText('重新生成')
      await expect(page.getByTestId('versions')).toContainText('2 / 2')
      const originalStopped = async (target: Page) => {
        await target.getByRole('button', { name: '‹' }).click()
        await expect(target.getByTestId('versions')).toContainText('1 / 2')
        await expect(target.locator('.turn.assistant').last()).toContainText('已停止')
        await expect(target.getByTestId('continue')).toBeVisible()
        await expect(target.getByTestId('search-results')).toBeVisible()
        await expect(target.locator('.found-line')).toContainText('搜索到 1 个网页')
        await expect(target.getByTestId('retry')).toHaveCount(0)
        await expect(target.locator('.prose')).toContainText('原文甲')
        await expect(target.locator('.prose')).not.toContainText('https://weather.example/a')
        await expect(target.locator('.prose')).not.toContainText('重新生成')
        const rows = await idbMessages(target)
        const assistant = rows.find((row) => row.role === 'assistant' && row.status === 'aborted')
        expect(assistant?.blocks.some((block) => block.type === 'server_tool_use')).toBe(true)
        expect(assistant?.blocks.some((block) => block.type === 'web_search_tool_result')).toBe(true)
        const text = assistant?.blocks.filter((block) => block.type === 'text').map((block) => block.text ?? '').join('\n') ?? ''
        expect(text).toContain('原文甲')
        expect(text).not.toContain('https://weather.example/a')
        expect(text).not.toContain('天气来源')
      }
      await originalStopped(page)
      await page.getByTestId('versions').locator('button').nth(1).click()
      await expect(page.getByTestId('versions')).toContainText('2 / 2')
      await page.reload()
      await expect(page.getByTestId('versions')).toContainText('2 / 2')
      await originalStopped(page)
    })
    test('phase-continue-hidden', async ({ page }) => {
      test.skip(!(theme === 'light' && w === 1440), 'one cell covers when continue stays hidden')
      await staged(page)
      await push(page, [
        ...PH.thinking,
        { type: 'message_delta', delta: { title: '会话甲' } },
      ])
      await expect(page.locator('.chat-link', { hasText: '会话甲' })).toBeVisible()
      await expect(page.getByTestId('stop')).toBeVisible()
      await expect(page.getByTestId('continue')).toHaveCount(0)
      await push(page, [
        { type: 'content_block_stop', index: 0 },
        { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
        { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: '原文甲。' } },
      ])
      await expect(page.getByTestId('assistant-text')).toContainText('原文甲')
      await page.getByTestId('stop').click()
      await expect(page.getByTestId('continue')).toHaveCount(1)
      await page.getByTestId('new-chat').click()
      await page.getByTestId('composer').fill('完成的')
      await page.getByTestId('send').click()
      await page.waitForFunction(() => (window as unknown as { __sse: { count: () => number } }).__sse.count() > 1)
      await push(page, [
        { type: 'message_start', message: { id: 'done', model: 'deepseek-flash' } },
        { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '完成了。' } },
        { type: 'content_block_stop', index: 0 },
        { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null, title: '会话乙' }, usage: { input_tokens: 1, output_tokens: 1 } },
        { type: 'message_stop' },
      ])
      await expect(page.locator('.turn.assistant')).toContainText('完成了')
      await expect(page.getByTestId('stop')).toHaveCount(0)
      await expect(page.getByTestId('continue')).toHaveCount(0)
      await page.getByTestId('new-chat').click()
      await page.getByTestId('composer').fill('先停再追问')
      await page.getByTestId('send').click()
      await page.waitForFunction(() => (window as unknown as { __sse: { requests: Array<{ messages?: Array<{ content?: unknown }> }> } }).__sse.requests.some((item) => JSON.stringify(item).includes('先停再追问')))
      await push(page, [
        { type: 'message_start', message: { id: 'child-stop', model: 'deepseek-flash' } },
        { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '半句。' } },
        { type: 'message_delta', delta: { title: '会话丙' } },
      ])
      await expect(page.locator('.turn.assistant')).toContainText('半句')
      await page.getByTestId('stop').click()
      await expect(page.getByTestId('continue')).toHaveCount(1)
      await page.getByTestId('composer').fill('追问')
      const followUpsBefore = await page.evaluate(() => (window as unknown as { __sse: { requests: unknown[] } }).__sse.requests.length)
      await page.getByTestId('send').click()
      // The previous prompt "先停再追问" contains "追问", and the follow-up body keeps that history.
      // Wait until a new request exists whose newest message is this send, then push into that stream.
      await page.waitForFunction((start) => {
        const requests = (window as unknown as { __sse: { requests: Array<{ messages?: Array<{ role?: string; content?: unknown }> }> } }).__sse.requests
        if (requests.length <= start) return false
        const messages = requests[requests.length - 1]?.messages ?? []
        const newest = messages[messages.length - 1]
        const content = JSON.stringify(newest?.content ?? '')
        return newest?.role === 'user' && content.includes('追问') && !content.includes('先停再追问')
      }, followUpsBefore)
      await push(page, [
        { type: 'message_start', message: { id: 'child-done', model: 'deepseek-flash' } },
        { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '后文。' } },
        { type: 'content_block_stop', index: 0 },
        { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { input_tokens: 1, output_tokens: 1 } },
        { type: 'message_stop' },
      ])
      await expect(page.locator('.turn.assistant').last()).toContainText('后文')
      await expect(page.getByTestId('continue')).toHaveCount(0)
      await page.getByTestId('new-chat').click()
      await page.getByTestId('composer').fill('另一路还在生成')
      await page.getByTestId('send').click()
      await page.waitForFunction(() => (window as unknown as { __sse: { requests: Array<{ messages?: Array<{ content?: unknown }> }> } }).__sse.requests.some((item) => JSON.stringify(item).includes('另一路还在生成')))
      await push(page, [
        { type: 'message_start', message: { id: 'other', model: 'deepseek-flash' } },
        { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: '还在想' } },
        { type: 'message_delta', delta: { title: '会话丁' } },
      ])
      await expect(page.getByTestId('stop')).toBeVisible()
      await expect(page.locator('.chat-link', { hasText: '会话丁' })).toBeVisible()
      await page.locator('.chat-link', { hasText: '会话甲' }).click()
      await expect(page.locator('.turn.assistant').last()).toContainText('原文甲')
      await expect(page.getByTestId('continue')).toBeVisible()
    })
    test('concurrent-send', async ({ page }) => { knownFailure('concurrent-send'); await staged(page); await push(page, PH.thinking); await page.waitForTimeout(300)
      await drawer(page); await page.getByTestId('new-chat').click(); await page.waitForTimeout(300); if (isMobile(page) && (await page.locator('.nav-open').count())) await page.keyboard.press('Escape')
      await page.getByTestId('composer').fill('[筑衡测试] 第二条'); await page.locator('[data-testid=send], [data-testid=stop]').first().click(); await page.waitForTimeout(500)
      expect(await page.evaluate(() => (window as any).__sse.aborted.includes(0)), 'first reply must keep generating').toBe(false)
      await expect(page.getByText(K.busyHint)).toBeVisible() })
  })
}
