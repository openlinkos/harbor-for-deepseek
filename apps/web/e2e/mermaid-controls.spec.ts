import { expect, test, type Page, type Route } from '@playwright/test'
import { saveShot } from './lib/parity-shots'

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

const boot = async (page: Page, width = 1440, height = 900, theme: 'light' | 'dark' = 'light') => {
  answer = chart
  await page.route('https://api.deepseek.com/**', fulfill)
  await page.addInitScript((value) => localStorage.setItem('deepapi-theme', value), theme)
  await page.setViewportSize({ width, height })
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()
  for (const id of ['toggle-thinking', 'toggle-search']) {
    const chip = page.getByTestId(id)
    if (await chip.evaluate((node) => node.classList.contains('on'))) await chip.click()
  }
}

const ask = async (page: Page) => {
  await page.getByTestId('composer').fill('画一张图')
  await page.getByTestId('send').click()
  await expect(page.getByTestId('mermaid-card').locator('.diagram-view svg')).toBeVisible({ timeout: 15_000 })
}

test('diagram fullscreen is a modal, zoom has a tooltip, download opens the format menu', async ({ page }) => {
  await boot(page)
  await ask(page)
  const card = page.getByTestId('mermaid-card')
  await expect(card.getByRole('tab', { name: '图表' })).toHaveAttribute('aria-selected', 'true')
  await saveShot(page, 'mermaid-01-default-diagram-view-toggle-Diagram-Code.png')
  await card.getByRole('button', { name: '放大' }).hover()
  await expect(page.getByRole('tooltip')).toHaveText('放大')
  await saveShot(page, 'mermaid-04-diagram-zoom-in-tooltip.png')
  await card.getByRole('button', { name: '放大' }).click()
  await expect(card.locator('.mermaid')).toHaveCSS('transform', /matrix|scale/)
  await saveShot(page, 'mermaid-05-diagram-zoomed-in.png')
  await card.getByRole('button', { name: '下载', exact: true }).click()
  await expect(card.getByRole('menuitem', { name: '下载 PNG' })).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await card.getByRole('menuitem', { name: '下载 SVG' }).click()
  expect((await downloadPromise).suggestedFilename()).toBe('diagram.svg')
  await card.getByRole('button', { name: '全屏' }).click()
  const modal = page.getByTestId('mermaid-modal')
  await expect(modal).toBeVisible()
  await expect(modal.locator('.mermaid svg')).toBeVisible()
  await expect(page.locator('.diagram-modal-card')).toBeVisible()
  const stage = await page.locator('.diagram-modal').boundingBox()
  const view = page.viewportSize()
  // SP-MOD-597. .ds-fancy-box fills the viewport. The plate is the card inside it, not the stage.
  expect(stage && view && stage.y).toBeLessThanOrEqual(1)
  expect(stage && view && Math.abs(stage.width - view.width)).toBeLessThanOrEqual(1)
  expect(stage && view && Math.abs(stage.height - view.height)).toBeLessThanOrEqual(1)
  const plate = await page.locator('.diagram-modal-card').boundingBox()
  expect(plate && view && plate.height).toBeLessThan(view.height - 1)
  await saveShot(page, 'mermaid-03-diagram-fullscreen-modal.png')
  await modal.getByRole('button', { name: '关闭' }).click()
  await expect(modal).toHaveCount(0)
  await card.getByRole('tab', { name: '代码' }).click()
  await expect(card.getByRole('button', { name: '复制' })).toBeVisible()
  await expect(card.getByRole('button', { name: '下载' })).toBeVisible()
  await expect(card.getByRole('button', { name: '全屏' })).toBeVisible()
  await expect(card.locator('.diagram-source')).toContainText('graph LR')
  await saveShot(page, 'mermaid-02-code-view-Copy-Download-Fullscreen.png')
})

const channel = (paint: string) => paint.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? []

