import { expect, test, type Locator, type Page, type Route } from '@playwright/test'

const sse = (events: unknown[]) =>
  `${events.map((event) => `event: ${(event as { type: string }).type}\ndata: ${JSON.stringify(event)}\n\n`).join('')}: keep-alive\n\n`

const answer = [
  { type: 'message_start', message: { id: 'req', model: 'deepseek-flash' } },
  { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '好' } },
  { type: 'content_block_stop', index: 0 },
  { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null, title: '图标' }, usage: { input_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 1, service_tier: 'standard', output_tokens_details: { thinking_tokens: 0 } } },
  { type: 'message_stop' },
]

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
  await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: sse(answer) })
}

type Ink = { w: number; h: number; coverage: number; box: number }

const inkOf = async (svg: Locator): Promise<Ink> => svg.evaluate(async (node) => {
  const source = node as SVGSVGElement
  const rect = source.getBoundingClientRect()
  const w = Math.max(1, Math.round(rect.width))
  const h = Math.max(1, Math.round(rect.height))
  const clone = source.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(w))
  clone.setAttribute('height', String(h))
  clone.style.color = '#111111'
  const xml = new XMLSerializer().serializeToString(clone)
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no canvas')
    ctx.drawImage(img, 0, 0, w, h)
    const data = ctx.getImageData(0, 0, w, h).data
    let minX = w
    let minY = h
    let maxX = -1
    let maxY = -1
    let count = 0
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        if (data[(y * w + x) * 4 + 3] <= 128) continue
        count += 1
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
    const iw = count ? maxX - minX + 1 : 0
    const ih = count ? maxY - minY + 1 : 0
    return { w: iw, h: ih, coverage: iw && ih ? count / (iw * ih) : 0, box: w }
  } finally {
    URL.revokeObjectURL(url)
  }
})

const unlock = async (page: Page) => {
  await page.route('https://api.deepseek.com/**', fulfill)
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()
}

test('settings, search, and row-menu icons match the official filled ink', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1072 })
  await unlock(page)
  await page.getByTestId('user-menu').click()
  await expect(page.locator('.user-menu svg[stroke]')).toHaveCount(0)
  await page.getByTestId('settings-open').click()
  await expect(page.getByTestId('settings-dialog')).toBeVisible()
  await page.locator('.settings-shell').evaluate(async (node) => {
    await Promise.all(node.getAnimations().map((animation) => animation.finished))
  })

  const nav = [
    { id: 'settings-nav-general', w: 16, h: 16, coverage: 0.41 },
    { id: 'settings-nav-account', w: 14, h: 14, coverage: 0.28 },
    { id: 'settings-nav-data', w: 14, h: 14, coverage: 0.28 },
    { id: 'settings-nav-legal', w: 13, h: 15, coverage: 0.22 },
  ]
  for (const spec of nav) {
    const svg = page.getByTestId(spec.id).locator('svg')
    await expect(svg).toHaveCount(1)
    await expect(svg).toHaveAttribute('fill', 'currentColor')
    const box = await svg.boundingBox()
    expect(Math.round(box?.width ?? 0)).toBe(16)
    expect(Math.round(box?.height ?? 0)).toBe(16)
    const ink = await inkOf(svg)
    expect(ink.w).toBeGreaterThanOrEqual(spec.w - 2)
    expect(ink.h).toBeGreaterThanOrEqual(spec.h - 2)
    expect(ink.coverage).toBeGreaterThanOrEqual(spec.coverage * 0.7)
  }

  const close = page.getByTestId('settings-close').locator('svg')
  await expect(close).toHaveAttribute('fill', 'currentColor')
  const closeBox = await close.boundingBox()
  expect(Math.round(closeBox?.width ?? 0)).toBe(14)
  expect(Math.round(closeBox?.height ?? 0)).toBe(14)
  const closeInk = await inkOf(close)
  expect(closeInk.w).toBeGreaterThanOrEqual(8)
  expect(closeInk.h).toBeGreaterThanOrEqual(8)
  expect(closeInk.coverage).toBeGreaterThanOrEqual(0.27 * 0.7)

  await page.getByTestId('settings-close').click()
  await page.keyboard.press('Control+k')
  const searchClose = page.locator('.search-dialog button[aria-label="关闭"] svg')
  await expect(searchClose).toBeVisible()
  const searchBox = await searchClose.boundingBox()
  expect(Math.round(searchBox?.width ?? 0)).toBe(14)
  expect(Math.round(searchBox?.height ?? 0)).toBe(14)
  const searchInk = await inkOf(searchClose)
  expect(searchInk.w).toBeGreaterThanOrEqual(8)
  expect(searchInk.h).toBeGreaterThanOrEqual(8)
  expect(searchInk.coverage).toBeGreaterThanOrEqual(0.27 * 0.7)
  await page.keyboard.press('Escape')

  await page.getByTestId('composer').fill('图标')
  await page.getByTestId('send').click()
  await expect(page.locator('.chat-link').first()).toBeVisible()
  await page.locator('.chat-link').first().hover()
  await page.locator('.chat-link .more').first().click()
  const menu = page.locator('.item-menu')
  await expect(menu).toBeVisible()
  await menu.evaluate(async (node) => {
    await Promise.all(node.getAnimations().map((animation) => animation.finished))
  })
  await expect(menu.locator('svg[stroke]')).toHaveCount(0)
  const multi = menu.getByRole('menuitem', { name: '多选' }).locator('svg')
  await expect(multi).toHaveAttribute('fill', 'currentColor')
  const multiBox = await multi.boundingBox()
  expect(Math.round(multiBox?.width ?? 0)).toBe(16)
  expect(Math.round(multiBox?.height ?? 0)).toBe(16)
  const multiInk = await inkOf(multi)
  expect(multiInk.w).toBeGreaterThanOrEqual(12)
  expect(multiInk.h).toBeGreaterThanOrEqual(12)
  expect(multiInk.coverage).toBeGreaterThanOrEqual(0.2)
})
