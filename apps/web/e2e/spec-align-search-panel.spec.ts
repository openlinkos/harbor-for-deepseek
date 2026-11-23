// Search panel layout, bM coupling, and lifecycle. SP-SEARCH-192, 214–220, 232–249.
import { expect, test, type Page } from '@playwright/test'
import { boot } from './lib/fb1721-boot'

const search = [
  { type: 'message_start', message: { id: 'req-ice', model: 'deepseek-flash' } },
  { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: '先核对人口数字。' } },
  { type: 'content_block_stop', index: 0 },
  {
    type: 'content_block_start',
    index: 1,
    content_block: {
      type: 'web_search_tool_result',
      tool_use_id: 'srvtoolu_s_00_redacted',
      kind: 'search',
      content: [{
        type: 'web_search_result',
        title: 'Iceland population',
        url: 'https://example.com/iceland',
        snippet: 'About 394,000 people.',
        site_name: 'Example',
        site_icon: null,
        page_age: '2026-11-16',
      }],
    },
  },
  { type: 'content_block_start', index: 2, content_block: { type: 'text', text: 'About 394,000.' } },
  { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null, title: '冰岛人口' }, usage: { input_tokens: 20, output_tokens: 8 } },
  { type: 'message_stop' },
]

const widthOf = (page: Page, selector: string) =>
  page.locator(selector).evaluate((el) => Math.round(el.getBoundingClientRect().width))

const near = (actual: number, expected: number, label: string) => {
  expect(Math.abs(actual - expected), `${label}: ${actual} vs ${expected}`).toBeLessThanOrEqual(2)
}

const ask = async (page: Page) => {
  await page.getByTestId('composer').fill('冰岛现在大约多少人口？')
  await page.getByTestId('send').click()
  await expect(page.getByTestId('search-results').last()).toBeVisible()
  await expect(page.getByTestId('chat-title')).toHaveText('冰岛人口')
}

const openPanel = async (page: Page) => {
  await page.getByTestId('search-results').last().click()
  await expect(page.getByTestId('search-panel')).toBeVisible()
}

const deleteChat = async (page: Page, which: 'active' | 'other') => {
  const row = page.locator(which === 'active' ? '.chat-link.active' : '.chat-link:not(.active)').first()
  await row.hover()
  await row.locator('.more').click()
  await page.getByRole('menuitem', { name: '删除' }).click()
  await page.getByTestId('confirm-delete').click()
}

test('SP-SEARCH-214..220 search panel closes on navigation and stays for delete-other', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await boot(page, 'light', { body: () => search, freezeTransitions: false })
  await ask(page)
  await openPanel(page)

  await page.getByTestId('new-chat').click()
  await expect(page.getByTestId('search-panel')).toBeHidden()
  await page.getByTestId('new-chat').click()
  await expect(page.getByTestId('search-panel')).toBeHidden()

  await ask(page)
  await openPanel(page)
  await expect(page.locator('.chat-link')).toHaveCount(2)
  await page.locator('.chat-link:not(.active) button:not(.more)').click()
  await expect(page.getByTestId('search-panel')).toBeHidden()

  await openPanel(page)
  await deleteChat(page, 'other')
  await expect(page.getByTestId('search-panel')).toBeVisible()
  await expect(page.locator('.chat-link')).toHaveCount(1)
  await deleteChat(page, 'active')
  await expect(page.getByTestId('search-panel')).toBeHidden()

  await ask(page)
  await openPanel(page)
  await page.getByTestId('source-favicons').click()
  await expect(page.getByTestId('search-panel')).toBeHidden()
  await page.getByTestId('source-favicons').click()
  await expect(page.getByTestId('search-panel')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('search-panel')).toBeHidden()

  await openPanel(page)
  await page.getByTestId('regenerate').click()
  await expect(page.getByTestId('search-panel')).toBeHidden()

  await page.locator('.action-row').getByRole('button', { name: '分享' }).click()
  await expect(page.locator('.share-bar')).toBeVisible()
  await page.getByTestId('search-results').click()
  await expect(page.getByTestId('search-panel')).toBeHidden()
  await page.getByTestId('source-favicons').click()
  await expect(page.getByTestId('search-panel')).toBeHidden()
})

