// Share bar geometry and the selected-count color.
import { expect, test, type Page, type Route } from '@playwright/test'

const openSeed = async (page: Page) => {
  await page.route('https://api.deepseek.com/**', async (route: Route) => {
    const url = route.request().url()
    if (url.endsWith('/user/balance')) return route.fulfill({ json: { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '1', granted_balance: '0', topped_up_balance: '1' }] } })
    if (url.endsWith('/models')) return route.fulfill({ json: { data: [{ id: 'deepseek-flash' }] } })
    return route.fulfill({ status: 404, json: {} })
  })
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
    const id = crypto.randomUUID()
    const user = crypto.randomUUID()
    const assistant = crypto.randomUUID()
    const when = new Date().toISOString()
    tx.objectStore('conversations').put({ id, title: '分享样式', titleSource: 'user', model: 'deepseek-flash', thinking: false, search: false, readLink: false, effort: 'high', pinned: false, archived: false, activeLeafId: assistant, createdAt: when, updatedAt: when, rev: 1, deletedAt: null })
    tx.objectStore('messages').put({ id: user, conversationId: id, parentId: null, role: 'user', blocks: [{ type: 'text', text: '你好' }], status: 'complete', usage: null, errorMessage: null, createdAt: when, updatedAt: when, rev: 1, deletedAt: null })
    tx.objectStore('messages').put({ id: assistant, conversationId: id, parentId: user, role: 'assistant', blocks: [{ type: 'text', text: '好的。' }], status: 'complete', usage: null, errorMessage: null, createdAt: when, updatedAt: when, rev: 1, deletedAt: null })
    await new Promise((ok, ko) => { tx.oncomplete = () => ok(null); tx.onerror = () => ko(tx.error) })
    db.close()
  })
  await page.reload()
  await page.locator('a.chat-link', { hasText: '分享样式' }).click()
  await expect(page.locator('.action-row').last()).toBeVisible()
}

test('share bar height and selected count use the primary label color', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openSeed(page)
  await page.locator('.action-row button[aria-label="分享"]').last().click()
  const bar = page.locator('.share-bar')
  await expect(bar).toBeVisible()
  await expect(bar).toHaveCSS('position', 'absolute')
  await expect(bar).toHaveCSS('height', '65px')
  await expect(bar).toHaveCSS('bottom', '0px')
  await expect(page.getByTestId('share-count')).toHaveCSS('color', 'rgb(15, 17, 21)')
  await expect(page.getByTestId('share-count')).toHaveCSS('font-size', '14px')
  await page.keyboard.press('Escape')
  await expect(bar).toBeVisible()
  await page.evaluate(() => document.body.setAttribute('data-ds-dark-theme', ''))
  await expect(page.getByTestId('share-count')).toHaveCSS('color', 'rgb(249, 250, 251)')
})
