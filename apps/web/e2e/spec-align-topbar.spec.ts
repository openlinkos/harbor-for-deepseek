// Computed top-bar styles from regions/topbar.md.
// SP-TB-016..018 title color and font. SP-TB-034 max-width 60vw below 768.
// SP-TB-108/109 chat header background. SP-TB-248..257 and SP-TB-295..297 greeting.
// SP-TB-303 accessible name 分享. SP-TB-315 下载应用.
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
  await expect(page.locator('.greeting')).toBeVisible()
}

test('greeting type and chat title follow the official top bar', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await unlock(page)
  const greeting = page.locator('.greeting')
  await expect(greeting).toContainText('今天有什么可以帮到你？')
  await expect(greeting).toHaveCSS('font-size', '24px')
  await expect(greeting).toHaveCSS('font-weight', '600')
  await expect(greeting).toHaveCSS('line-height', '32px')
  await expect(greeting).toHaveCSS('color', 'rgb(15, 17, 21)')
  await page.evaluate(() => document.body.setAttribute('data-ds-dark-theme', ''))
  await expect(greeting).toHaveCSS('color', 'rgb(255, 255, 255)')
  await page.evaluate(() => document.body.removeAttribute('data-ds-dark-theme'))

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(greeting).toHaveCSS('font-size', '20px')
  await expect(greeting).toHaveCSS('font-weight', '500')
  await expect(greeting).toHaveCSS('line-height', '28px')
  await expect(page.locator('.download-app')).toContainText('下载应用')
  const mark = await page.locator('.greeting .mark').evaluate((node) => getComputedStyle(node).transform)
  expect(mark).not.toBe('none')

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
    tx.objectStore('conversations').put({ id, title: '顶栏标题', titleSource: 'user', model: 'deepseek-flash', thinking: false, search: false, readLink: false, effort: 'high', pinned: false, archived: false, activeLeafId: mid, createdAt: when, updatedAt: when, rev: 1, deletedAt: null })
    tx.objectStore('messages').put({ id: mid, conversationId: id, parentId: null, role: 'user', blocks: [{ type: 'text', text: '问题' }], status: 'complete', usage: null, errorMessage: null, createdAt: when, updatedAt: when, rev: 1, deletedAt: null })
    await new Promise((ok, ko) => { tx.oncomplete = () => ok(null); tx.onerror = () => ko(tx.error) })
    db.close()
  })
  await page.reload()
  await page.getByTestId('menu').click()
  await page.locator('a.chat-link', { hasText: '顶栏标题' }).click()
  const title = page.getByTestId('chat-title')
  await expect(title).toHaveText('顶栏标题')
  await expect(title).toHaveCSS('font-size', '14px')
  await expect(title).toHaveCSS('font-weight', '500')
  await expect(title).toHaveCSS('line-height', '22px')
  await expect(title).toHaveCSS('height', '22px')
  await expect(title).toHaveCSS('color', 'rgb(15, 17, 21)')
  await expect(title).toHaveCSS('max-width', '234px')
  await expect(page.locator('.topbar')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(page.locator('.topbar button[aria-label="分享"]')).toHaveCSS('flex-shrink', '0')
  await page.evaluate(() => document.body.setAttribute('data-ds-dark-theme', ''))
  await expect(title).toHaveCSS('color', 'rgb(249, 250, 251)')
  await expect(page.locator('.topbar')).toHaveCSS('background-color', 'rgb(21, 21, 23)')

  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(title).toHaveCSS('max-width', 'min(480px, 100% - 140px)')
  await expect(page.locator('.topbar button[aria-label="分享"]')).toHaveAttribute('aria-label', '分享')
})
