import { expect, test, type Page, type Route } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const shots = '/workspace/deepapi-dev/tasks/M-shots'
mkdirSync(shots, { recursive: true })

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
  await route.fulfill({ status: 404, json: {} })
}

const boot = async (page: Page, theme: 'light' | 'dark', width: number, height: number) => {
  await page.route('https://api.deepseek.com/**', fulfill)
  await page.addInitScript((value) => localStorage.setItem('deepapi-theme', value), theme)
  await page.setViewportSize({ width, height })
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()
}

const openSettings = async (page: Page, narrow: boolean) => {
  if (narrow) await page.getByTestId('menu').click()
  await page.getByTestId('user-menu').click()
  await page.getByTestId('settings-open').click()
  await expect(page.getByTestId('settings-dialog')).toBeVisible()
}

test('mobile settings is a centred card with space around it', async ({ page }) => {
  await boot(page, 'light', 390, 844)
  await openSettings(page, true)
  const shell = page.locator('.settings-shell')
  await expect(shell).toHaveCSS('border-top-left-radius', '24px')
  await expect(shell).toHaveCSS('border-bottom-left-radius', '24px')
  await expect(shell).toHaveCSS('border-bottom-right-radius', '24px')
  await expect(page.locator('.settings-nav')).toHaveCSS('flex-direction', 'row')
  const box = await shell.boundingBox()
  const view = page.viewportSize()
  expect(box && view && box.x).toBeGreaterThan(8)
  expect(box && view && box.y).toBeGreaterThan(8)
  expect(box && view && box.x + box.width).toBeLessThan(view.width - 8)
  expect(box && view && box.y + box.height).toBeLessThan(view.height - 8)
  await page.screenshot({ path: join(shots, 'mobile-390-04-settings.png') })
})

test('dark home, answer, and settings stay on the dark surfaces', async ({ page }) => {
  await boot(page, 'dark', 1440, 900)
  await expect(page.locator('body')).toHaveAttribute('data-ds-dark-theme', '')
  await page.screenshot({ path: join(shots, 'dark-01-home-dark.png') })
  await page.route('https://api.deepseek.com/**', async (route) => {
    const url = route.request().url()
    if (!url.includes('/messages')) {
      await fulfill(route)
      return
    }
    const events = [
      { type: 'message_start', message: { id: 'req', model: 'deepseek-flash' } },
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '夜色很安静。' } },
      { type: 'content_block_stop', index: 0 },
      { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { input_tokens: 4, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 2, service_tier: 'standard' } },
      { type: 'message_stop' },
    ]
    const body = `${events.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join('')}: keep-alive\n\n`
    await route.fulfill({ status: 200, contentType: 'text/event-stream', body })
  })
  for (const id of ['toggle-thinking', 'toggle-search']) {
    const chip = page.getByTestId(id)
    if ((await chip.getAttribute('class'))?.includes('on')) await chip.click()
  }
  await page.getByTestId('composer').fill('写一句')
  await page.getByTestId('send').click()
  await expect(page.getByTestId('assistant-text')).toContainText('夜色很安静')
  await page.screenshot({ path: join(shots, 'dark-02-chat-with-answer-dark.png') })
  await openSettings(page, false)
  const shell = page.locator('.settings-shell')
  await expect(shell).toBeVisible()
  await expect(shell).toHaveCSS('border-radius', '24px')
  await page.screenshot({ path: join(shots, 'dark-03-settings-dialog-dark.png') })
  await page.setViewportSize({ width: 390, height: 844 })
  const box = await shell.boundingBox()
  expect(box && box.y).toBeGreaterThan(8)
  expect(box && box.y + box.height).toBeLessThan(836)
  await expect(shell).toHaveCSS('border-bottom-left-radius', '24px')
  await page.screenshot({ path: join(shots, 'mobile-390-dark-03-settings.png') })
})
