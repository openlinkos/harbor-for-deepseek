// Computed composer styles. Dark send uses the primary fill. The disclaimer follows tertiary.
// Chip height stays 34px (motion.spec.ts, gaps.spec.ts, mobile-capture.spec.ts).
import { expect, test, type Page, type Route } from '@playwright/test'

const install = async (page: Page) => {
  await page.route('https://api.deepseek.com/**', async (route: Route) => {
    const url = route.request().url()
    if (url.endsWith('/user/balance')) return route.fulfill({ json: { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '1', granted_balance: '0', topped_up_balance: '1' }] } })
    if (url.endsWith('/models')) return route.fulfill({ json: { data: [{ id: 'deepseek-flash' }] } })
    return route.fulfill({ status: 404, json: {} })
  })
}

test('composer fill, caret, and disclaimer follow the official field', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await install(page)
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  const field = page.getByTestId('composer')
  await expect(field).toBeVisible()
  await expect(field).toHaveAttribute('placeholder', '给 DeepAPI 发送消息')
  const box = page.locator('.composer').first()
  await expect(box).toHaveCSS('border-radius', '24px')
  await expect(box).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(field).toHaveCSS('font-size', '16px')
  await expect(field).toHaveCSS('line-height', '24px')
  await expect(field).toHaveCSS('caret-color', 'rgb(57, 100, 254)')
  const send = page.getByTestId('send')
  await expect(send).toHaveCSS('opacity', '0.4')
  await expect(send).toHaveCSS('background-color', 'rgb(57, 100, 254)')
  await expect(page.getByTestId('toggle-thinking')).toHaveCSS('height', '34px')
  await expect(page.getByTestId('toggle-thinking')).toHaveCSS('border-radius', '18px')

  await page.evaluate(() => document.body.setAttribute('data-ds-dark-theme', ''))
  await expect(send).toHaveCSS('background-color', 'rgb(86, 134, 254)')
  await expect(field).toHaveCSS('caret-color', 'rgb(103, 158, 254)')
  await expect(box).toHaveCSS('background-color', 'rgb(44, 44, 46)')
  await expect(box).toHaveCSS('border-top-color', 'rgba(255, 255, 255, 0.06)')
  await expect(box).toHaveCSS('box-shadow', 'none')

  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((ok, ko) => {
      const request = indexedDB.open('deepapi')
      request.onsuccess = () => ok(request.result)
      request.onerror = () => ko(request.error)
    })
    const tx = db.transaction(['conversations', 'messages'], 'readwrite')
    const id = crypto.randomUUID()
    const mid = crypto.randomUUID()
    const when = new Date().toISOString()
    tx.objectStore('conversations').put({ id, title: '作曲会话', titleSource: 'user', model: 'deepseek-flash', thinking: false, search: false, readLink: false, effort: 'high', pinned: false, archived: false, activeLeafId: mid, createdAt: when, updatedAt: when, rev: 1, deletedAt: null })
    tx.objectStore('messages').put({ id: mid, conversationId: id, parentId: null, role: 'user', blocks: [{ type: 'text', text: '你好' }], status: 'complete', usage: null, errorMessage: null, createdAt: when, updatedAt: when, rev: 1, deletedAt: null })
    await new Promise((ok, ko) => { tx.oncomplete = () => ok(null); tx.onerror = () => ko(tx.error) })
    db.close()
  })
  await page.reload()
  await page.evaluate(() => document.body.setAttribute('data-ds-dark-theme', ''))
  await page.locator('a.chat-link', { hasText: '作曲会话' }).getByRole('button', { name: '作曲会话' }).click()
  const note = page.locator('.ai-note')
  await expect(note).toHaveText('内容由 AI 生成，请仔细甄别')
  await expect(note).toHaveCSS('font-size', '11px')
  await expect(note).toHaveCSS('line-height', '16px')
  await expect(note).toHaveCSS('color', 'rgb(173, 178, 184)')
  await expect(page.locator('.composer').last()).toHaveCSS('box-shadow', 'none')
  await page.evaluate(() => document.body.removeAttribute('data-ds-dark-theme'))
  await expect(note).toHaveCSS('color', 'rgb(129, 133, 140)')
})
