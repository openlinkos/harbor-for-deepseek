import { expect, test, type Page, type Route } from '@playwright/test'

const sse = (events: unknown[]) =>
  `${events.map((event) => `event: ${(event as { type: string }).type}\ndata: ${JSON.stringify(event)}\n\n`).join('')}: keep-alive\n\n`

const answer = (text: string) => [
  { type: 'message_start', message: { id: 'req', model: 'deepseek-flash' } },
  { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'ok' } },
  { type: 'content_block_stop', index: 0 },
  { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
  { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text } },
  { type: 'content_block_stop', index: 1 },
  { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null, title: '对照' }, usage: { input_tokens: 10, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 4, service_tier: 'standard', output_tokens_details: { thinking_tokens: 2 } } },
  { type: 'message_stop' },
]

const longCode = ['```python', ...Array.from({ length: 24 }, (_, index) => `line_${index} = ${index}`), '```'].join('\n')

let hold = false
let body = '第一版'

const fulfill = async (route: Route) => {
  const url = route.request().url()
  if (url.endsWith('/user/balance')) {
    await route.fulfill({ json: { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '1.00', granted_balance: '0', topped_up_balance: '1.00' }] } })
    return
  }
  if (url.endsWith('/models')) {
    await route.fulfill({ json: { data: [{ id: 'deepseek-flash' }] } })
    return
  }
  if (!url.includes('/messages')) {
    await route.fulfill({ status: 404, json: { error: { message: 'not mocked' } } })
    return
  }
  if (hold) {
    await new Promise((resolve) => setTimeout(resolve, 800))
  }
  await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: sse(answer(body)) })
}

const unlock = async (page: Page) => {
  hold = false
  body = '第一版'
  await page.route('https://api.deepseek.com/**', fulfill)
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()
}

test('mobile drawer', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await unlock(page)
  await expect(page.locator('.sidebar')).toBeHidden()
  await expect(page.locator('.greeting')).toHaveCSS('font-size', '20px')
  await page.getByTestId('menu').click()
  await expect(page.locator('.sidebar')).toBeVisible()
  const box = await page.locator('.sidebar').boundingBox()
  expect(Math.round(box?.width ?? 0)).toBe(261)
  const footer = await page.locator('.user-bar').boundingBox()
  expect((footer?.y ?? 0) + (footer?.height ?? 0)).toBeLessThanOrEqual(844)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
  expect(overflow).toBe(false)
  const bar = await page.evaluate(() => getComputedStyle(document.querySelector('.transcript')!).scrollbarWidth)
  expect(bar).toBe('none')
  await page.locator('.chips').evaluate((node) => { node.style.flex = '0 0 80px' })
  await expect(page.getByTestId('toggle-thinking')).toHaveCSS('width', '34px')
  await expect(page.getByTestId('toggle-thinking')).toHaveCSS('height', '34px')
  await expect(page.getByTestId('top-new')).toHaveCSS('border-top-width', '0px')
  const composer = await page.locator('.composer').boundingBox()
  expect(Math.round(composer?.x ?? 0)).toBeGreaterThanOrEqual(31)
  expect(Math.round(composer?.x ?? 0)).toBeLessThanOrEqual(33)
  expect(Math.round((composer?.x ?? 0) + (composer?.width ?? 0))).toBeGreaterThanOrEqual(357)
  expect(Math.round((composer?.x ?? 0) + (composer?.width ?? 0))).toBeLessThanOrEqual(359)
  await page.locator('.scrim').click({ position: { x: 340, y: 200 } })
  await expect(page.locator('.sidebar')).toBeHidden()
  await page.getByTestId('menu').click()
  await page.getByTestId('user-menu').click()
  await page.getByTestId('settings-open').click()
  await expect(page.locator('.settings-shell')).toHaveCSS('border-top-left-radius', '24px')
  await expect(page.locator('.settings-shell')).toHaveCSS('border-bottom-left-radius', '24px')
})

test('offline banner', async ({ page }) => {
  await unlock(page)
  await page.evaluate(() => window.dispatchEvent(new Event('offline')))
  await expect(page.getByTestId('offline')).toBeVisible()
  await expect(page.getByTestId('offline')).toHaveCSS('border-radius', '12px')
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect(page.getByTestId('offline')).toBeHidden()
})

test('long code', async ({ page }) => {
  await unlock(page)
  body = longCode
  await page.getByTestId('composer').fill('长代码')
  await page.getByTestId('send').click()
  const card = page.locator('.code-card')
  await expect(card.locator('pre')).toHaveClass(/collapsed/)
  await expect(card.locator('pre')).toHaveCSS('max-height', '220px')
  await card.getByRole('button', { name: '展开' }).click()
  await expect(card.locator('pre')).not.toHaveClass(/collapsed/)
  await card.getByRole('button', { name: '收起' }).click()
  await expect(card.locator('pre')).toHaveClass(/collapsed/)
})

test('scroll follow', async ({ page }) => {
  await unlock(page)
  hold = true
  await page.getByTestId('composer').fill('滚一下')
  await page.getByTestId('send').click()
  await expect(page.getByTestId('stop')).toBeVisible()
  await page.getByTestId('message-list').evaluate((node) => {
    const pad = document.createElement('div')
    pad.style.flex = '0 0 2000px'
    pad.style.height = '2000px'
    node.prepend(pad)
    node.scrollTop = 0
    node.dispatchEvent(new Event('scroll'))
  })
  await expect(page.getByRole('button', { name: '回到底部' })).toBeVisible()
  await page.getByRole('button', { name: '回到底部' }).click()
  await expect(page.getByRole('button', { name: '回到底部' })).toBeHidden()
  hold = false
})

