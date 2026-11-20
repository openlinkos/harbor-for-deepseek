// fb1132 draft: required CI e2e gate for 「能点 → 有正确结果，能开 → 能取消」.
// Drop into apps/web/e2e/. Runs in the existing `pnpm e2e` CI job (ci.yml:43), both viewports.
// Each test is one class of interaction; new feedback of the same class = one new row in a table here.
import { expect, test, type Page, type Route } from '@playwright/test'

const sse = (events: unknown[]) => events.map((e) => `event: ${(e as { type: string }).type}\ndata: ${JSON.stringify(e)}\n\n`).join('')
const reply = (text: string) => [
  { type: 'message_start', message: { id: 'req-' + text.length, model: 'deepseek-flash' } },
  { type: 'content_block_start', index: 0, content_block: { type: 'text', text } },
  { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { input_tokens: 1, output_tokens: 1 } },
  { type: 'message_stop' },
]
const install = async (page: Page) => {
  await page.route('https://api.deepseek.com/**', async (route: Route) => {
    const url = route.request().url()
    if (url.endsWith('/user/balance')) return route.fulfill({ json: { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '1', granted_balance: '0', topped_up_balance: '1' }] } })
    if (url.endsWith('/models')) return route.fulfill({ json: { data: [{ id: 'deepseek-flash' }] } })
    if (!url.includes('/messages')) return route.fulfill({ status: 404, json: {} })
    return route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse(reply('好的。')) })
  })
}
const TITLES = ['苹果会话', '香蕉会话', '樱桃会话']
const seed = async (page: Page) => {
  await install(page)
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()
  await page.evaluate(async (titles) => {
    const db = await new Promise<IDBDatabase>((ok, ko) => { const r = indexedDB.open('deepapi'); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error) })
    const tx = db.transaction(['conversations', 'messages'], 'readwrite')
    titles.forEach((title, i) => {
      const id = crypto.randomUUID(), mid = crypto.randomUUID(), when = new Date(Date.now() - i * 60_000).toISOString()
      tx.objectStore('conversations').put({ id, title, titleSource: 'user', model: 'deepseek-flash', thinking: false, search: false, readLink: false, effort: 'high', pinned: false, archived: false, activeLeafId: mid, createdAt: when, updatedAt: when, rev: 1, deletedAt: null })
      tx.objectStore('messages').put({ id: mid, conversationId: id, parentId: null, role: 'user', blocks: [{ type: 'text', text: '问题：' + title }], status: 'complete', usage: null, errorMessage: null, createdAt: when, updatedAt: when, rev: 1, deletedAt: null })
    })
    await new Promise((ok, ko) => { tx.oncomplete = () => ok(null); tx.onerror = () => ko(tx.error) })
    db.close()
  }, TITLES)
  await page.reload()
  await expect(page.getByTestId('composer')).toBeVisible()
}
const mobile = (page: Page) => (page.viewportSize()?.width ?? 1440) < 768
const sidebar = async (page: Page) => { if (mobile(page) && !(await page.locator('.nav-open').count())) { await page.getByTestId('menu').click(); await page.waitForTimeout(400) } }
const row = (page: Page, title: string) => page.locator('.chat-link', { hasText: title })
const current = (page: Page) => page.getByTestId('message-list')

