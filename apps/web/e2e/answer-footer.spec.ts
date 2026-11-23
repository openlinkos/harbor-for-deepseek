// P2 回答底部：来源胶囊、操作栏图标、tooltip。
// 官方数值来自 official-fb1344.json（胶囊高/内边距/边框/底色、操作图标色）
// 和冻结的 main.dc093a796f.css：
// .f93f59e4 胶囊，.ds-button--icon.ds-button--iconLabelTertiary 操作按钮，
// .ds-tooltip.ds-tooltip--s（placement bottom，mainAxis 4，sharp 箭头 6px）。
// 390 没有 hover，跳过 tooltip 和 hover。分享点击仍是下载，选择模式留给 P7。
import { expect, test, type Locator, type Page } from '@playwright/test'

const PILL_H = 34
const ACTION = { light: 'rgb(129, 133, 140)', dark: 'rgb(173, 178, 184)' }
const PILL_BG = { light: 'rgb(255, 255, 255)', dark: 'rgb(21, 21, 23)' }
const PILL_BORDER = { light: 'rgba(0, 0, 0, 0.1)', dark: 'rgba(255, 255, 255, 0.12)' }
const HOVER_BG = { light: 'rgba(38, 49, 72, 0.06)', dark: 'rgba(255, 255, 255, 0.08)' }
const TIP_BG = { light: 'rgb(44, 44, 46)', dark: 'rgb(67, 69, 74)' }
const TIP_COLOR = { light: 'rgb(255, 255, 255)', dark: 'rgb(249, 250, 251)' }
const ACTION_LABELS = ['复制', '重新生成', '喜欢', '不喜欢', '分享']
const USER_LABELS = ['复制', '修改']

const sse = (events: unknown[]) => events.map((event) => `event: ${(event as { type: string }).type}\ndata: ${JSON.stringify(event)}\n\n`).join('')
const icon = (color: string) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" rx="3" fill="${color}"/></svg>`)
const results = ['#e11', '#1a1', '#11e'].map((color, index) => ({
  type: 'web_search_result',
  title: `来源 ${index + 1}`,
  url: `https://site${index + 1}.example/a`,
  snippet: `摘要 ${index + 1}`,
  site_name: `站点${index + 1}`,
  site_icon: icon(color),
  page_age: '2026-11-19',
}))
const answer = sse([
  { type: 'message_start', message: { id: 'r', model: 'deepseek-flash' } },
  { type: 'content_block_start', index: 0, content_block: { type: 'web_search_tool_result', tool_use_id: 's1', content: results } },
  { type: 'content_block_stop', index: 0 },
  { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
  { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: '今天上海降温。' } },
  { type: 'content_block_stop', index: 1 },
  { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null, title: '回答底部' }, usage: { input_tokens: 1, output_tokens: 1 } },
  { type: 'message_stop' },
])

const boot = async (page: Page, theme: string) => {
  await page.addInitScript((value) => localStorage.setItem('deepapi-theme', value), theme)
  await page.route('https://api.deepseek.com/**', async (route) => {
    const url = route.request().url()
    if (url.endsWith('/user/balance')) return route.fulfill({ json: { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '1', granted_balance: '0', topped_up_balance: '1' }] } })
    if (url.endsWith('/models')) return route.fulfill({ json: { data: [{ id: 'deepseek-flash' }] } })
    if (!url.includes('/messages')) return route.fulfill({ status: 404, json: {} })
    return route.fulfill({ status: 200, contentType: 'text/event-stream', body: answer })
  })
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()
  await page.addStyleTag({ content: '*{transition-duration:0s!important;transition-delay:0s!important}' })
  await page.getByTestId('composer').fill('回答底部')
  await page.getByTestId('send').click()
  await expect(page.getByTestId('assistant-text')).toContainText('今天上海降温')
}

