// Code banner geometry: sticky bar, copy button, and pre metrics.
import { expect, test, type Page, type Route } from '@playwright/test'

const sse = (events: unknown[]) => events.map((event) => `event: ${(event as { type: string }).type}\ndata: ${JSON.stringify(event)}\n\n`).join('')

const install = async (page: Page) => {
  await page.route('https://api.deepseek.com/**', async (route: Route) => {
    const url = route.request().url()
    if (url.endsWith('/user/balance')) return route.fulfill({ json: { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '1', granted_balance: '0', topped_up_balance: '1' }] } })
    if (url.endsWith('/models')) return route.fulfill({ json: { data: [{ id: 'deepseek-flash' }] } })
    if (url.includes('/messages')) {
      const events = [
        { type: 'message_start', message: { id: 'req-code', model: 'deepseek-flash' } },
        { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '```js\nconst n = 1\n```\n' } },
        { type: 'content_block_stop', index: 0 },
        { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { input_tokens: 1, output_tokens: 2 } },
        { type: 'message_stop' },
      ]
      return route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: sse(events) })
    }
    return route.fulfill({ status: 404, json: {} })
  })
}

test('code banner matches the sticky bar and copy button', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await install(page)
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await page.getByTestId('composer').fill('代码')
  await page.getByTestId('send').click()
  const sticky = page.locator('.code-sticky')
  const head = page.locator('.code-head')
  const pre = page.locator('.code-card pre')
  const copy = page.locator('.ds-markdown-code-copy-button')
  await expect(sticky).toBeVisible()
  await expect(sticky).toHaveCSS('position', 'sticky')
  await expect(sticky).toHaveCSS('top', '0px')
  await expect(sticky).toHaveCSS('z-index', '6')
  await expect(sticky).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(sticky).toHaveCSS('border-top-left-radius', '12px')
  await expect(head).toHaveCSS('padding', '9px 14px')
  await expect(head).toHaveCSS('font-size', '13px')
  await expect(head).toHaveCSS('line-height', '20px')
  await expect(head).toHaveCSS('background-color', 'rgb(249, 250, 251)')
  await expect(copy).toHaveCSS('padding', '0px')
  await expect(copy).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(copy).toHaveCSS('color', 'rgb(15, 17, 21)')
  await expect(pre).toHaveCSS('padding', '16px')
  await expect(pre).toHaveCSS('font-size', '13px')
  await expect(pre.locator('code')).toHaveCSS('line-height', '22px')
  await page.evaluate(() => document.body.setAttribute('data-ds-dark-theme', ''))
  await expect(sticky).toHaveCSS('background-color', 'rgb(21, 21, 23)')
  await expect(head).toHaveCSS('background-color', 'rgb(44, 44, 46)')
  await expect(copy).toHaveCSS('color', 'rgb(249, 250, 251)')
})
