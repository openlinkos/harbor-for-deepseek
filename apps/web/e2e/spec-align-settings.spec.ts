// SP-SET-736 / SP-SET-765 / SP-MOD-636. Settings overlay blocks chat switching.
// A dimmed-area click closes. Back closes. Reload closes and stays on the same chat.
import { expect, test, type Page, type Route } from '@playwright/test'

const sse = (events: unknown[]) => events.map((event) => `event: ${(event as { type: string }).type}\ndata: ${JSON.stringify(event)}\n\n`).join('')
const reply = () => [
  { type: 'message_start', message: { id: 'req-set', model: 'deepseek-flash' } },
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
    ;['设置甲', '设置乙'].forEach((title, index) => {
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

const openSettings = async (page: Page) => {
  await page.getByTestId('user-menu').click()
  await page.getByTestId('settings-open').click()
  await expect(page.getByTestId('settings-dialog')).toBeVisible()
  await expect(page.getByTestId('settings-nav-general')).toHaveClass(/on/)
}

const pressAt = async (page: Page, locator: ReturnType<Page['locator']>) => {
  const box = await locator.boundingBox()
  if (!box) throw new Error('missing box')
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
}

test('SP-SET-736 and SP-SET-765 settings overlay blocks chat changes', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await seed(page)
  await page.locator('a.chat-link', { hasText: '设置乙' }).getByRole('button', { name: '设置乙' }).click()
  await expect(page.getByTestId('message-list')).toContainText('问题：设置乙')
  const url = page.url()

  await openSettings(page)
  await pressAt(page, page.locator('a.chat-link', { hasText: '设置甲' }))
  await expect(page.getByTestId('settings-dialog')).toBeVisible()
  await expect(page.getByTestId('settings-nav-general')).toHaveClass(/on/)
  await expect(page.getByTestId('message-list')).toContainText('问题：设置乙')
  await expect(page.getByTestId('message-list')).not.toContainText('问题：设置甲')
  expect(page.url()).toBe(url)

  await pressAt(page, page.getByTestId('new-chat'))
  await expect(page.getByTestId('settings-dialog')).toBeVisible()
  await expect(page.locator('.greeting')).toHaveCount(0)
  await expect(page.getByTestId('message-list')).toContainText('问题：设置乙')

  const vp = page.viewportSize()!
  await page.mouse.click(vp.width - 8, vp.height / 2)
  await expect(page.getByTestId('settings-dialog')).toBeHidden()
  await expect(page.getByTestId('message-list')).toContainText('问题：设置乙')

  await openSettings(page)
  await page.goBack()
  await expect(page.getByTestId('settings-dialog')).toBeHidden()
  expect(page.url()).toBe(url)
  await expect(page.getByTestId('message-list')).toContainText('问题：设置乙')

  await openSettings(page)
  await page.reload()
  await expect(page.getByTestId('composer')).toBeVisible()
  await expect(page.getByTestId('settings-dialog')).toHaveCount(0)
  await expect(page.getByTestId('message-list')).toContainText('问题：设置乙')

  await openSettings(page)
  await expect(page.getByTestId('settings-nav-general')).toHaveClass(/on/)
  await expect(page.locator('.theme-cards .chip.on')).toContainText('跟随系统')
})
