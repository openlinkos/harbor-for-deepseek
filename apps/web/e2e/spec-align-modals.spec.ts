// SP-MOD-572 delete confirm. SP-MOD-635 search-chats dialog.
// Esc still closes the delete confirm because interaction-gate asserts that.
import { expect, test, type Page, type Route } from '@playwright/test'

const sse = (events: unknown[]) => events.map((event) => `event: ${(event as { type: string }).type}\ndata: ${JSON.stringify(event)}\n\n`).join('')
const reply = () => [
  { type: 'message_start', message: { id: 'req-mod', model: 'deepseek-flash' } },
  { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '好的。' } },
  { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { input_tokens: 1, output_tokens: 1 } },
  { type: 'message_stop' },
]

const install = async (page: Page) => {
  await page.route('https://api.deepseek.com/**', async (route: Route) => {
    const url = route.request().url()
    if (url.endsWith('/user/balance')) return route.fulfill({ json: { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '1', granted_balance: '0', topped_up_balance: '1' }] } })
    if (url.endsWith('/models')) return route.fulfill({ json: { data: [{ id: 'deepseek-flash' }] } })
    if (!url.includes('/messages')) return route.fulfill({ status: 404, json: {} })
    return route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse(reply()) })
  })
}

const seed = async (page: Page) => {
  await install(page)
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((ok, ko) => {
      const request = indexedDB.open('deepapi')
      request.onsuccess = () => ok(request.result)
      request.onerror = () => ko(request.error)
    })
    const tx = db.transaction(['conversations', 'messages'], 'readwrite')
    ;['弹层甲', '弹层乙'].forEach((title, index) => {
      const id = crypto.randomUUID()
      const mid = crypto.randomUUID()
      const when = new Date(Date.now() - index * 60_000).toISOString()
      tx.objectStore('conversations').put({ id, title, titleSource: 'user', model: 'deepseek-flash', thinking: true, search: true, readLink: false, effort: 'high', pinned: false, archived: false, activeLeafId: mid, createdAt: when, updatedAt: when, rev: 1, deletedAt: null })
      tx.objectStore('messages').put({ id: mid, conversationId: id, parentId: null, role: 'user', blocks: [{ type: 'text', text: '问题：' + title }], status: 'complete', usage: null, errorMessage: null, createdAt: when, updatedAt: when, rev: 1, deletedAt: null })
    })
    await new Promise((ok, ko) => { tx.oncomplete = () => ok(null); tx.onerror = () => ko(tx.error) })
    db.close()
  })
  await page.reload()
  await expect(page.getByTestId('composer')).toBeVisible()
}

const openDelete = async (page: Page) => {
  const link = page.locator('a.chat-link', { hasText: '弹层甲' })
  await link.hover()
  await link.locator('.more').click()
  await page.getByRole('menuitem', { name: '删除' }).click()
  await expect(page.getByTestId('confirm-dialog')).toBeVisible()
}

test('SP-MOD-572 delete confirm blocks navigation and Back closes it', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await seed(page)
  await page.locator('a.chat-link', { hasText: '弹层甲' }).getByRole('button', { name: '弹层甲' }).click()
  await expect(page.getByTestId('message-list')).toContainText('问题：弹层甲')
  const url = page.url()
  await openDelete(page)
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('hidden')
  const box = await page.getByTestId('new-chat').boundingBox()
  if (!box) throw new Error('missing new chat')
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await expect(page.getByTestId('confirm-dialog')).toBeHidden()
  await expect(page.locator('.greeting')).toHaveCount(0)
  await expect(page.getByTestId('message-list')).toContainText('问题：弹层甲')
  expect(page.url()).toBe(url)

  await openDelete(page)
  await page.goBack()
  await expect(page.getByTestId('confirm-dialog')).toBeHidden()
  expect(page.url()).toBe(url)
  await expect(page.locator('a.chat-link', { hasText: '弹层甲' })).toBeVisible()
})

test('SP-MOD-635 search dialog keeps focus inside and Back closes it', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await seed(page)
  const url = page.url()
  await page.keyboard.press('Control+k')
  const dialog = page.locator('.search-dialog')
  await expect(dialog).toBeVisible()
  await expect(page.locator('.side-filter')).toBeFocused()
  const box = await dialog.boundingBox()
  expect(box && Math.round(box.width)).toBe(660)
  for (let step = 0; step < 4; step += 1) await page.keyboard.press('Tab')
  await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('.search-dialog'))).toBe(true)
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('hidden')
  await page.goBack()
  await expect(dialog).toBeHidden()
  expect(page.url()).toBe(url)

  await page.keyboard.press('Control+k')
  await expect(dialog).toBeVisible()
  const vp = page.viewportSize()!
  await page.mouse.click(vp.width - 8, vp.height / 2)
  await expect(dialog).toBeHidden()
  await page.keyboard.press('Control+k')
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})
