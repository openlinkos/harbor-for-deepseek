import { expect, test, type Page, type Route } from '@playwright/test'

const sse = (title: string, text: string) => {
  const events = [
    { type: 'message_start', message: { id: 'req', model: 'deepseek-flash' } },
    { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'ok' } },
    { type: 'content_block_stop', index: 0 },
    { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text } },
    { type: 'content_block_stop', index: 1 },
    { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null, title }, usage: { input_tokens: 10, output_tokens: 4, output_tokens_details: { thinking_tokens: 1 } } },
    { type: 'message_stop' },
  ]
  return events.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join('')
}

const install = async (page: Page) => {
  await page.route('https://api.deepseek.com/**', async (route: Route) => {
    const url = route.request().url()
    if (url.endsWith('/user/balance')) {
      await route.fulfill({ json: { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '1', granted_balance: '0', topped_up_balance: '1' }] } })
      return
    }
    if (url.endsWith('/models')) {
      await route.fulfill({ json: { data: [{ id: 'deepseek-flash' }] } })
      return
    }
    if (!url.includes('/messages')) {
      await route.fulfill({ status: 404, json: {} })
      return
    }
    const body = route.request().postData() || ''
    const title = body.includes('乙关键字') ? '乙会话' : body.includes('甲关键字') ? '甲会话' : '对照'
    const text = title === '乙会话' ? '乙回复' : title === '甲会话' ? '甲回复' : '第一版'
    await route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse(title, text) })
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

const send = async (page: Page, text: string, title: string) => {
  await page.getByTestId('composer').fill(text)
  await page.getByTestId('send').click()
  await expect(page.locator('.chat-title')).toHaveText(title)
}

const home = async (page: Page) => {
  await page.keyboard.press('Control+j')
  await expect(page.locator('.greeting')).toBeVisible()
  await expect(page.locator('.chat-title')).toHaveCount(0)
}

const sessionId = async (page: Page, title: string, mobile: boolean) => {
  if (mobile) {
    await page.getByTestId('menu').click()
    await expect(page.locator('.sidebar')).toBeVisible()
  }
  const href = await page.locator('a.chat-link').filter({ hasText: title }).getAttribute('href')
  if (mobile) {
    await page.locator('.scrim').click()
    await expect(page.locator('.sidebar')).toBeHidden()
  }
  return (href || '').replace(/^#/, '')
}

const openSearch = async (page: Page) => {
  await page.keyboard.press('Control+k')
  await expect(page.locator('.search-dialog')).toBeVisible()
  await expect(page.locator('.side-filter')).toBeFocused()
}

const expectHit = async (page: Page, title: string) => {
  const option = page.locator('.search-dialog [role="option"]').filter({ hasText: title })
  await expect(option).toBeVisible()
  await expect(option).toContainText(/\d{2}:\d{2}/)
  const box = await option.boundingBox()
  const dialog = await page.locator('.search-dialog').boundingBox()
  expect(box).toBeTruthy()
  expect(dialog).toBeTruthy()
  expect(box!.x).toBeGreaterThanOrEqual(dialog!.x - 1)
  expect(box!.y).toBeGreaterThanOrEqual(dialog!.y - 1)
  expect(box!.x + box!.width).toBeLessThanOrEqual(dialog!.x + dialog!.width + 1)
  expect(box!.y + box!.height).toBeLessThanOrEqual(dialog!.y + dialog!.height + 1)
  const hit = await page.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y)
    return {
      option: Boolean(el?.closest('[role="option"]')),
      dialog: Boolean(el?.closest('.search-dialog')),
      scrim: Boolean(el?.closest('.search-scrim')),
    }
  }, { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 })
  expect(hit).toEqual({ option: true, dialog: true, scrim: false })
  return option
}

const expectOpened = async (page: Page, id: string, title: string) => {
  await expect.poll(() => new URL(page.url()).pathname).toBe(`/a/chat/s/${id}`)
  await expect(page.locator('.chat-title')).toHaveText(title)
  await expect(page.locator('.search-dialog')).toBeHidden()
}

const openFromSidebar = async (page: Page, title: string, mobile: boolean) => {
  if (mobile) {
    await page.getByTestId('menu').click()
    await expect(page.locator('.sidebar')).toBeVisible()
  }
  await page.locator('a.chat-link').filter({ hasText: title }).getByRole('button', { name: title }).click()
  await expect(page.locator('.chat-title')).toHaveText(title)
  if (mobile) await expect(page.locator('.sidebar')).toBeHidden()
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`通过搜索切换会话 ${viewport.width}`, async ({ page }) => {
    const mobile = viewport.width < 768
    await page.setViewportSize(viewport)
    await unlock(page)
    await send(page, '甲关键字', '甲会话')
    await home(page)
    await send(page, '乙关键字', '乙会话')
    await home(page)
    const id = await sessionId(page, '乙会话', mobile)

    await openSearch(page)
    await page.locator('.side-filter').fill('没有这句')
    await expect(page.locator('.search-dialog .search-results-empty')).toHaveText('暂无相关结果')
    await expect(page.locator('.search-dialog [role="option"]')).toHaveCount(0)
    await page.locator('.side-filter').fill('乙关键字')
    await expectHit(page, '乙会话')
    await page.locator('.search-dialog [role="option"]').filter({ hasText: '乙会话' }).click()
    await expectOpened(page, id, '乙会话')

    await openFromSidebar(page, '甲会话', mobile)
    await openSearch(page)
    await page.locator('.side-filter').fill('乙会话')
    await expectHit(page, '乙会话')
    await page.locator('.side-filter').press('Enter')
    await expectOpened(page, id, '乙会话')
    await openFromSidebar(page, '甲会话', mobile)
  })
}
