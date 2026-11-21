import { expect, test, type Page, type Route } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const shots = '/workspace/deepapi-dev/tasks/M-shots'
mkdirSync(shots, { recursive: true })

const chart = ['```mermaid', 'graph LR', '  A-->B', '```'].join('\n')
const wide = ['```mermaid', 'graph LR', '  A-->B-->C-->D-->E-->F-->G-->H-->I-->J', '```'].join('\n')

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

let answer = chart

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
  await route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse(answer) })
}

const boot = async (page: Page, width = 1440, height = 900) => {
  answer = chart
  await page.route('https://api.deepseek.com/**', fulfill)
  await page.addInitScript(() => localStorage.setItem('deepapi-theme', 'light'))
  await page.setViewportSize({ width, height })
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()
  for (const id of ['toggle-thinking', 'toggle-search']) {
    const chip = page.getByTestId(id)
    if ((await chip.getAttribute('class'))?.includes('on')) await chip.click()
  }
}

const ask = async (page: Page) => {
  await page.getByTestId('composer').fill('画一张图')
  await page.getByTestId('send').click()
  await expect(page.getByTestId('mermaid-card').locator('.diagram-view svg')).toBeVisible({ timeout: 15_000 })
}

test('diagram fullscreen is a modal, zoom has a tooltip, download does not open a format menu', async ({ page }) => {
  await boot(page)
  await ask(page)
  const card = page.getByTestId('mermaid-card')
  await expect(card.getByRole('tab', { name: '图表' })).toHaveAttribute('aria-selected', 'true')
  await page.screenshot({ path: join(shots, 'mermaid-01-default-diagram-view-toggle-Diagram-Code.png') })
  await card.getByRole('button', { name: '放大' }).hover()
  await expect(page.getByRole('tooltip')).toHaveText('放大')
  await page.screenshot({ path: join(shots, 'mermaid-04-diagram-zoom-in-tooltip.png') })
  await card.getByRole('button', { name: '放大' }).click()
  await expect(card.locator('.mermaid')).toHaveCSS('transform', /matrix|scale/)
  await page.screenshot({ path: join(shots, 'mermaid-05-diagram-zoomed-in.png') })
  const downloadPromise = page.waitForEvent('download')
  await card.getByRole('button', { name: '下载' }).click()
  await expect(card.locator('.diagram-menu')).toHaveCount(0)
  expect((await downloadPromise).suggestedFilename()).toBe('diagram.svg')
  await card.getByRole('button', { name: '全屏' }).click()
  const modal = page.getByTestId('mermaid-modal')
  await expect(modal).toBeVisible()
  await expect(modal.locator('.mermaid svg')).toBeVisible()
  await expect(page.locator('.diagram-modal-card')).toBeVisible()
  const shell = await page.locator('.diagram-modal-card').boundingBox()
  const view = page.viewportSize()
  expect(shell && view && shell.y).toBeGreaterThan(8)
  expect(shell && view && shell.y + shell.height).toBeLessThan(view.height - 8)
  await page.screenshot({ path: join(shots, 'mermaid-03-diagram-fullscreen-modal.png') })
  await modal.getByRole('button', { name: '关闭' }).click()
  await expect(modal).toHaveCount(0)
  await card.getByRole('tab', { name: '代码' }).click()
  await expect(card.getByRole('button', { name: '复制' })).toBeVisible()
  await expect(card.getByRole('button', { name: '下载' })).toBeVisible()
  await expect(card.getByRole('button', { name: '全屏' })).toBeVisible()
  await expect(card.locator('.diagram-source')).toContainText('graph LR')
  await page.screenshot({ path: join(shots, 'mermaid-02-code-view-Copy-Download-Fullscreen.png') })
})

test('a wide diagram stays inside the card at 390px', async ({ page }) => {
  await boot(page, 390, 844)
  answer = wide
  await ask(page)
  const card = page.getByTestId('mermaid-card')
  const svg = card.locator('.diagram-view svg')
  const cardBox = await card.boundingBox()
  const svgBox = await svg.boundingBox()
  expect(cardBox && svgBox && svgBox.x).toBeGreaterThanOrEqual((cardBox?.x ?? 0) - 1)
  expect(cardBox && svgBox && svgBox.x + svgBox.width).toBeLessThanOrEqual((cardBox?.x ?? 0) + (cardBox?.width ?? 0) + 1)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
  expect(overflow).toBe(false)
  await page.screenshot({ path: join(shots, 'mermaid-mobile-390-08-no-overflow.png') })
})
