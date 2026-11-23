// Hover-card site icon and the citation chrome we render.
// SP-CITE-158, 159, 160, 172, 173, 174, plus measured badge, card, and pill values.
// Panel and strip empty or failed icons use the same 14px link svg. site-icon.spec covers those.
import { expect, test, type Page } from '@playwright/test'
import { boot } from './lib/fb1721-boot'

const iconPixel = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
const broken = '/e2e-missing-icon.png'

const events = [
  { type: 'message_start', message: { id: 'req-icon', model: 'deepseek-flash' } },
  { type: 'content_block_start', index: 0, content_block: { type: 'web_search_tool_result', tool_use_id: 'tool-icon', kind: 'search', content: [
    { type: 'web_search_result', title: '有图', url: 'https://example.com/ok', snippet: '图', site_name: '有图站', site_icon: iconPixel, page_age: '2026-11-16' },
    { type: 'web_search_result', title: '无图', url: 'https://example.com/empty', snippet: '空', site_name: '无图站', site_icon: null, page_age: '2026-11-16' },
    { type: 'web_search_result', title: '坏图', url: 'https://example.com/bad', snippet: '坏', site_name: '坏图站', site_icon: broken, page_age: '2026-11-16' },
  ] } },
  { type: 'content_block_stop', index: 0 },
  { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
  { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: '第一句。' } },
  { type: 'content_block_delta', index: 1, delta: { type: 'citations_delta', citation: { type: 'web_search_result_location', url: 'https://example.com/ok', title: '有图', cited_text: '图', encrypted_index: '' } } },
  { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: '第二句。' } },
  { type: 'content_block_delta', index: 1, delta: { type: 'citations_delta', citation: { type: 'web_search_result_location', url: 'https://example.com/empty', title: '无图', cited_text: '空', encrypted_index: '' } } },
  { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: '第三句。' } },
  { type: 'content_block_delta', index: 1, delta: { type: 'citations_delta', citation: { type: 'web_search_result_location', url: 'https://example.com/bad', title: '坏图', cited_text: '坏', encrypted_index: '' } } },
  { type: 'content_block_stop', index: 1 },
  { type: 'message_delta', delta: { stop_reason: 'end_turn', title: '图标' }, usage: { input_tokens: 4, output_tokens: 4 } },
  { type: 'message_stop' },
]

const holdBroken = async (page: Page) => {
  let brokenHits = 0
  let hold = true
  const waiters: Array<() => void> = []
  await page.route('**/e2e-missing-icon.png', async (route) => {
    brokenHits += 1
    if (hold) await new Promise<void>((resolve) => waiters.push(resolve))
    await route.fulfill({ status: 404, contentType: 'image/png', body: 'no' })
  })
  return {
    hits: () => brokenHits,
    release: () => {
      hold = false
      waiters.splice(0).forEach((fn) => fn())
    },
  }
}

