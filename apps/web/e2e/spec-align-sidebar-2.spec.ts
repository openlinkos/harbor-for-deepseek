// Computed sidebar styles. SP-SB-406 dark new-chat label. Active row accent.
// Group label sticks. Below 768 a chat row stays 40px and 14px.
import { expect, test, type Page, type Route } from '@playwright/test'

const install = async (page: Page) => {
  await page.route('https://api.deepseek.com/**', async (route: Route) => {
    const url = route.request().url()
    if (url.endsWith('/user/balance')) return route.fulfill({ json: { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '1', granted_balance: '0', topped_up_balance: '1' }] } })
    if (url.endsWith('/models')) return route.fulfill({ json: { data: [{ id: 'deepseek-flash' }] } })
    return route.fulfill({ status: 404, json: {} })
  })
}

const unlock = async (page: Page) => {
  await install(page)
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()
}

test('sidebar chrome follows the official list, new-chat, and group label', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await unlock(page)
  await expect(page.getByTestId('sidebar')).toContainText('暂无历史对话')

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
    tx.objectStore('conversations').put({ id, title: '', titleSource: 'default', model: 'deepseek-flash', thinking: false, search: false, readLink: false, effort: 'high', pinned: false, archived: false, activeLeafId: mid, createdAt: when, updatedAt: when, rev: 1, deletedAt: null })
    tx.objectStore('messages').put({ id: mid, conversationId: id, parentId: null, role: 'user', blocks: [{ type: 'text', text: '你好' }], status: 'complete', usage: null, errorMessage: null, createdAt: when, updatedAt: when, rev: 1, deletedAt: null })
    await new Promise((ok, ko) => { tx.oncomplete = () => ok(null); tx.onerror = () => ko(tx.error) })
    db.close()
  })
  await page.reload()
  await expect(page.getByTestId('sidebar')).toContainText('新对话')

  const sidebar = page.getByTestId('sidebar')
  await expect(sidebar).toHaveCSS('width', '261px')
  const link = page.locator('a.chat-link').first()
  await expect(link).toHaveCSS('height', '40px')
  await expect(link).toHaveCSS('border-radius', '12px')
  const row = link.locator('.chat-row')
  await expect(row).toHaveCSS('padding-top', '9px')
  await expect(row).toHaveCSS('padding-right', '6px')
  await expect(row).toHaveCSS('padding-left', '10px')
  await expect(row).toHaveCSS('font-size', '14px')
  await expect(row).toHaveCSS('line-height', '22px')
  await expect(row).toHaveCSS('justify-content', 'space-between')
  const fresh = page.getByTestId('new-chat')
  await expect(fresh).toHaveCSS('height', '40px')
  await expect(fresh).toHaveCSS('border-radius', '100px')
  await expect(fresh).toHaveCSS('font-weight', '500')
  await expect(fresh).toHaveCSS('color', 'rgb(15, 17, 21)')
  const label = page.locator('.group-label').first()
  await expect(label).toHaveCSS('position', 'sticky')
  await expect(label).toHaveCSS('font-size', '12px')
  await expect(label).toHaveCSS('line-height', '18px')
  await expect(label).toHaveCSS('font-weight', '500')
  await expect(label).toHaveCSS('color', 'rgb(129, 133, 140)')
  await expect(label).toHaveCSS('box-shadow', 'rgb(249, 250, 251) 4px 0px 0px 0px')

  await page.evaluate(() => document.body.setAttribute('data-ds-dark-theme', ''))
  await expect(fresh).toHaveCSS('color', 'rgb(249, 250, 251)')
  await expect(fresh).toHaveCSS('background-color', 'rgb(67, 69, 74)')
  await expect(label).toHaveCSS('box-shadow', 'rgb(27, 27, 28) 4px 0px 0px 0px')
  await link.getByRole('button', { name: '新对话' }).click()
  await expect(link).toHaveCSS('background-color', 'rgb(53, 54, 56)')
  await expect(link.locator('.chat-row > button:not(.more)')).toHaveCSS('color', 'rgb(255, 255, 255)')

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(link).toHaveCSS('height', '40px')
  await expect(link.locator('.chat-row > button:not(.more)')).toHaveCSS('font-size', '14px')
  await expect(fresh).toHaveCSS('background-color', 'rgb(67, 69, 74)')
  await expect(fresh).toHaveCSS('color', 'rgb(249, 250, 251)')
})
