import { expect, test, type Page, type Route } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const shots = '/opt/cursor/artifacts'
mkdirSync(shots, { recursive: true })

const sse = (text: string, title: string) => {
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
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
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
    await route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse('8', '加法') })
  })
  return errors
}

const unlock = async (page: Page) => {
  const errors = await install(page)
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()
  return errors
}

const rootPath = (page: Page) => {
  const url = new URL(page.url())
  return { pathname: url.pathname, search: url.search, hash: url.hash }
}

const openConversation = async (page: Page) => {
  await page.getByTestId('composer').fill('3 加 5')
  await page.getByTestId('send').click()
  await expect(page.getByTestId('assistant-text')).toContainText('8')
  await expect(page.locator('.chat-link.active')).toHaveCount(1)
  await expect(page.locator('.greeting')).toHaveCount(0)
}

test('sidebar brand cursor is pointer and returns an open chat to the new-chat home', async ({ page }) => {
  const errors = await unlock(page)
  const brand = page.getByTestId('brand')
  await expect(brand).toBeVisible()
  await expect(brand).toContainText('DeepAPI')
  await expect(brand.locator('svg.mark')).toHaveCount(1)
  await expect(brand).toHaveCSS('cursor', 'pointer')

  await brand.click()
  expect(errors).toEqual([])
  await expect(page.locator('.greeting')).toContainText('今天有什么可以帮到你？')
  await expect(page.locator('.chat-link.active')).toHaveCount(0)
  expect(rootPath(page)).toEqual({ pathname: '/', search: '', hash: '' })

  await openConversation(page)
  await page.evaluate(() => history.pushState(null, '', '/a/chat/s/existing?from=session#keep'))
  expect(rootPath(page)).toEqual({ pathname: '/a/chat/s/existing', search: '?from=session', hash: '#keep' })
  await page.screenshot({ path: join(shots, 'brand-desktop-chat.png') })
  await brand.click()
  await expect(page.locator('.greeting')).toContainText(/欢迎回来，(想从哪里开始？|随时开始吧)|你好，我能帮什么忙吗？/)
  await expect(page.locator('.chat-link.active')).toHaveCount(0)
  await expect(page.getByTestId('sidebar')).toContainText('加法')
  expect(rootPath(page)).toEqual({ pathname: '/', search: '', hash: '' })
  expect(errors).toEqual([])
  await page.screenshot({ path: join(shots, 'brand-desktop-home.png') })

  await brand.click()
  await expect(page.locator('.greeting')).toBeVisible()
  await expect(page.locator('.chat-link.active')).toHaveCount(0)
  expect(rootPath(page)).toEqual({ pathname: '/', search: '', hash: '' })
  expect(errors).toEqual([])
})

test('brand is not keyboard focusable, matching the official logo div', async ({ page }) => {
  // Official Sl() renders div.e066abb8 with onClick navigate("/") and no tabIndex, role, or onKeyDown.
  await unlock(page)
  await openConversation(page)
  const brand = page.getByTestId('brand')
  expect(await brand.evaluate((el) => el.tabIndex)).toBe(-1)
  await expect(brand).not.toHaveAttribute('tabindex')
  await expect(brand).not.toHaveAttribute('role')
  await brand.evaluate((el: HTMLElement) => el.focus())
  expect(await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))).not.toBe('brand')

  const seen: string[] = []
  for (let index = 0; index < 40; index += 1) {
    await page.keyboard.press('Tab')
    const id = await page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? document.activeElement?.tagName ?? '')
    seen.push(id)
  }
  expect(seen).not.toContain('brand')

  await brand.dispatchEvent('keydown', { key: 'Enter' })
  await expect(page.locator('.chat-link.active')).toHaveCount(1)
  await expect(page.locator('.greeting')).toHaveCount(0)
})

test('phone 390 drawer brand returns home the same way', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const errors = await unlock(page)
  await openConversation(page)
  await page.getByTestId('menu').click()
  const brand = page.getByTestId('brand')
  await expect(brand).toBeVisible()
  await expect.poll(async () => Math.round((await page.locator('.sidebar').boundingBox())?.x ?? -1)).toBe(0)
  await expect(brand).toHaveCSS('cursor', 'pointer')
  const box = await brand.boundingBox()
  expect(box).toBeTruthy()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x).toBeLessThan(40)
  expect(box!.y).toBeLessThan(80)
  expect(box!.height).toBeGreaterThan(10)
  expect(box!.height).toBeLessThan(40)
  await page.evaluate(() => history.pushState(null, '', '/a/chat/s/existing#keep'))
  await page.screenshot({ path: join(shots, 'brand-mobile-drawer.png') })
  await brand.click()
  await expect(page.locator('.greeting')).toContainText(/欢迎回来，(想从哪里开始？|随时开始吧)|你好，我能帮什么忙吗？/)
  await expect(page.locator('.chat-link.active')).toHaveCount(0)
  await expect(page.locator('.sidebar')).toBeHidden()
  expect(rootPath(page)).toEqual({ pathname: '/', search: '', hash: '' })
  expect(errors).toEqual([])
  await page.screenshot({ path: join(shots, 'brand-mobile-home.png') })

  await page.getByTestId('menu').click()
  await expect(brand).toBeVisible()
  await brand.click()
  await expect(page.locator('.greeting')).toBeVisible()
  expect(errors).toEqual([])
  expect(rootPath(page)).toEqual({ pathname: '/', search: '', hash: '' })
})