const near = (actual: number, expected: number, tol: number) => {
  expect(Math.abs(actual - expected), `expected ${expected} ±${tol}, got ${actual}`).toBeLessThanOrEqual(tol)
}

const pillMetrics = (page: Page) => page.getByTestId('search-results').last().evaluate((pill) => {
  const box = pill.getBoundingClientRect()
  const style = getComputedStyle(pill)
  const textNode = [...pill.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && (node.textContent || '').trim())
  const range = document.createRange()
  range.selectNodeContents(textNode!)
  const text = range.getBoundingClientRect()
  const icons = [...pill.querySelectorAll('.favicons > *')].map((icon) => {
    const rect = icon.getBoundingClientRect()
    return { x: rect.x, y: rect.y, w: rect.width, h: rect.height, ml: getComputedStyle(icon).marginLeft }
  })
  const mid = (start: number, size: number) => start + size / 2
  const pillMid = mid(box.top, box.height)
  return {
    h: box.height,
    pad: [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft],
    radius: style.borderTopLeftRadius,
    bg: style.backgroundColor,
    border: style.borderTopColor,
    borderW: style.borderTopWidth,
    font: style.fontSize,
    lh: style.lineHeight,
    textDy: mid(text.top, text.height) - pillMid,
    iconDy: icons.map((icon) => mid(icon.y, icon.h) - pillMid),
    icon: icons,
    overlap: icons.length > 1 ? icons[0].x + icons[0].w - icons[1].x : null,
  }
})

const expectTooltip = async (button: Locator, theme: 'light' | 'dark') => {
  await button.hover()
  const page = button.page()
  const label = (await button.getAttribute('aria-label')) || ''
  const tip = page.getByRole('tooltip').filter({ hasText: label })
  await expect(tip).toBeVisible()
  const arrow = tip.locator('.ds-tooltip__arrow')
  await expect(arrow).toBeVisible()
  const geometry = await button.evaluate((node, tipLabel) => {
    const buttonBox = node.getBoundingClientRect()
    const tipNode = [...document.querySelectorAll('[role=tooltip]')].find((item) => item.textContent?.includes(tipLabel)) as HTMLElement
    const arrowNode = tipNode.querySelector('.ds-tooltip__arrow') as HTMLElement
    const tipBox = tipNode.getBoundingClientRect()
    const arrowBox = arrowNode.getBoundingClientRect()
    const style = getComputedStyle(tipNode)
    const arrowStyle = getComputedStyle(arrowNode)
    return {
      buttonBottom: buttonBox.y + buttonBox.height,
      tipY: tipBox.y,
      tipMidX: tipBox.x + tipBox.width / 2,
      arrowTop: arrowBox.y,
      arrowBottom: arrowBox.bottom,
      arrowMidX: arrowBox.x + arrowBox.width / 2,
      arrowW: arrowBox.width,
      arrowH: arrowBox.height,
      arrowCssW: Number.parseFloat(arrowStyle.width),
      arrowCssH: Number.parseFloat(arrowStyle.height),
      bg: style.backgroundColor,
      color: style.color,
      font: style.fontSize,
      lh: style.lineHeight,
      radius: style.borderTopLeftRadius,
      pad: style.padding,
      shadow: style.boxShadow,
      arrowBg: arrowStyle.backgroundColor,
    }
  }, label)
  near(geometry.tipY - geometry.buttonBottom, 4, 0.5)
  expect(geometry.tipY).toBeGreaterThan(geometry.buttonBottom - 1)
  expect(geometry.arrowTop).toBeLessThan(geometry.tipY)
  expect(geometry.arrowBottom).toBeGreaterThan(geometry.tipY)
  near((geometry.arrowTop + geometry.arrowBottom) / 2, geometry.tipY, 1)
  near(geometry.arrowMidX, geometry.tipMidX, 1)
  // Unrotated square is 6×1.414; the 45° diamond's axis-aligned box is 12px.
  near(geometry.arrowCssW, 6 * 1.414, 0.5)
  near(geometry.arrowCssH, 6 * 1.414, 0.5)
  near(geometry.arrowW, 12, 0.5)
  near(geometry.arrowH, 12, 0.5)
  expect(geometry.bg).toBe(TIP_BG[theme])
  expect(geometry.arrowBg).toBe(TIP_BG[theme])
  expect(geometry.color).toBe(TIP_COLOR[theme])
  expect(geometry.font).toBe('12px')
  expect(geometry.lh).toBe('18px')
  expect(geometry.radius).toBe('10px')
  expect(geometry.pad).toBe('4px 8px')
  if (theme === 'dark') expect(geometry.shadow).not.toBe('none')
  else expect(geometry.shadow).toBe('none')
}