for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test.describe(`interaction gate ${vp.width}`, () => {
    test.use({ viewport: vp })

    // A1 切换历史对话：文字、行内空白、搜索结果三种入口都必须打开对应会话
    for (const how of ['text', 'blank', 'search'] as const) {
      test(`switch conversation via ${how}`, async ({ page }) => {
        await seed(page)
        for (const title of [TITLES[1], TITLES[2], TITLES[0]]) {
          if (how === 'search') {
            await sidebar(page)
            await page.getByRole('button', { name: '搜索' }).first().click()
            const panel = page.locator('.search-dialog')
            await expect(panel).toBeVisible()
            await page.locator('.side-filter').fill(title.slice(0, 2))
            const hit = panel.locator('a, li, [role=option], button').filter({ hasText: title }).first()
            await expect(hit, '搜索弹窗必须列出匹配会话（官方搜索弹窗即结果列表）').toBeVisible()
            await hit.click()
            await expect(panel).toBeHidden()
          } else {
            await sidebar(page)
            const r = row(page, title)
            const box = (await r.boundingBox())!
            if (how === 'text') await r.locator('button').first().click()
            else await page.mouse.click(box.x + box.width - 48, box.y + box.height / 2) // 标题与 ⋯ 之间的空白
          }
          await expect(current(page)).toContainText('问题：' + title)
          await sidebar(page)
          await expect(row(page, title)).toHaveClass(/active/)
        }
      })
    }

    // A2 每个弹层/弹窗都能取消：Esc、点外面（遮罩）、再点触发器；取消不产生副作用
    const opens: [string, (p: Page) => Promise<void>, (p: Page) => ReturnType<Page['locator']>, ('esc' | 'outside' | 'retoggle')[]][] = [
      ['chat ⋯ menu', async (p) => { await sidebar(p); await row(p, TITLES[0]).hover(); await row(p, TITLES[0]).locator('.more').click() }, (p) => p.getByTestId('chat-item-menu'), ['esc', 'outside', 'retoggle']],
      ['user menu', async (p) => { await sidebar(p); await p.getByTestId('user-menu').click() }, (p) => p.locator('[role="menu"]').filter({ hasText: '系统设置' }), ['esc', 'outside']],
      ['settings dialog', async (p) => { await sidebar(p); await p.getByTestId('user-menu').click(); await p.getByTestId('settings-open').click() }, (p) => p.getByTestId('settings-dialog'), ['esc', 'outside']],
      ['delete confirm', async (p) => { await sidebar(p); await row(p, TITLES[0]).hover(); await row(p, TITLES[0]).locator('.more').click(); await p.getByRole('menuitem', { name: '删除' }).click() }, (p) => p.getByTestId('confirm-dialog'), ['esc', 'outside']],
      ['rename edit', async (p) => { await sidebar(p); await row(p, TITLES[0]).hover(); await row(p, TITLES[0]).locator('.more').click(); await p.getByRole('menuitem', { name: '重命名' }).click() }, (p) => p.locator('.chat-link input'), ['esc', 'outside']],
    ]
    for (const [name, open, target, ways] of opens) for (const way of ways) {
      test(`${name} cancels on ${way}`, async ({ page }) => {
        test.skip(way === 'retoggle' && vp.width < 768, '390 上 ⋯ 是底部 sheet，触发器被遮住，改用 Esc/遮罩')
        await seed(page)
        await open(page)
        const t = target(page)
        await expect(t).toBeVisible()
        if (name === 'rename edit') await t.fill('改了一半')
        if (way === 'esc') await page.keyboard.press('Escape')
        else if (way === 'outside') await page.mouse.click(vp.width - 8, vp.height / 2) // 弹层/对话框外的遮罩或页面
        else await page.locator('.chat-link .more').first().click()
        await expect(t, `${name} 必须能用 ${way} 取消`).toBeHidden()
        await sidebar(page)
        for (const title of TITLES) await expect(row(page, title), '取消不得删除/改名').toHaveCount(1)
      })
    }

    // A3 分享：三个入口行为一致，进入同一个分享流程（官方：勾选消息 → 创建分享链接弹窗）
    test('share entries agree and open the share flow', async ({ page }) => {
      await seed(page)
      await sidebar(page)
      await row(page, TITLES[0]).click()
      await page.getByTestId('composer').fill('hi'); await page.getByTestId('send').click()
      await expect(page.getByText('好的。')).toBeVisible()
      const entries: [string, () => Promise<void>][] = [
        ['topbar', () => page.locator('.topbar button[aria-label="share"]').click()],
        ['action row', () => page.locator('[data-tip="分享"]').last().click()],
        ['chat ⋯ menu', async () => { await sidebar(page); await row(page, TITLES[0]).hover(); await row(page, TITLES[0]).locator('.more').click(); await page.getByRole('menuitem', { name: /分享|Share/ }).click() }],
      ]
      for (const [name, go] of entries) {
        const dl = page.waitForEvent('download', { timeout: 1500 }).then((d) => d.suggestedFilename()).catch(() => null)
        await go()
        expect(await dl, `${name} 分享不应直接下载文件`).toBeNull()
        await expect(page.locator('[role="dialog"], .share-bar, input[type="checkbox"]').first(), `${name} 分享必须进入分享模式`).toBeVisible()
        await page.keyboard.press('Escape')
      }
    })
  })
}
