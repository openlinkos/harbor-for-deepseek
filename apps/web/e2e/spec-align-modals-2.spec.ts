// Computed modal styles. Confirm cards use the 24px surface. The toast uses the official padding and layer.
// Escape cancels the delete confirm (昊辰 fb1132-5). SP-MOD-572's capture has no Esc-cancel; that conflict stays open. Modal stack starts at 1024.
import { expect, test, type Page, type Route } from '@playwright/test'

const install = async (page: Page) => {
  await page.route('https://api.deepseek.com/**', async (route: Route) => {
    const url = route.request().url()
    if (url.endsWith('/user/balance')) return route.fulfill({ json: { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '1', granted_balance: '0', topped_up_balance: '1' }] } })
    if (url.endsWith('/models')) return route.fulfill({ json: { data: [{ id: 'deepseek-flash' }] } })
    return route.fulfill({ status: 404, json: {} })
  })
}

const archive = JSON.stringify({
  format: 'deepapi',
  version: 1,
  exportedAt: '2026-01-01T00:00:00.000Z',
  app: 'deepapi',
  conversations: [{
    id: 'import-1',
    title: '导入会话',
    titleSource: 'user',
    model: 'deepseek-flash',
    thinking: false,
    search: false,
    readLink: false,
    effort: 'high',
    pinned: false,
    archived: false,
    activeLeafId: 'import-m',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    rev: 1,
    deletedAt: null,
    messages: [{
      id: 'import-m',
      parentId: null,
      role: 'user',
      status: 'complete',
      blocks: [{ type: 'text', text: '导入' }],
      usage: null,
      errorMessage: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      rev: 1,
      deletedAt: null,
    }],
  }],
})

test('confirm card, menu, and toast follow the official dialog field', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await install(page)
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((ok, ko) => {
      const request = indexedDB.open('deepapi')
      request.onsuccess = () => ok(request.result)
      request.onerror = () => ko(request.error)
    })
    const tx = db.transaction(['conversations', 'messages'], 'readwrite')
    const id = crypto.randomUUID()
    const userId = crypto.randomUUID()
    const answerId = crypto.randomUUID()
    const when = new Date().toISOString()
    tx.objectStore('conversations').put({ id, title: '弹层会话', titleSource: 'user', model: 'deepseek-flash', thinking: false, search: false, readLink: false, effort: 'high', pinned: false, archived: false, activeLeafId: answerId, createdAt: when, updatedAt: when, rev: 1, deletedAt: null })
    tx.objectStore('messages').put({ id: userId, conversationId: id, parentId: null, role: 'user', blocks: [{ type: 'text', text: '问题' }], status: 'complete', usage: null, errorMessage: null, createdAt: when, updatedAt: when, rev: 1, deletedAt: null })
    tx.objectStore('messages').put({ id: answerId, conversationId: id, parentId: userId, role: 'assistant', blocks: [{ type: 'text', text: '回答' }], status: 'complete', usage: null, errorMessage: null, createdAt: when, updatedAt: when, rev: 1, deletedAt: null })
    await new Promise((ok, ko) => { tx.oncomplete = () => ok(null); tx.onerror = () => ko(tx.error) })
    db.close()
  })
  await page.reload()
  await page.locator('a.chat-link', { hasText: '弹层会话' }).getByRole('button', { name: '弹层会话' }).click()
  await expect(page.getByTestId('assistant-text')).toContainText('回答')
  await page.getByTestId('message-assistant').getByRole('button', { name: '复制', exact: true }).hover()
  const tip = page.getByRole('tooltip')
  await expect(tip).toBeVisible()
  await expect(tip).toHaveCSS('padding', '4px 8px')
  await expect(tip).toHaveCSS('font-size', '12px')
  await expect(tip).toHaveCSS('line-height', '18px')
  await expect(tip).toHaveCSS('border-radius', '10px')
  await expect(tip).toHaveCSS('background-color', 'rgb(44, 44, 46)')

  await page.getByTestId('user-menu').click()
  const menu = page.locator('.menu.user-menu')
  await expect(menu).toHaveCSS('min-width', '124px')
  await expect(menu).toHaveCSS('max-width', '280px')
  await expect(menu).toHaveCSS('border-radius', '12px')
  await expect(menu).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(menu.getByRole('menuitem', { name: '系统设置' })).toHaveCSS('user-select', 'none')
  await page.getByTestId('user-menu').click()
  await expect(menu).toBeHidden()

  await page.locator('a.chat-link', { hasText: '弹层会话' }).hover()
  await page.locator('a.chat-link', { hasText: '弹层会话' }).locator('.more').click()
  await page.getByRole('menuitem', { name: '删除' }).click()
  const card = page.getByTestId('confirm-dialog').locator('.confirm-card')
  await expect(card).toBeVisible()
  await expect(card).toHaveCSS('border-radius', '24px')
  await expect(card).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(card).toHaveCSS('line-height', '22px')
  const title = card.locator('h2')
  await expect(title).toHaveCSS('font-size', '16px')
  await expect(title).toHaveCSS('font-weight', '500')
  await expect(title).toHaveCSS('line-height', '24px')
  await expect(title).toHaveCSS('min-height', '28px')
  await expect(page.locator('.modal.confirm-modal')).toHaveCSS('z-index', '1024')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('confirm-dialog')).toBeHidden()

  await page.evaluate(() => document.body.setAttribute('data-ds-dark-theme', ''))
  await page.locator('a.chat-link', { hasText: '弹层会话' }).hover()
  await page.locator('a.chat-link', { hasText: '弹层会话' }).locator('.more').click()
  await page.getByRole('menuitem', { name: '删除' }).click()
  await expect(card).toHaveCSS('background-color', 'rgb(44, 44, 46)')
  await expect(card.locator('h2')).toHaveCSS('color', 'rgb(249, 250, 251)')
  await page.getByRole('button', { name: '取消' }).click()
  await page.evaluate(() => document.body.removeAttribute('data-ds-dark-theme'))

  await page.getByTestId('user-menu').click()
  await page.getByTestId('settings-open').click()
  await page.getByTestId('settings-nav-data').click()
  await page.getByTestId('import-json').setInputFiles({ name: 'import.json', mimeType: 'application/json', buffer: Buffer.from(archive) })
  const toast = page.getByTestId('import-toast')
  await expect(toast).toBeVisible()
  await expect(toast).toHaveCSS('padding', '12px 18px')
  await expect(toast).toHaveCSS('line-height', '22px')
  await expect(toast).toHaveCSS('border-radius', '12px')
  await expect(toast).toHaveCSS('z-index', '2000')
  await expect(toast).toHaveCSS('text-align', 'center')
  await expect(toast).toHaveCSS('background-color', 'rgb(53, 54, 56)')
  await expect(toast).toHaveCSS('max-width', '480px')
})