test('SP-CITE-158..174 hover icon keeps a loaded image and uses the link svg when empty or failed', async ({ page }) => {
  const brokenIcon = await holdBroken(page)
  await boot(page, 'light', { body: () => events, freezeTransitions: false })
  await page.getByTestId('composer').fill('图标')
  await page.getByTestId('send').click()
  const cites = page.getByTestId('assistant-text').locator('.cite')
  await expect(cites).toHaveText(['1', '2', '3'])

  const badge = cites.nth(0)
  await expect(badge).toHaveCSS('min-width', '14px')
  await expect(badge).toHaveCSS('height', '14px')
  await expect(badge).toHaveCSS('padding-left', '4px')
  await expect(badge).toHaveCSS('padding-right', '4px')
  await expect(badge).toHaveCSS('margin-left', '2px')
  await expect(badge).toHaveCSS('margin-right', '2px')
  await expect(badge).toHaveCSS('font-size', '9px')
  await expect(badge).toHaveCSS('font-weight', '500')
  await expect(badge).toHaveCSS('line-height', '14px')
  await expect(badge).toHaveCSS('display', 'inline-flex')
  await expect(badge).toHaveCSS('flex-shrink', '0')
  await expect(badge).toHaveCSS('top', '-5px')
  await expect(badge).toHaveCSS('border-radius', '6px 6px 6px 0px')
  await expect(badge).toHaveCSS('background-color', 'rgb(245, 246, 247)')
  await expect(badge).toHaveCSS('color', 'rgb(129, 133, 140)')
  await expect(badge).toHaveCSS('user-select', 'none')
  await expect(badge).toHaveCSS('cursor', 'pointer')
  await expect(badge).toHaveCSS('font-variant-numeric', 'tabular-nums')
  await expect(badge).toHaveCSS('box-sizing', 'border-box')
  await expect(badge).toHaveCSS('white-space', 'nowrap')
  await expect(badge).toHaveCSS('justify-content', 'center')
  await expect(badge).toHaveCSS('align-items', 'center')
  await expect(badge).toHaveCSS('position', 'relative')
  await expect(badge).toHaveCSS('padding-top', '0px')
  await expect(badge).toHaveCSS('margin-top', '0px')

  const pill = page.getByTestId('search-results')
  await expect(pill).toContainText('3 个网页')
  await expect(pill).toHaveCSS('display', 'flex')
  await expect(pill).toHaveCSS('height', '34px')
  await expect(pill).toHaveCSS('margin-top', '16px')
  await expect(pill).toHaveCSS('padding-top', '4px')
  await expect(pill).toHaveCSS('padding-right', '10px')
  await expect(pill).toHaveCSS('padding-bottom', '4px')
  await expect(pill).toHaveCSS('padding-left', '4px')
  await expect(pill).toHaveCSS('border-radius', '100px')
  await expect(pill).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(pill).toHaveCSS('border-top-width', '1px')
  await expect(pill).toHaveCSS('border-top-color', 'rgba(0, 0, 0, 0.1)')
  await expect(pill).toHaveCSS('cursor', 'pointer')
  await expect(pill).toHaveCSS('user-select', 'none')
  await expect(pill).toHaveCSS('align-items', 'center')
  await expect(pill).toHaveCSS('transition-property', 'background-color')
  await expect(pill).toHaveCSS('transition-duration', '0.3s')
  await expect(pill).toHaveCSS('gap', '4px')
  await expect(pill).toHaveCSS('font-size', '14px')
  await expect(pill).toHaveCSS('line-height', '24px')
  await expect(pill).toHaveCSS('color', 'rgb(15, 17, 21)')
  const stack = pill.locator('.favicons i')
  await expect(stack).toHaveCount(3)
  await expect(stack.nth(0)).toHaveCSS('width', '16px')
  await expect(stack.nth(0)).toHaveCSS('height', '16px')
  await expect(stack.nth(0)).toHaveCSS('margin-left', '0px')
  await expect(stack.nth(1)).toHaveCSS('margin-left', '-4px')
  await expect(stack.nth(1)).toHaveCSS('box-shadow', 'rgb(255, 255, 255) 0px 0px 0px 1px, rgb(255, 255, 255) 0px 0px 0px 1px')
  await expect(stack.nth(0)).toHaveCSS('border-radius', '50%')
  await expect(stack.nth(0)).toHaveCSS('flex-shrink', '0')
  await expect(stack.nth(0)).toHaveCSS('overflow', 'hidden')
  await expect(pill.locator('.favicons')).toHaveCSS('display', 'flex')
  await expect(pill.locator('.favicons')).toHaveCSS('align-items', 'center')
  await expect(stack.nth(0).locator('img')).toHaveCSS('object-fit', 'contain')
  await expect(stack.nth(0)).toHaveCSS('transition-property', 'box-shadow')
  await expect(stack.nth(0)).toHaveCSS('transition-duration', '0.2s')
  const pillWidth = await pill.evaluate((el) => el.getBoundingClientRect().width)
  const parentWidth = await pill.evaluate((el) => el.parentElement?.getBoundingClientRect().width ?? 0)
  expect(pillWidth).toBeLessThan(parentWidth)

  await cites.nth(0).hover()
  const card = page.locator('.search-view-card')
  await expect(card).toBeVisible()
  await expect(card).toHaveCSS('max-width', '355px')
  await expect(card).toHaveCSS('padding-top', '16px')
  await expect(card).toHaveCSS('border-radius', '12px')
  await expect(card).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(card).toHaveCSS('border-top-color', 'rgba(0, 0, 0, 0)')
  await expect(card.locator('.search-view-card__title')).toHaveCSS('font-size', '16px')
  await expect(card.locator('.search-view-card__title')).toHaveCSS('line-height', '25px')
  await expect(card.locator('.search-view-card__title')).toHaveCSS('font-weight', '500')
  const icon = card.locator('.search-view-card__icon')
  await expect(icon).toHaveCSS('width', '18px')
  await expect(icon).toHaveCSS('height', '18px')
  await expect(icon).toHaveCSS('border-radius', '50%')
  await expect(icon).toHaveCSS('overflow', 'hidden')
  await expect(icon).toHaveCSS('border-top-width', '0px')
  const img = icon.locator('img')
  await expect(img).toBeVisible()
  await expect(img).toHaveAttribute('src', iconPixel)
  await expect(img).toHaveCSS('object-fit', 'cover')
  await expect(img).toHaveCSS('display', 'block')
  await expect(img).toHaveCSS('width', '18px')
  await expect(img).toHaveCSS('height', '18px')
  await expect(icon).toHaveCSS('background-color', 'rgb(235, 238, 242)')
  await expect(card.locator('.search-view-card__meta')).toHaveCSS('font-size', '12px')
  await expect(card.locator('.search-view-card__meta')).toHaveCSS('line-height', '17px')
  await expect(card.locator('.search-view-card__meta')).toHaveCSS('font-weight', '500')
  await expect(card.locator('svg')).toHaveCount(0)
  await expect(badge).toHaveCSS('background-color', 'rgb(235, 238, 242)')
  await expect(badge).toHaveCSS('box-shadow', 'rgba(0, 0, 0, 0.04) 0px 0px 0px 0.5px inset')
  await expect(card).toHaveCSS('box-shadow', 'rgba(0, 0, 0, 0.2) 0px 0px 1px 0px, rgba(0, 0, 0, 0.02) 0px 0px 4px 0px, rgba(0, 0, 0, 0.08) 0px 12px 32px 0px')

  await cites.nth(1).hover()
  await expect(card.locator('.search-view-card__title')).toHaveText('无图')
  await expect(card.locator('.search-view-card__icon img')).toHaveCount(0)
  const fallback = card.locator('.site_logo_fallback')
  await expect(fallback.locator('svg')).toHaveAttribute('viewBox', '0 0 14 14')
  await expect(fallback.locator('svg')).toHaveCSS('width', '14px')
  await expect(fallback.locator('svg')).toHaveCSS('height', '14px')
  expect(await fallback.locator('path').first().getAttribute('d')).toContain('M3.2131 7.12714')
  await expect(fallback).toHaveCSS('color', 'rgb(129, 133, 140)')
  await expect(fallback).toHaveCSS('background-color', 'rgb(235, 238, 242)')

  await cites.nth(2).hover()
  await expect(card.locator('.search-view-card__title')).toHaveText('坏图')
  const loading = card.locator('.site_logo_loading')
  await expect(loading).toBeVisible()
  await expect(loading).toHaveCSS('display', 'flex')
  await expect(loading).toHaveCSS('justify-content', 'center')
  await expect(loading).toHaveCSS('align-items', 'center')
  await expect(loading).toHaveCSS('height', '18px')
  await expect(loading).toHaveCSS('background-color', 'rgb(235, 238, 242)')
  await expect(card.locator('.site_logo_fallback')).toHaveCount(0)
  await expect(card.locator('.search-view-card__icon img')).toBeHidden()
  expect(brokenIcon.hits()).toBeGreaterThan(0)
  const whileLoading = brokenIcon.hits()
  brokenIcon.release()
  await expect(card.locator('.site_logo_fallback path').first()).toHaveAttribute('d', /M3.2131 7.12714/)
  await expect(card.locator('.search-view-card__icon img')).toHaveCount(0)
  await expect(card.locator('.site_logo_loading:not(.site_logo_fallback)')).toHaveCount(0)
  const afterFirst = brokenIcon.hits()
  expect(afterFirst).toBeGreaterThanOrEqual(whileLoading)
  const stored = await page.evaluate((src) => `${JSON.stringify(localStorage)}${JSON.stringify(sessionStorage)}`.includes(src), broken)
  expect(stored).toBe(false)
  await page.mouse.move(0, 0)
  await expect(card).toBeHidden()
  await cites.nth(2).hover()
  await expect(card.locator('.site_logo_fallback svg')).toBeVisible()
  await expect(card.locator('.search-view-card__icon img')).toHaveCount(0)
  expect(brokenIcon.hits()).toBe(afterFirst)

  await page.evaluate(() => document.body.setAttribute('data-ds-dark-theme', ''))
  await expect(badge).toHaveCSS('background-color', 'rgb(44, 44, 46)')
  await expect(badge).toHaveCSS('color', 'rgb(173, 178, 184)')
  await expect(card).toHaveCSS('background-color', 'rgb(53, 54, 56)')
  await expect(card).toHaveCSS('border-top-color', 'rgba(255, 255, 255, 0.06)')
  await expect(card.locator('.site_logo_fallback')).toHaveCSS('color', 'rgb(173, 178, 184)')
  await expect(card.locator('.site_logo_fallback')).toHaveCSS('background-color', 'rgb(53, 54, 56)')
  await expect(card.locator('.search-view-card__icon')).toHaveCSS('background-color', 'rgb(53, 54, 56)')
  await expect(pill).toHaveCSS('background-color', 'rgb(21, 21, 23)')
  await expect(pill).toHaveCSS('border-top-color', 'rgba(255, 255, 255, 0.12)')
  await expect(pill).toHaveCSS('color', 'rgb(249, 250, 251)')
  await expect(cites.nth(2)).toHaveCSS('background-color', 'rgb(53, 54, 56)')
  await expect(cites.nth(2)).toHaveCSS('box-shadow', 'rgba(255, 255, 255, 0.06) 0px 0px 0px 0.5px inset')
  await page.evaluate(() => document.body.removeAttribute('data-ds-dark-theme'))

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(badge).toHaveCSS('min-width', '14px')
  await expect(badge).toHaveCSS('height', '14px')
  await expect(badge).toHaveCSS('font-size', '9px')
  await expect(card).toHaveCSS('max-width', '355px')
  await expect(card).toHaveCSS('padding-top', '16px')
  await expect(pill).toHaveCSS('height', '34px')
  await expect(pill).toHaveCSS('padding-left', '4px')

  await page.mouse.move(0, 0)
  await expect(card).toBeHidden()
  await page.setViewportSize({ width: 1440, height: 900 })
  await pill.hover()
  await expect(pill).toHaveCSS('background-color', 'rgba(38, 49, 72, 0.06)')
  await expect(stack.nth(1)).toHaveCSS('box-shadow', 'rgba(38, 49, 72, 0.06) 0px 0px 0px 1px, rgb(255, 255, 255) 0px 0px 0px 1px')
  await page.getByTestId('message-assistant').getByRole('button', { name: '分享' }).click()
  await expect(pill).toHaveClass(/is-inert/)
  await expect(pill).toHaveCSS('cursor', 'default')
  // SP-SHARE-149. The turn's children do not take the pointer, so hover and click never reach the pill.
  const covered = await pill.evaluate((node) => {
    const box = node.getBoundingClientRect()
    const top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
    return top?.closest('[data-testid="search-results"]') == null
  })
  expect(covered).toBe(true)
  // SP-CV-112. The selected message sets --search-sites-summary-bg-color to transparent, and the pill paints that variable.
  await expect(pill).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(page.getByTestId('search-panel')).toBeHidden()
})