for (const theme of ['light', 'dark'] as const) {
  for (const [width, height] of [[1440, 900], [390, 844]] as const) {
    test.describe(`answer footer ${theme} ${width}`, () => {
      test.use({ viewport: { width, height }, colorScheme: theme, bypassCSP: true })

      test('sources pill matches the official capsule', async ({ page }) => {
        await boot(page, theme)
        const pill = page.getByTestId('search-results').last()
        await expect(pill).toContainText('3 个网页')
        const metrics = await pillMetrics(page)
        near(metrics.h, PILL_H, 0.5)
        expect(metrics.pad).toEqual(['4px', '10px', '4px', '4px'])
        expect(metrics.radius).toBe('100px')
        expect(metrics.bg).toBe(PILL_BG[theme])
        expect(metrics.border).toBe(PILL_BORDER[theme])
        expect(metrics.borderW).toBe('1px')
        expect(metrics.font).toBe('14px')
        expect(metrics.lh).toBe('24px')
        near(metrics.textDy, 0, 1)
        expect(metrics.icon).toHaveLength(3)
        for (const dy of metrics.iconDy) near(dy, 0, 1)
        for (const mark of metrics.icon) {
          near(mark.w, 16, 0.5)
          near(mark.h, 16, 0.5)
        }
        expect(metrics.icon[0].ml).toBe('0px')
        expect(metrics.icon.slice(1).every((mark) => mark.ml === '-4px')).toBe(true)
        near(metrics.overlap ?? 99, 4, 0.5)
      })

      test('action icons use the official tertiary color', async ({ page }) => {
        await boot(page, theme)
        const row = page.locator('.action-row').last()
        const buttons = row.locator(':scope > button')
        await expect(buttons).toHaveCount(ACTION_LABELS.length)
        const colors = await buttons.evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).color))
        expect(colors).toEqual(ACTION_LABELS.map(() => ACTION[theme]))
        const labels = await buttons.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label')))
        expect(labels).toEqual(ACTION_LABELS)
      })

      test('action hover background matches official', async ({ page }) => {
        test.skip(width < 768, '390 has no hover')
        await boot(page, theme)
        const share = page.locator('.action-row button[aria-label="分享"]').last()
        await share.hover()
        const painted = await share.evaluate((node) => {
          const style = getComputedStyle(node)
          return { bg: style.backgroundColor, color: style.color }
        })
        expect(painted.bg).toBe(HOVER_BG[theme])
        expect(painted.color).toBe(ACTION[theme])
        const pill = page.getByTestId('search-results').last()
        await pill.hover()
        await expect(pill).toHaveCSS('background-color', HOVER_BG[theme])
      })

      test('tooltips sit below the trigger with an arrow', async ({ page }) => {
        test.skip(width < 768, '390 has no hover')
        await boot(page, theme)
        for (const label of ACTION_LABELS) {
          await expectTooltip(page.locator('.action-row button[aria-label="' + label + '"]').last(), theme)
        }
        for (const label of USER_LABELS) {
          await expectTooltip(page.locator('.user-actions button[aria-label="' + label + '"]').last(), theme)
        }
      })
    })
  }
}