test('SP-SEARCH-232..249 panel width, column, sidebar and title across widths', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await boot(page, 'light', { body: () => search, freezeTransitions: false })
  await ask(page)
  await openPanel(page)

  const measure = async (viewport: number, panelW: number, side: number, stageW: number) => {
    await page.setViewportSize({ width: viewport, height: 900 })
    await expect.poll(() => widthOf(page, '[data-testid=search-panel]')).toBe(panelW)
    await expect.poll(() => widthOf(page, '[data-testid=sidebar]')).toBe(side)
    await expect.poll(() => widthOf(page, '.stage')).toBeGreaterThan(stageW - 3)
    const stage = await widthOf(page, '.stage')
    near(stage, stageW, `stage@${viewport}`)
    expect(stage, `stage not crushed @${viewport}`).toBeGreaterThan(stageW - 3)
  }

  await measure(1440, 390, 261, 789)
  await expect(page.getByTestId('chat-title')).toBeVisible()
  await expect(page.getByTestId('search-panel')).toBeVisible()

  await measure(1024, 390, 261, 384)
  await expect(page.getByTestId('chat-title')).toBeVisible()
  await expect(page.getByTestId('search-panel')).toBeVisible()

  await measure(860, 366, 0, 494)
  await expect(page.getByTestId('chat-title')).toHaveCount(0)
  await expect(page.locator('.topbar').getByRole('button', { name: '分享' })).toBeVisible()
  await expect(page.getByTestId('search-panel')).toBeVisible()

  await measure(1024, 390, 261, 384)
  await expect(page.getByTestId('chat-title')).toBeVisible()
  await expect(page.getByTestId('search-panel')).toBeVisible()

  await measure(800, 336, 0, 464)
  await expect(page.getByTestId('chat-title')).toHaveCount(0)
  await expect(page.locator('.topbar').getByRole('button', { name: '分享' })).toBeVisible()

  await page.getByTestId('search-panel').getByRole('button', { name: '关闭' }).click()
  await expect(page.getByTestId('search-panel')).toBeHidden()
  await expect.poll(() => widthOf(page, '[data-testid=sidebar]')).toBe(261)
  await expect(page.getByTestId('chat-title')).toBeVisible()

  await openPanel(page)
  await expect(page.getByTestId('chat-title')).toBeVisible()
  await expect.poll(() => widthOf(page, '[data-testid=sidebar]')).toBe(0)
  await expect.poll(() => widthOf(page, '[data-testid=search-panel]')).toBe(336)

  await page.locator('.float-pill').getByRole('button', { name: '打开边栏' }).click()
  await expect(page.getByTestId('search-panel')).toBeHidden()
  await expect.poll(() => widthOf(page, '[data-testid=sidebar]')).toBe(261)

  await page.locator('.sidebar').getByRole('button', { name: '收起边栏' }).click()
  await expect.poll(() => widthOf(page, '[data-testid=sidebar]')).toBe(0)
  await openPanel(page)
  await page.getByTestId('search-panel').getByRole('button', { name: '关闭' }).click()
  await expect.poll(() => widthOf(page, '[data-testid=sidebar]')).toBe(0)

  await page.locator('.float-pill').getByRole('button', { name: '打开边栏' }).click()
  await expect.poll(() => widthOf(page, '[data-testid=sidebar]')).toBe(261)
  await openPanel(page)
  await page.setViewportSize({ width: 768, height: 900 })
  await expect.poll(() => widthOf(page, '[data-testid=search-panel]')).toBe(320)
  await expect.poll(() => widthOf(page, '[data-testid=sidebar]')).toBe(0)
  await expect.poll(() => widthOf(page, '.stage')).toBeGreaterThan(440)
  near(await widthOf(page, '.stage'), 448, 'stage@768')
  // 800 and 768 are both below 1024 and at least 768, so the width flags do not flip and the title stays (SP-SEARCH-245).
  await expect(page.getByTestId('chat-title')).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  const sheet = page.getByTestId('search-panel')
  await expect(sheet).toBeVisible()
  await expect(sheet).toHaveCSS('position', 'absolute')
  await expect(sheet).toHaveCSS('transform', 'none')
  await expect.poll(() => widthOf(page, '[data-testid=search-panel]')).toBeGreaterThan(380)
  near(await widthOf(page, '[data-testid=search-panel]'), 390, 'sheet width')
  const box = await sheet.boundingBox()
  expect(Math.round(box?.y ?? -1)).toBe(20)
  near(await widthOf(page, '.stage'), 390, 'stage@390')
  await expect(page.getByTestId('chat-title')).toBeVisible()
  await expect(page.getByTestId('menu')).toBeVisible()
  await page.getByTestId('search-panel').getByRole('button', { name: '关闭' }).click()
  await expect(sheet).toBeHidden()
  await expect(page.getByTestId('sidebar')).toBeVisible()
})

