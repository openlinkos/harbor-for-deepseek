import { expect, test, type Page, type Route } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const shots = join(process.cwd(), '../../docs/screenshots')
mkdirSync(shots, { recursive: true })

const thinking = [
  { type: 'message_start', message: { id: 'req-add', model: 'deepseek-flash', usage: { input_tokens: 49, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 0, service_tier: 'standard' } } },
  { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: '3+5=8' } },
  { type: 'content_block_stop', index: 0 },
  { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
  { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: '8' } },
  { type: 'content_block_stop', index: 1 },
  { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null, title: '简单加法' }, usage: { input_tokens: 41, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 33, service_tier: 'standard', output_tokens_details: { thinking_tokens: 31 } } },
  { type: 'message_stop' },
]

const sse = (events: unknown[]) => `${events.map((event) => `event: ${(event as { type: string }).type}\ndata: ${JSON.stringify(event)}\n\n`).join('')}: keep-alive\n\n`

const fulfill = async (route: Route) => {
  const url = route.request().url()
  if (url.endsWith('/user/balance')) {
    await route.fulfill({
      json: { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '317.22', granted_balance: '0.00', topped_up_balance: '317.22' }] },
    })
    return
  }
  if (url.endsWith('/models')) {
    await route.fulfill({ json: { data: [{ id: 'deepseek-flash' }, { id: 'deepseek-v4-pro' }] } })
    return
  }
  if (url.includes('/messages')) {
    await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: sse(thinking) })
    return
  }
  await route.fulfill({ status: 404, json: { error: { message: 'not mocked' } } })
}

const install = async (page: Page) => {
  await page.addInitScript(() => {
    ;(window as unknown as { Capacitor: { isNativePlatform: () => boolean; getPlatform: () => string } }).Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => 'android',
    }
  })
  await page.route('https://api.deepseek.com/**', fulfill)
}

test('native shell keeps the key on device and offers a server address', async ({ page }) => {
  await install(page)
  await page.goto('/')
  const policy = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')
  expect(policy).toContain('https:')
  expect(policy).toContain('capacitor:')
  await expect(page.getByRole('heading', { name: 'DeepAPI' })).toBeVisible()
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()
  await page.getByTestId('composer').fill('3 加 5 等于几？')
  await page.getByTestId('send').click()
  await expect(page.getByTestId('assistant-text')).toContainText('8')
  await page.screenshot({ path: join(shots, '11-android-byok.png') })
  await page.getByTestId('menu').click()
  await page.getByTestId('user-menu').click()
  await page.getByTestId('settings-open').click()
  await page.getByRole('button', { name: '数据管理' }).click()
  await expect(page.getByTestId('server-url')).toBeVisible()
  await expect(page.getByTestId('allow-lan')).toBeVisible()
  await page.screenshot({ path: join(shots, '12-android-server.png') })
})
