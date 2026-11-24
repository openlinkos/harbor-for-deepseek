// SP-SB-670 rename commits on New chat / chat switch; reload drops the editor.
// SP-SB-647 search-chats: 开启新对话 only dismisses; Ctrl+K restores the query, selected.
// SP-SB-668 / SP-SB-669 menus close on New chat and on a history pop.
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

const TITLES = ['苹果会话', '香蕉会话']

const seed = async (page: Page) => {
  await install(page)
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()
  await page.evaluate(async (titles) => {
    const db = await new Promise<IDBDatabase>((ok, ko) => {
      const request = indexedDB.open('deepapi')
      request.onsuccess = () => ok(request.result)
      request.onerror = () => ko(request.error)
    })
    const tx = db.transaction(['conversations', 'messages'], 'readwrite')
    titles.forEach((title, index) => {
      const id = crypto.randomUUID()
      const mid = crypto.randomUUID()
      const when = new Date(Date.now() - index * 60_000).toISOString()
      tx.objectStore('conversations').put({ id, title, titleSource: 'user', model: 'deepseek-flash', thinking: false, search: false, readLink: false, effort: 'high', pinned: false, archived: false, activeLeafId: mid, createdAt: when, updatedAt: when, rev: 1, deletedAt: null })
      tx.objectStore('messages').put({ id: mid, conversationId: id, parentId: null, role: 'user', blocks: [{ type: 'text', text: '问题：' + title }], status: 'complete', usage: null, errorMessage: null, createdAt: when, updatedAt: when, rev: 1, deletedAt: null })
    })
    await new Promise((ok, ko) => { tx.oncomplete = () => ok(null); tx.onerror = () => ko(tx.error) })
    db.close()
  }, TITLES)
  await page.reload()
  await expect(page.getByTestId('composer')).toBeVisible()
  await expect(page.getByTestId('sidebar')).toContainText('苹果会话')
}

const row = (page: Page, title: string) => page.locator('a.chat-link', { hasText: title })

const startRename = async (page: Page, title: string) => {
  const link = row(page, title)
  await link.hover()
  await link.locator('.more').click()
  await page.getByRole('menuitem', { name: '重命名' }).click()
  const input = page.locator('.chat-link input')
  await expect(input).toBeVisible()
  return input
}

test('SP-SB-647 search dialog dismisses on 开启新对话 and keeps the query', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await seed(page)
  await row(page, '苹果会话').getByRole('button', { name: '苹果会话' }).click()
  const url = page.url()
  await page.keyboard.press('Control+k')
  const dialog = page.locator('.search-dialog')
  await expect(dialog).toBeVisible()
  await page.locator('.side-filter').fill('苹果')
  const shellClass = await page.locator('.shell').getAttribute('class')
  const box = await page.getByTestId('new-chat').boundingBox()
  expect(box).toBeTruthy()
  const hit = await page.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y)
    return { scrim: Boolean(el?.closest('.search-scrim')), newChat: Boolean(el?.closest('[data-testid="new-chat"]')) }
  }, { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 })
  expect(hit).toEqual({ scrim: true, newChat: false })
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await expect(dialog).toBeHidden()
  expect(page.url()).toBe(url)
  await expect(page.locator('a.chat-link')).toHaveCount(2)
  await expect(page.getByTestId('sidebar')).toContainText('香蕉会话')
  expect(await page.locator('.shell').getAttribute('class')).toBe(shellClass)
  await page.keyboard.press('Control+k')
  await expect(dialog).toBeVisible()
  const field = page.locator('.side-filter')
  await expect(field).toHaveValue('苹果')
  await expect.poll(() => field.evaluate((node) => {
    const input = node as HTMLInputElement
    return [input.selectionStart, input.selectionEnd, input.value.length]
  })).toEqual([0, 2, 2])
})

test('SP-SB-670 rename commits on New chat and chat switch, not on Escape or reload', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await seed(page)

  const switched = await startRename(page, '苹果会话')
  await switched.fill('苹果已改')
  await row(page, '香蕉会话').getByRole('button', { name: '香蕉会话' }).click()
  await expect(page.locator('.chat-link input')).toHaveCount(0)
  await expect(page.getByTestId('sidebar')).toContainText('苹果已改')
  await expect(page.getByTestId('sidebar')).not.toContainText('苹果会话')

  const landed = await startRename(page, '香蕉会话')
  await landed.fill('香蕉已改')
  await page.getByTestId('new-chat').click()
  await expect(page.locator('.chat-link input')).toHaveCount(0)
  await expect(page.getByTestId('sidebar')).toContainText('香蕉已改')
  await expect(page.getByTestId('message-list')).not.toContainText('问题：')

  const cancelled = await startRename(page, '苹果已改')
  await cancelled.fill('不要这个')
  await page.keyboard.press('Escape')
  await expect(page.locator('.chat-link input')).toHaveCount(0)
  await expect(page.getByTestId('sidebar')).toContainText('苹果已改')
  await expect(page.getByTestId('sidebar')).not.toContainText('不要这个')

  const pending = await startRename(page, '香蕉已改')
  await pending.fill('刷新前')
  await page.reload()
  await expect(page.getByTestId('composer')).toBeVisible()
  await expect(page.locator('.chat-link input')).toHaveCount(0)
  await expect(page.getByTestId('sidebar')).toContainText('香蕉已改')
  await expect(page.getByTestId('sidebar')).not.toContainText('刷新前')
})

test('SP-SB-668 and SP-SB-669 menus close on New chat and history back', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await seed(page)
  const link = row(page, '苹果会话')
  await link.hover()
  await link.locator('.more').click()
  await expect(page.getByTestId('chat-item-menu')).toBeVisible()
  await page.getByTestId('new-chat').click()
  await expect(page.getByTestId('chat-item-menu')).toHaveCount(0)

  await page.evaluate(() => history.pushState({ sidebarMenu: 1 }, '', location.href))
  await link.hover()
  await link.locator('.more').click()
  await expect(page.getByTestId('chat-item-menu')).toBeVisible()
  await page.evaluate(() => history.back())
  await expect(page.getByTestId('chat-item-menu')).toHaveCount(0)

  await page.evaluate(() => history.pushState({ userMenu: 1 }, '', location.href))
  await page.getByTestId('user-menu').click()
  await expect(page.locator('[role="menu"]').filter({ hasText: '系统设置' })).toBeVisible()
  await page.evaluate(() => history.back())
  await expect(page.locator('[role="menu"]').filter({ hasText: '系统设置' })).toHaveCount(0)
})
