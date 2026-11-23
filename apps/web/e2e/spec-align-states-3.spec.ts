// Measured hover, focus-visible, and dark states that the ledgers had left deferred.
import { expect, test, type Page } from '@playwright/test'
import { boot } from './lib/fb1721-boot'

const iconPixel = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
const pending = '/e2e-pending-icon.png'

const events = [
  { type: 'message_start', message: { id: 'req-states', model: 'deepseek-flash' } },
  { type: 'content_block_start', index: 0, content_block: { type: 'web_search_tool_result', tool_use_id: 'tool-states', kind: 'search', content: [
    { type: 'web_search_result', title: '有图', url: 'https://example.com/ok', snippet: '图', site_name: '有图站', site_icon: iconPixel, page_age: '2026-11-16' },
    { type: 'web_search_result', title: '慢图', url: 'https://example.com/slow', snippet: '慢', site_name: '慢图站', site_icon: pending, page_age: '2026-11-16' },
  ] } },
  { type: 'content_block_stop', index: 0 },
  { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
  { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: '见 [链接](https://example.com/doc) ' } },
  { type: 'content_block_delta', index: 1, delta: { type: 'citations_delta', citation: { type: 'web_search_result_location', url: 'https://example.com/slow', title: '慢图', cited_text: '慢', encrypted_index: '' } } },
  { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: '[reference:1] [reference:-404]。' } },
  { type: 'content_block_stop', index: 1 },
  { type: 'message_delta', delta: { stop_reason: 'end_turn', title: '状态' }, usage: { input_tokens: 4, output_tokens: 4 } },
  { type: 'message_stop' },
]

const hold = async (page: Page) => {
  let release = () => {}
  const gate = new Promise<void>((resolve) => { release = resolve })
  await page.route('**/e2e-pending-icon.png', async (route) => {
    await gate
    await route.fulfill({ status: 404, contentType: 'image/png', body: 'no' })
  })
  return release
}

const dark = async (page: Page) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.evaluate(() => document.body.setAttribute('data-ds-dark-theme', ''))
}

// Programmatic focus() leaves an <a> active without :focus-visible.
// A trusted Tab from the previous sibling is what Chromium treats as keyboard focus.
const keyboardFocus = async (page: Page, link: ReturnType<Page['locator']>) => {
  await page.mouse.move(0, 0)
  await link.evaluate((node) => {
    const el = node as HTMLElement
    const before = document.createElement('button')
    before.type = 'button'
    before.id = 'e2e-focus-before'
    before.textContent = 'before'
    el.parentElement?.insertBefore(before, el)
  })
  await page.locator('#e2e-focus-before').focus()
  await page.keyboard.press('Tab')
}

test('link focus, pill hover, and dark citation rings', async ({ page }) => {
  const release = await hold(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await boot(page, 'light', { body: () => events, freezeTransitions: false })
  await page.getByTestId('composer').fill('状态')
  await page.getByTestId('send').click()
  const link = page.locator('.ds-markdown a:not(.ds-a):not(.cite)')
  await expect(link).toHaveText('链接')
  await link.hover()
  await expect(link).toHaveCSS('outline-style', 'none')
  await expect(link).toHaveCSS('text-decoration-line', 'underline')
  await expect(link).toHaveCSS('text-decoration-color', 'rgb(57, 100, 254)')

  await keyboardFocus(page, link)
  await expect.poll(() => link.evaluate((node) => {
    const el = node as HTMLElement
    return `${el.matches(':focus-visible')} ${document.activeElement === el} ${getComputedStyle(el).boxShadow}`
  })).toBe('true true rgb(57, 100, 254) 0px 0px 0px 2px')

  await dark(page)
  await link.hover()
  await expect(link).toHaveCSS('text-decoration-line', 'underline')
  await expect(link).toHaveCSS('text-decoration-color', 'rgb(103, 158, 254)')
  await expect(link).toHaveCSS('outline-style', 'none')
  await page.mouse.move(0, 0)
  await page.locator('#e2e-focus-before').focus()
  await page.keyboard.press('Tab')
  await expect.poll(() => link.evaluate((node) => getComputedStyle(node).boxShadow)).toBe('rgb(103, 158, 254) 0px 0px 0px 2px')

  const prose = page.getByTestId('assistant-text')
  await expect(prose).toContainText('[reference:-404]')
  await expect(prose).not.toContainText('[reference:1]')
  await expect(prose.locator('.cite')).toHaveText(['2', '1'])

  const stage = await page.locator('.stage').evaluate((node) => {
    const style = getComputedStyle(node)
    return {
      display: style.display,
      direction: style.flexDirection,
      grow: style.flexGrow,
      minWidth: style.minWidth,
      maxWidth: style.maxWidth,
      width: style.width,
      position: style.position,
      overflow: style.overflow,
    }
  })
  expect(stage).toEqual({
    display: 'flex',
    direction: 'column',
    grow: '1',
    minWidth: '0px',
    maxWidth: '100%',
    width: '1179px',
    position: 'relative',
    overflow: 'hidden',
  })

  const pill = page.getByTestId('search-results')
  await expect(pill).toContainText('2 个网页')
  const ring = pill.locator('.favicons i').nth(1)
  await expect.poll(() => ring.evaluate((node) => getComputedStyle(node).boxShadow)).toBe('rgb(21, 21, 23) 0px 0px 0px 1px, rgb(21, 21, 23) 0px 0px 0px 1px')
  await pill.hover()
  await expect.poll(() => pill.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe('rgba(255, 255, 255, 0.08)')
  await expect.poll(() => ring.evaluate((node) => getComputedStyle(node).boxShadow)).toBe('rgba(255, 255, 255, 0.08) 0px 0px 0px 1px, rgb(21, 21, 23) 0px 0px 0px 1px')

  await prose.locator('.cite').nth(0).hover()
  const loading = page.locator('.search-view-card__icon .site_logo_loading')
  await expect(loading).toBeVisible()
  await expect(loading).toHaveCSS('background-color', 'rgb(53, 54, 56)')
  const src = await pill.locator('.favicons img').first().getAttribute('src')
  expect(src).toBe(iconPixel)
  const share = await page.locator('.topbar button[aria-label="分享"]').count()
  expect(share).toBe(1)
  release()
})
