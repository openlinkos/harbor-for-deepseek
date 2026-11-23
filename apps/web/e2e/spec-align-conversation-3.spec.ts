// The message scroller is .transcript. The outline navigator is not rendered.
import { expect, test, type Page, type Route } from '@playwright/test'

const install = async (page: Page) => {
  await page.route('https://api.deepseek.com/**', async (route: Route) => {
    const url = route.request().url()
    if (url.endsWith('/user/balance')) return route.fulfill({ json: { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '1', granted_balance: '0', topped_up_balance: '1' }] } })
    if (url.endsWith('/models')) return route.fulfill({ json: { data: [{ id: 'deepseek-flash' }] } })
    return route.fulfill({ status: 404, json: {} })
  })
}

test('transcript scroll container keeps the pinned scroller metrics', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await install(page)
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()
  const list = page.getByTestId('message-list')
  await expect(list).toHaveCSS('overflow-y', 'auto')
  await expect(list).toHaveCSS('overflow-x', 'hidden')
  await expect(list).toHaveCSS('flex-grow', '1')
  await expect(list).toHaveCSS('position', 'static')
  await expect(list).toHaveCSS('max-width', '840px')
  const bar = await list.evaluate((node) => getComputedStyle(node).scrollbarWidth)
  expect(bar).toBe('none')
  const safe = await page.evaluate(() => {
    for (const sheet of document.styleSheets) {
      let rules: CSSRuleList
      try { rules = sheet.cssRules } catch { continue }
      for (const rule of rules) {
        if (!(rule instanceof CSSStyleRule)) continue
        if (rule.selectorText === '.composer-wrap' && rule.style.paddingBottom.includes('safe-area-inset-bottom')) return rule.style.paddingBottom
      }
    }
    return ''
  })
  expect(safe).toContain('safe-area-inset-bottom')
})
