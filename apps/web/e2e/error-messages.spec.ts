import { expect, test, type Page, type Route } from '@playwright/test'
import { saveShot } from './lib/parity-shots'

const sse = (text: string) => {
  const events = [
    { type: 'message_start', message: { id: 'req', model: 'deepseek-flash' } },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { input_tokens: 8, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 4, service_tier: 'standard' } },
    { type: 'message_stop' },
  ]
  return `${events.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join('')}: keep-alive\n\n`
}

let mode: 'ok' | 'network' | '503' | '402' | '401' = 'ok'

const fulfill = async (route: Route) => {
  const url = route.request().url()
  if (url.endsWith('/user/balance')) {
    await route.fulfill({ json: { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '1.00', granted_balance: '0.00', topped_up_balance: '1.00' }] } })
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
  if (mode === 'network') {
    await route.abort('failed')
    return
  }
  if (mode === '503' || mode === '402' || mode === '401') {
    await route.fulfill({
      status: Number(mode),
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: { message: `status ${mode}` } }),
    })
    return
  }
  await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: sse('已重新发出') })
}

const unlock = async (page: Page) => {
  mode = 'ok'
  await page.route('https://api.deepseek.com/**', fulfill)
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()
}

const send = async (page: Page, text: string) => {
  await page.getByTestId('composer').fill(text)
  await page.getByTestId('send').click()
}

test('network failure before the stream shows the official hint and retry', async ({ page }) => {
  await unlock(page)
  mode = 'network'
  await send(page, '写一篇文章')
  const hint = page.getByTestId('user-hint')
  const retry = page.getByTestId('hint-retry')
  await expect(hint).toHaveText('请检查网络后重试')
  await expect(retry).toBeVisible()
  await expect(page.locator('.form-error')).toHaveCount(0)
  await expect(page.getByTestId('message-assistant')).toHaveCount(0)
  await expect(retry).toHaveCSS('width', '24px')
  await expect(retry).toHaveCSS('height', '24px')
  await expect(retry).toHaveCSS('background-color', 'rgb(245, 158, 11)')
  await expect(hint).toHaveCSS('font-size', '14px')
  await expect(hint).toHaveCSS('color', 'rgb(129, 133, 140)')
  const button = await retry.boundingBox()
  const bubble = await page.locator('.turn.user .bubble').boundingBox()
  expect(button).toBeTruthy()
  expect(bubble).toBeTruthy()
  if (button && bubble) {
    expect(Math.round(bubble.x - (button.x + button.width))).toBe(13)
  }
  await saveShot(page, 'error-stream-interrupt-01-offline-t0-check-network-and-retry.png')
  await retry.hover()
  await expect(retry).toHaveCSS('background-color', 'rgb(247, 173, 49)')
  mode = 'ok'
  await retry.click()
  await expect(page.getByTestId('assistant-text')).toContainText('已重新发出')
  await expect(page.getByTestId('user-hint')).toHaveCount(0)
  await saveShot(page, 'error-stream-interrupt-04-after-retry-click-streaming.png')
})

test('HTTP 503, 402, and 401 keep the assistant error row and use bundle text', async ({ page }) => {
  await unlock(page)
  mode = '503'
  await send(page, '服务不可用')
  await expect(page.locator('.form-error').last()).toContainText('服务器繁忙，请稍后再试')
  await expect(page.getByTestId('retry')).toBeVisible()
  mode = '402'
  await send(page, '额度')
  await expect(page.locator('.form-error').last()).toContainText('使用额度已达上限，请额度恢复后再试')
  mode = '401'
  await send(page, '钥匙')
  await expect(page.locator('.form-error').last()).toContainText('登录信息已失效，请重新登录')
  await expect(page.getByTestId('retry').last()).toBeVisible()
})