test('SP-SEARCH-242..248 fresh 768, 800 and 390 coupling', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 768, height: 1024 })
  await boot(page, 'light', { body: () => search, freezeTransitions: false })
  await expect.poll(() => widthOf(page, '[data-testid=sidebar]')).toBe(261)
  await ask(page)
  await openPanel(page)
  await expect(page.getByTestId('chat-title')).toBeVisible()
  await expect.poll(() => widthOf(page, '[data-testid=sidebar]')).toBe(0)
  await expect.poll(() => widthOf(page, '[data-testid=search-panel]')).toBe(320)
  near(await widthOf(page, '.stage'), 448, 'fresh stage@768')
  await page.getByTestId('search-panel').getByRole('button', { name: '关闭' }).click()
  await expect.poll(() => widthOf(page, '[data-testid=sidebar]')).toBe(261)

  await page.setViewportSize({ width: 1024, height: 800 })
  await openPanel(page)
  await expect.poll(() => widthOf(page, '[data-testid=sidebar]')).toBe(261)
  await expect.poll(() => widthOf(page, '[data-testid=search-panel]')).toBe(390)
  await page.locator('.sidebar').getByRole('button', { name: '收起边栏' }).click()
  await expect(page.getByTestId('search-panel')).toBeVisible()
  await page.locator('.float-pill').getByRole('button', { name: '打开边栏' }).click()
  await expect(page.getByTestId('search-panel')).toBeVisible()
  await expect.poll(() => widthOf(page, '[data-testid=sidebar]')).toBe(261)

  await page.setViewportSize({ width: 390, height: 844 })
  const sheet = page.getByTestId('search-panel')
  await expect(sheet).toBeVisible()
  await expect(sheet).toHaveCSS('position', 'absolute')
  await expect(page.getByTestId('chat-title')).toBeVisible()
  await expect(page.getByTestId('menu')).toBeVisible()
  near(await widthOf(page, '.stage'), 390, 'fresh stage@390')
  // The sheet and its scrim cover the menu, so a pointer click never reaches it. Fire the button's own click: opening the drawer is a hand expand and closes the sheet (SP-SEARCH-244).
  await page.getByTestId('menu').evaluate((el: HTMLButtonElement) => el.click())
  await expect(sheet).toBeHidden()
  await expect(page.getByTestId('sidebar')).toBeVisible()
})

test('SP-SEARCH-199..213 search panel header and card cosmetics', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await boot(page, 'light', { body: () => search, freezeTransitions: false })
  await ask(page)
  await openPanel(page)
  const panel = page.getByTestId('search-panel')
  await expect(panel.getByRole('heading')).toHaveText('搜索结果')
  await expect(panel.locator('header')).toHaveCSS('height', '60px')
  await expect(panel.getByRole('heading')).toHaveCSS('font-size', '14px')
  await expect(panel.getByRole('heading')).toHaveCSS('font-weight', '500')
  await expect(panel.getByRole('heading')).toHaveCSS('line-height', '22px')
  const close = panel.getByRole('button', { name: '关闭' })
  await expect(close).toHaveCSS('width', '24px')
  await expect(close).toHaveCSS('height', '24px')
  await expect(close.locator('svg')).toHaveAttribute('viewBox', '0 0 16 16')
  expect(await close.locator('path').first().getAttribute('d')).toContain('M14.1871 13.1265')
  const card = panel.locator('.source-card')
  await expect(card).toHaveAttribute('rel', 'noreferrer')
  await expect(card).toHaveAttribute('target', '_blank')
  await expect(card.locator('.source-site')).toHaveText('Example')
  await expect(card.locator('.source-date')).toHaveText('2026/11/16')
  await expect(card.locator('.source-divider')).toHaveCount(1)
  await expect(card.locator('.source-index')).toHaveText('1')
  await expect(card.locator('.search-view-card__title')).toHaveCSS('font-size', '14px')
  await expect(card.locator('.search-view-card__title')).toHaveCSS('font-weight', '500')
  await expect(card.locator('.search-view-card__title')).toHaveCSS('line-height', '22px')
  await expect(card.locator('.search-view-card__title')).toHaveCSS('color', 'rgb(15, 17, 21)')
  await expect(card.locator('.search-view-card__snippet')).toHaveCSS('font-size', '13px')
  await expect(card.locator('.search-view-card__snippet')).toHaveCSS('line-height', '20px')
  await expect(card.locator('.search-view-card__snippet')).toHaveCSS('color', 'rgb(129, 133, 140)')
  await expect(card.locator('.source-meta')).toHaveCSS('padding-top', '2px')
  await expect(panel.locator('ol')).toHaveCSS('padding-top', '8px')
  await expect(panel).toHaveCSS('box-shadow', 'none')

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(panel.locator('.search-view-card__title')).toHaveCSS('-webkit-line-clamp', '1')
  await expect(panel.locator('ol')).toHaveCSS('padding-left', '6px')
  await expect(card).toHaveCSS('margin-bottom', '4px')
  await expect(page.locator('.sheet-scrim')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0.24)')
  await expect(panel).toHaveCSS('z-index', '1000')
})
