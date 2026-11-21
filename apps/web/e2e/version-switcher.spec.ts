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

let answer = '春天是大地从漫长的沉默里，轻轻呼出的一口气。'
let gate: Promise<void> = Promise.resolve()
let hold = false

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
  if (hold) {
    hold = false
    await gate
  }
  await route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse(answer) })
}

const boot = async (page: Page) => {
  answer = '春天是大地从漫长的沉默里，轻轻呼出的一口气。'
  hold = false
  gate = Promise.resolve()
  await page.route('https://api.deepseek.com/**', fulfill)
  await page.addInitScript(() => localStorage.setItem('deepapi-theme', 'light'))
  await page.setViewportSize({ width: 1440, height: 900 })
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

const ask = async (page: Page, text: string) => {
  await page.getByTestId('composer').fill(text)
  await page.getByTestId('send').click()
  await expect(page.getByTestId('assistant-text')).toContainText(answer)
}

const armHold = () => {
  let release = () => {}
  gate = new Promise((resolve) => { release = resolve })
  hold = true
  return release
}

test('regenerating shows dots, then ‹ 2 / 2 › with disabled and hover colors', async ({ page }) => {
  await boot(page)
  await ask(page, '写一句关于春天的话')
  answer = '第二版春天。'
  const release = armHold()
  await page.getByTestId('regenerate').click()
  await expect(page.getByTestId('reply-dots')).toBeVisible()
  await expect(page.getByTestId('versions')).toHaveCount(0)
  await expect(page.getByTestId('assistant-text')).toHaveCount(0)
  await saveShot(page, 'versions-01-regenerating-placeholder-dots.png')
  release()
  const versions = page.getByTestId('versions')
  await expect(versions).toContainText('2 / 2')
  await expect(page.getByTestId('assistant-text')).toContainText('第二版春天')
  const prev = versions.getByRole('button', { name: '‹' })
  const next = versions.getByRole('button', { name: '›' })
  await expect(prev).toBeEnabled()
  await expect(next).toBeDisabled()
  await expect(prev.locator('svg')).toHaveAttribute('width', '14')
  await expect(next.locator('svg')).toHaveAttribute('width', '14')
  const box = await prev.boundingBox()
  expect(box?.width).toBe(28)
  expect(box?.height).toBe(28)
  const count = versions.locator('.branch-count')
  await expect(count).toHaveCSS('font-size', '15px')
  await expect(count).toHaveCSS('font-weight', '500')
  await expect(count).toHaveCSS('line-height', '18px')
  await expect(count).toHaveCSS('color', 'rgb(129, 133, 140)')
  await expect(next).toHaveCSS('color', 'rgb(173, 178, 184)')
  await expect(prev).toHaveCSS('color', 'rgb(129, 133, 140)')
  await saveShot(page, 'versions-02-switcher-2of2.png')
  await prev.hover()
  await expect(prev).toHaveCSS('background-color', 'rgba(38, 49, 72, 0.06)')
  await saveShot(page, 'versions-03-hover-prev-arrow-fullpage.png')
  await next.hover()
  await expect(next).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await prev.click()
  await expect(versions).toContainText('1 / 2')
  await expect(page.getByTestId('assistant-text')).toContainText('轻轻呼出的一口气')
  await expect(prev).toBeDisabled()
  await expect(next).toBeEnabled()
  await expect(prev).toHaveCSS('color', 'rgb(173, 178, 184)')
  await saveShot(page, 'versions-04-switcher-1of2-prev-disabled.png')
  await next.hover()
  await expect(next).toHaveCSS('background-color', 'rgba(38, 49, 72, 0.06)')
  await saveShot(page, 'versions-05-hover-next-arrow-at-1of2.png')
})

test('edited user message shows ‹ 2 / 2 › beside copy and edit', async ({ page }) => {
  await boot(page)
  await ask(page, '写一句关于春天的话')
  answer = '夏天的风，是冰镇汽水打开时，那一声“呲啦”的轻响。'
  await page.getByRole('button', { name: '编辑' }).click()
  await page.locator('.edit-card textarea').fill('写一句关于夏天的话')
  await page.locator('.edit-card button.primary').click()
  await expect(page.getByTestId('assistant-text')).toContainText('夏天的风')
  const user = page.locator('.turn.user').getByTestId('versions')
  await expect(user).toContainText('2 / 2')
  await expect(page.locator('.turn.assistant').getByTestId('versions')).toHaveCount(0)
  const prev = user.getByRole('button', { name: '‹' })
  const next = user.getByRole('button', { name: '›' })
  await expect(prev).toBeEnabled()
  await expect(next).toBeDisabled()
  await expect(next).toHaveCSS('color', 'rgb(173, 178, 184)')
  const row = await page.locator('.turn.user .user-actions').boundingBox()
  const bubble = await page.locator('.turn.user .bubble').boundingBox()
  expect(row && bubble ? row.y : 0).toBeGreaterThan(bubble?.y ?? 0)
  await saveShot(page, 'versions-07-user-message-switcher-2of2.png')
  await prev.hover()
  await expect(prev).toHaveCSS('background-color', 'rgba(38, 49, 72, 0.06)')
  await saveShot(page, 'versions-08-hover-user-switcher-prev.png')
  await prev.click()
  await expect(user).toContainText('1 / 2')
  await expect(page.locator('.turn.user .bubble')).toContainText('写一句关于春天的话')
  await expect(prev).toBeDisabled()
  await expect(next).toBeEnabled()
})