test('narrow layout 360', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 })
  await unlock(page)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
  expect(overflow).toBe(false)
  await expect(page.locator('.kbd')).toBeHidden()
  await page.locator('.chips').evaluate((node) => { node.style.flex = '0 0 80px' })
  await expect(page.getByTestId('toggle-search')).toHaveCSS('width', '34px')
  const composer = await page.locator('.composer').boundingBox()
  expect(Math.round(composer?.x ?? 0)).toBeGreaterThanOrEqual(15)
  expect(Math.round(composer?.x ?? 0)).toBeLessThanOrEqual(17)
  expect(Math.round((composer?.x ?? 0) + (composer?.width ?? 0))).toBeGreaterThanOrEqual(343)
  expect(Math.round((composer?.x ?? 0) + (composer?.width ?? 0))).toBeLessThanOrEqual(345)
})

test('delete confirm', async ({ page }) => {
  await unlock(page)
  await page.getByTestId('composer').fill('待删')
  await page.getByTestId('send').click()
  await expect(page.getByTestId('sidebar')).toContainText('对照')
  await page.locator('.chat-link').hover()
  await page.locator('.chat-link .more').click()
  await page.getByRole('menuitem', { name: '删除' }).click()
  await expect(page.getByTestId('confirm-dialog')).toBeVisible()
  await page.getByRole('button', { name: '取消' }).click()
  await expect(page.getByTestId('confirm-dialog')).toBeHidden()
  await expect(page.getByTestId('sidebar')).toContainText('对照')
  await page.locator('.chat-link').hover()
  await page.locator('.chat-link .more').click()
  await page.getByRole('menuitem', { name: '删除' }).click()
  await page.getByTestId('confirm-delete').click()
  await expect(page.getByTestId('sidebar')).not.toContainText('对照')
})

const openRowMenu = async (page: Page, width: number) => {
  if (width < 768) {
    const sidebar = page.locator('.sidebar')
    if (!(await sidebar.isVisible())) {
      await page.getByTestId('menu').click()
      await expect(sidebar).toBeVisible()
    }
  }
  const row = page.locator('.chat-link').first()
  if (width >= 768) await row.hover()
  await row.locator('.more').click()
}

const chatStillNamed = async (page: Page, title: string, absent: string) => {
  await page.waitForTimeout(400)
  const sidebar = page.getByTestId('sidebar')
  await expect(sidebar).toContainText(title)
  await expect(sidebar).not.toContainText(absent)
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
] as const) {
  test(`delete confirm and rename dismiss at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await unlock(page)
    await page.getByTestId('composer').fill('待留')
    await page.getByTestId('send').click()
    await expect(page.getByTestId('sidebar')).toContainText('对照')
    const mutations: string[] = []
    const onRequest = (request: { method: () => string; url: () => string }) => {
      const method = request.method()
      if (method === 'DELETE' || method === 'PATCH' || method === 'PUT') mutations.push(`${method} ${request.url()}`)
    }
    page.on('request', onRequest)

    await openRowMenu(page, viewport.width)
    await page.getByRole('menuitem', { name: '删除' }).click()
    const dialog = page.getByTestId('confirm-dialog')
    await expect(dialog).toBeVisible()
    await expect(page.getByRole('button', { name: '取消' })).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.getByTestId('confirm-delete')).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(page.getByRole('button', { name: '取消' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await chatStillNamed(page, '对照', '不该保存的名字')

    await openRowMenu(page, viewport.width)
    await page.getByRole('menuitem', { name: '删除' }).click()
    await expect(dialog).toBeVisible()
    await dialog.click({ position: { x: 12, y: 12 } })
    await expect(dialog).toBeHidden()
    await chatStillNamed(page, '对照', '不该保存的名字')

    await openRowMenu(page, viewport.width)
    await page.getByRole('menuitem', { name: '删除' }).click()
    await expect(dialog).toBeVisible()
    await page.getByRole('button', { name: '取消' }).click()
    await expect(dialog).toBeHidden()
    await chatStillNamed(page, '对照', '不该保存的名字')

    await openRowMenu(page, viewport.width)
    await page.getByRole('menuitem', { name: '重命名' }).click()
    const title = page.getByLabel('对话标题')
    await expect(title).toBeFocused()
    await title.fill('不该保存的名字')
    await page.locator('.group-label').first().click()
    await expect(title).toBeVisible()
    await expect(title).toHaveValue('不该保存的名字')
    await title.press('Escape')
    await expect(title).toBeHidden()
    await chatStillNamed(page, '对照', '不该保存的名字')
    expect(mutations).toEqual([])

    await openRowMenu(page, viewport.width)
    await page.getByRole('menuitem', { name: '重命名' }).click()
    await page.getByLabel('对话标题').fill('已改名')
    await page.getByLabel('对话标题').press('Enter')
    await expect(page.getByTestId('sidebar')).toContainText('已改名')
    await expect(page.getByTestId('sidebar')).not.toContainText('对照')
    page.off('request', onRequest)
  })
}
