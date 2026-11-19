import { expect, test, type Page, type Route } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const dir = join(process.cwd(), '../../docs/parity/mobile')
mkdirSync(dir, { recursive: true })

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 3,
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
})

const sse = (events: unknown[]) =>
  `${events.map((event) => `event: ${(event as { type: string }).type}\ndata: ${JSON.stringify(event)}\n\n`).join('')}`

const codeAnswer = [
  '一段可以折叠的示例：',
  '',
  '```python',
  'def harbor():',
  '    return "ok"',
  '```',
].join('\n')

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
  const events = [
    { type: 'message_start', message: { id: 'req', model: 'deepseek-flash' } },
    { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'ok' } },
    { type: 'content_block_stop', index: 0 },
    { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: codeAnswer } },
    { type: 'content_block_stop', index: 1 },
    { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null, title: '代码示例' }, usage: { input_tokens: 10, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 8, service_tier: 'standard', output_tokens_details: { thinking_tokens: 1 } } },
    { type: 'message_stop' },
  ]
  await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: sse(events) })
}

const shot = async (page: Page, name: string) => {
  await page.screenshot({ path: join(dir, name), animations: 'disabled' })
}

test('mobile states at 390x844', async ({ page }) => {
  test.setTimeout(90_000)
  await page.addInitScript(() => {
    const native = window.fetch.bind(window)
    const pending = []
    const host = window
    host.__harborPush = (chunk) => pending[0] && pending[0].push(chunk)
    host.__harborEnd = () => {
      if (pending[0]) pending[0].end()
      pending.shift()
    }
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (host.__harborHold && url.includes('/messages')) {
        let controller
        const stream = new ReadableStream({
          start(next) {
            controller = next
          },
        })
        const encoder = new TextEncoder()
        pending.push({
          push: (chunk) => controller.enqueue(encoder.encode(chunk)),
          end: () => controller.close(),
        })
        return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } })
      }
      return native(input, init)
    }
  })
  await page.route('https://api.deepseek.com/**', fulfill)
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()
  await expect(page.locator('.greeting')).toContainText('今天有什么可以帮到你？')
  await expect(page.locator('.chip-label').first()).toBeVisible()
  await expect(page.getByTestId('toggle-thinking')).toHaveCSS('height', '34px')
  await expect(page.getByTestId('toggle-search')).toContainText('智能搜索')
  const composer = await page.locator('.composer').boundingBox()
  expect(Math.round(composer?.x ?? 0)).toBeGreaterThanOrEqual(31)
  expect(Math.round(composer?.x ?? 0)).toBeLessThanOrEqual(33)
  expect(Math.round((composer?.x ?? 0) + (composer?.width ?? 0))).toBeGreaterThanOrEqual(357)
  expect(Math.round((composer?.x ?? 0) + (composer?.width ?? 0))).toBeLessThanOrEqual(359)
  await shot(page, 'home-no-history.png')
  await shot(page, 'home-390.png')
  await page.getByTestId('composer').focus()
  await shot(page, 'composer-focused.png')

  const partial = sse([
    { type: 'message_start', message: { id: 'req', model: 'deepseek-flash' } },
    { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: '先想一下' } },
    { type: 'content_block_stop', index: 0 },
    { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: '写到一半，还没有结束。' } },
  ])
  await page.evaluate(() => {
    window.__harborHold = true
  })
  await page.getByTestId('composer').fill('继续写')
  await page.getByTestId('send').click()
  await expect(page.getByTestId('stop')).toBeVisible()
  await page.evaluate((chunk) => {
    window.__harborPush(chunk)
  }, partial)
  await expect(page.getByTestId('message-assistant')).toContainText('写到一半')
  await shot(page, 'streaming-mid-answer.png')
  await page.evaluate((chunk) => {
    window.__harborPush(chunk)
    window.__harborEnd()
    window.__harborHold = false
  }, sse([{ type: 'content_block_stop', index: 1 }, { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null, title: '未完' }, usage: { input_tokens: 4, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 4, service_tier: 'standard', output_tokens_details: { thinking_tokens: 1 } } }, { type: 'message_stop' }]))
  await expect(page.getByTestId('stop')).toBeHidden()

  await page.getByTestId('top-new').click()
  await page.getByTestId('composer').fill('给一段代码')
  await page.getByTestId('send').click()
  await expect(page.locator('.code-card')).toBeVisible()
  await shot(page, 'answer-code.png')

  await page.getByTestId('top-new').click()
  await expect(page.locator('.greeting')).toContainText(/欢迎回来，(想从哪里开始？|随时开始吧)|你好，有什么我能帮你的吗？/)
  await shot(page, 'home-with-history.png')
  await page.getByTestId('menu').click()
  await expect(page.locator('.sidebar')).toBeVisible()
  await shot(page, 'drawer.png')
  await shot(page, 'drawer-390.png')
  await page.locator('.chat-link .more').first().click()
  await expect(page.locator('.item-menu.sheet')).toBeVisible()
  await shot(page, 'item-menu-sheet.png')
  await page.locator('.item-menu-scrim').click({ position: { x: 200, y: 120 } })
  await expect(page.locator('.item-menu.sheet')).toBeHidden()
  await page.getByTestId('user-menu').click()
  await page.getByTestId('settings-open').click()
  await expect(page.locator('.settings-shell')).toBeVisible()
  await shot(page, 'settings-sheet.png')
})
