import { expect, test, type Page, type Route } from '@playwright/test'

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
}

const unlock = async (page: Page) => {
  await install(page)
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()
}

const focusedTestId = (page: Page) => page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.testid ?? document.activeElement?.tagName ?? '')

test('composer is focused after unlock, new chat, send, and closing overlays', async ({ page }) => {
  await unlock(page)
  await expect.poll(() => focusedTestId(page)).toBe('composer')

  await page.getByTestId('composer').fill('第一句')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('assistant-text')).toContainText('8')
  await expect.poll(() => focusedTestId(page)).toBe('composer')

  await page.getByTestId('new-chat').click()
  await expect(page.locator('.greeting')).toBeVisible()
  await expect.poll(() => focusedTestId(page)).toBe('composer')

  await page.getByTestId('composer').fill('第二句')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('assistant-text')).toBeVisible()
  await page.getByRole('button', { name: '加法' }).nth(1).click()
  await expect.poll(() => focusedTestId(page)).toBe('composer')

  await page.getByTestId('user-menu').click()
  await page.getByTestId('settings-open').click()
  await expect(page.getByTestId('settings-dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('settings-dialog')).toBeHidden()
  await expect.poll(() => focusedTestId(page)).toBe('composer')

  await page.keyboard.press('Control+k')
  await expect(page.getByRole('search')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('search')).toBeHidden()
  await expect.poll(() => focusedTestId(page)).toBe('composer')

  await page.keyboard.press('Control+j')
  await expect(page.locator('.greeting')).toBeVisible()
  await expect.poll(() => focusedTestId(page)).toBe('composer')
})

test('Enter sends and Shift+Enter keeps the draft', async ({ page }) => {
  await unlock(page)
  const box = page.getByTestId('composer')
  await box.fill('一行')
  await page.keyboard.press('Shift+Enter')
  await expect(box).toHaveValue('一行\n')
  await expect(page.getByTestId('assistant-text')).toHaveCount(0)
  await box.press('Enter')
  await expect(page.getByTestId('assistant-text')).toContainText('8')
  await expect(box).toHaveValue('')
})