const luminance = (paint: string) => {
  const parts = channel(paint)
  if (parts.length < 3) return 0
  const [r, g, b] = parts.map((value) => {
    const unit = value / 255
    return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const contrast = (fill: string, color: string) => {
  const hi = Math.max(luminance(fill), luminance(color))
  const lo = Math.min(luminance(fill), luminance(color))
  return (hi + 0.05) / (lo + 0.05)
}

const nodePaint = (page: Page) => page.getByTestId('mermaid-card').locator('.diagram-view .node').first().evaluate((node) => {
  const rect = node.querySelector('rect, polygon, circle, ellipse, path')
  const label = node.querySelector('foreignObject div, foreignObject span, text')
  const rectStyle = rect ? getComputedStyle(rect) : null
  const labelStyle = label ? getComputedStyle(label) : null
  return {
    fill: rectStyle?.fill ?? '',
    stroke: rectStyle?.stroke ?? '',
    text: (label?.textContent ?? '').trim(),
    color: labelStyle?.color ?? '',
    opacity: labelStyle?.opacity ?? '',
    visibility: labelStyle?.visibility ?? '',
  }
})

test('light theme node fill follows mermaid and the label stays visible', async ({ page }) => {
  await boot(page)
  await ask(page)
  const paint = await nodePaint(page)
  expect(paint.text.length).toBeGreaterThan(0)
  expect(paint.opacity).not.toBe('0')
  expect(paint.visibility).not.toBe('hidden')
  expect(paint.fill).not.toBe('rgb(0, 0, 0)')
  expect(paint.fill).not.toBe('rgba(0, 0, 0, 0)')
  expect(paint.fill).not.toBe('transparent')
  expect(paint.fill).not.toBe('none')
  expect(paint.stroke).not.toBe('none')
  expect(paint.color).not.toBe(paint.fill)
  expect(contrast(paint.fill, paint.color)).toBeGreaterThan(3)
})

test('dark theme mermaid nodes stay readable', async ({ page }) => {
  await boot(page, 1440, 900, 'dark')
  await ask(page)
  await expect(page.locator('body')).toHaveAttribute('data-ds-dark-theme', '')
  const paint = await nodePaint(page)
  expect(paint.text.length).toBeGreaterThan(0)
  expect(paint.opacity).not.toBe('0')
  expect(paint.fill).not.toBe('rgb(0, 0, 0)')
  expect(paint.stroke).not.toBe('none')
  expect(contrast(paint.fill, paint.color)).toBeGreaterThan(3)
})

// SP-MOD-597 / the .ds-fancy-box rule (width/height 100%) and SP-MOD-265/266.
// The fullscreen stage tracks the viewport. The mask is rgba(0,0,0,.88) plus blur(2px),
// so the page shows through. A fixed 906×965 card and an opaque rgb(31,31,31) scrim fail this.
// The plate (.diagram-modal-card) is a wrapped card, not this stage.
test('mermaid fullscreen tracks the viewport and the mask is not opaque', async ({ page }) => {
  test.setTimeout(90_000)
  await boot(page, 1440, 900)
  await ask(page)
  for (const [w, h] of [[1440, 900], [1100, 700]] as const) {
    await page.setViewportSize({ width: w, height: h })
    await page.getByTestId('mermaid-card').getByRole('button', { name: '全屏' }).click()
    const panel = await page.locator('.diagram-modal').boundingBox()
    expect.soft(panel, `stage box at ${w}x${h}`).not.toBeNull()
    expect.soft(Math.abs((panel?.width ?? 0) - w), `stage width tracks ${w}, got ${panel?.width}`).toBeLessThanOrEqual(1)
    expect.soft(Math.abs((panel?.height ?? 0) - h), `stage height tracks ${h}, got ${panel?.height}`).toBeLessThanOrEqual(1)
    expect.soft(panel?.x ?? 99, `stage x at ${w}`).toBeLessThanOrEqual(1)
    expect.soft(panel?.y ?? 99, `stage y at ${h}`).toBeLessThanOrEqual(1)
    const mask = page.locator('.diagram-modal .bg-mask')
    expect.soft(await mask.count(), 'official .bg-mask is present').toBe(1)
    if (await mask.count()) {
      const paint = await mask.evaluate((node) => {
        const style = getComputedStyle(node)
        return { bg: style.backgroundColor, filter: style.backdropFilter }
      })
      expect.soft(paint.bg, 'mask is rgba(0,0,0,.88)').toBe('rgba(0, 0, 0, 0.88)')
      expect.soft(paint.filter, 'mask blurs 2px').toBe('blur(2px)')
    }
    await page.getByTestId('mermaid-modal').getByRole('button', { name: '关闭' }).click()
  }
})

// Master a8df8b9 .diagram-modal padding is 48px 56px, phone 40px 12px 16px.
// The plate is fit-content with padding 28px 24px (master .diagram-modal-card).
// Svg caps are that inset minus the card padding: desktop 160×152, phone 72×112.
// Staged b5a225c measured the plate svg at the full viewport height (329×900 at 1440, 329×844 at 390).
const fitChain = (direction: 'LR' | 'TD') => {
  const ids = 'ABCDEFGHIJKLMNOPQRST'.split('')
  const edges = ids.slice(0, -1).map((id, index) => `  ${id}-->${ids[index + 1]}`).join('\n')
  return ['```mermaid', `graph ${direction}`, edges, '```'].join('\n')
}

for (const theme of ['light', 'dark'] as const) {
  for (const name of ['wide', 'tall'] as const) {
    test(`fullscreen ${name} chart fits at 1440 and 390 ${theme}`, async ({ page }) => {
      test.setTimeout(90_000)
      await boot(page, 1440, 900, theme)
      answer = fitChain(name === 'wide' ? 'LR' : 'TD')
      await ask(page)
      for (const [w, h] of [[1440, 900], [390, 844]] as const) {
        await page.setViewportSize({ width: w, height: h })
        await page.getByTestId('mermaid-card').getByRole('button', { name: '全屏' }).click()
        const modal = page.getByTestId('mermaid-modal')
        await expect(modal).toBeVisible()
        const phone = w < 768
        const padTop = phone ? 40 : 48
        const padBottom = phone ? 16 : 48
        const padLeft = phone ? 12 : 56
        const padRight = phone ? 12 : 56
        const capW = w - (phone ? 72 : 160)
        const capH = h - (phone ? 112 : 152)
        const card = page.locator('.diagram-modal-card')
        const svg = card.locator('.mermaid svg')
        await expect(svg).toBeVisible()
        const cardBox = await card.boundingBox()
        const svgBox = await svg.boundingBox()
        expect(cardBox, `${theme} ${name} ${w} card`).not.toBeNull()
        expect(svgBox, `${theme} ${name} ${w} svg`).not.toBeNull()
        if (!cardBox || !svgBox) continue
        expect(cardBox.height, `${theme} ${name} ${w} card is not the viewport`).toBeLessThan(h - 1)
        expect(cardBox.y, `${theme} ${name} ${w} card below the slide top inset`).toBeGreaterThanOrEqual(padTop - 1)
        expect(cardBox.y + cardBox.height, `${theme} ${name} ${w} card above the slide bottom inset`).toBeLessThanOrEqual(h - padBottom + 1)
        expect(cardBox.x, `${theme} ${name} ${w} card inside the slide left inset`).toBeGreaterThanOrEqual(padLeft - 1)
        expect(cardBox.x + cardBox.width, `${theme} ${name} ${w} card inside the slide right inset`).toBeLessThanOrEqual(w - padRight + 1)
        expect(Math.abs(svgBox.x - cardBox.x - 24), `${theme} ${name} ${w} card pad left`).toBeLessThanOrEqual(1)
        expect(Math.abs(cardBox.x + cardBox.width - (svgBox.x + svgBox.width) - 24), `${theme} ${name} ${w} card pad right`).toBeLessThanOrEqual(1)
        expect(Math.abs(svgBox.y - cardBox.y - 28), `${theme} ${name} ${w} card pad top`).toBeLessThanOrEqual(1)
        expect(Math.abs(cardBox.y + cardBox.height - (svgBox.y + svgBox.height) - 28), `${theme} ${name} ${w} card pad bottom`).toBeLessThanOrEqual(1)
        expect(svgBox.x, `${theme} ${name} ${w} svg in viewport`).toBeGreaterThanOrEqual(-1)
        expect(svgBox.y, `${theme} ${name} ${w} svg in viewport`).toBeGreaterThanOrEqual(-1)
        expect(svgBox.x + svgBox.width, `${theme} ${name} ${w} svg in viewport`).toBeLessThanOrEqual(w + 1)
        expect(svgBox.y + svgBox.height, `${theme} ${name} ${w} svg in viewport`).toBeLessThanOrEqual(h + 1)
        expect(svgBox.width, `${theme} ${name} ${w} svg width cap`).toBeLessThanOrEqual(capW + 1)
        expect(svgBox.height, `${theme} ${name} ${w} svg height cap`).toBeLessThanOrEqual(capH + 1)
        const intrinsic = await svg.evaluate((node) => {
          const box = node.viewBox?.baseVal
          const attrW = Number.parseFloat(node.getAttribute('width') || '')
          const attrH = Number.parseFloat(node.getAttribute('height') || '')
          return {
            width: Number.isFinite(attrW) && node.getAttribute('width') !== '100%' ? attrW : box?.width ?? 0,
            height: Number.isFinite(attrH) && attrH > 0 ? attrH : box?.height ?? 0,
          }
        })
        const plate = await svg.evaluate((node) => getComputedStyle(node).backgroundColor)
        expect(plate, `${theme} ${name} ${w} plate`).toBe(theme === 'dark' ? 'rgb(44, 44, 46)' : 'rgb(249, 250, 251)')
        if (name === 'wide') {
          expect(intrinsic.width, `${theme} wide ${w} is wider than the cap`).toBeGreaterThan(capW)
          expect(svgBox.width, `${theme} wide ${w} scales down`).toBeLessThan(intrinsic.width - 1)
        } else {
          expect(intrinsic.height, `${theme} tall ${w} is taller than the cap`).toBeGreaterThan(capH)
          expect(svgBox.height, `${theme} tall ${w} scales down`).toBeLessThan(intrinsic.height - 1)
        }
        await page.keyboard.press('Escape')
        await expect(modal).toHaveCount(0)
      }
    })
  }
}

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
  await saveShot(page, 'mermaid-mobile-390-08-no-overflow.png')
})
