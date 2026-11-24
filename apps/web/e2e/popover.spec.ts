import { expect, test, type Locator, type Page, type Route } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const shots = '/opt/cursor/artifacts'
mkdirSync(shots, { recursive: true })

const search = [
  { type: 'message_start', message: { id: 'req-ice', model: 'deepseek-flash' } },
  { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: '先核对人口数字。' } },
  { type: 'content_block_stop', index: 0 },
  { type: 'content_block_start', index: 1, content_block: { type: 'web_search_tool_result', tool_use_id: 'srvtoolu_s_00_redacted', kind: 'search', content: [{ type: 'web_search_result', title: 'Iceland population', url: 'https://example.com/iceland', snippet: 'About 394,000 people.', site_name: 'Example', site_icon: null, page_age: '2026-11-16' }] } },
  { type: 'content_block_start', index: 2, content_block: { type: 'text', text: 'About 394,000.' } },
  { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null, title: '冰岛人口' }, usage: { input_tokens: 20, output_tokens: 8, output_tokens_details: { thinking_tokens: 2 } } },
  { type: 'message_stop' },
]

const sse = (events: unknown[]) => events.map((event) => `event: ${(event as { type: string }).type}\ndata: ${JSON.stringify(event)}\n\n`).join('')

const install = async (page: Page) => {
  await page.route('https://api.deepseek.com/**', async (route: Route) => {
    const url = route.request().url()
    if (url.endsWith('/user/balance')) {
      await route.fulfill({ json: { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '1', granted_balance: '0', topped_up_balance: '1' }] } })
      return
    }
    if (url.endsWith('/models')) {
      await route.fulfill({ json: { data: [{ id: 'deepseek-flash' }, { id: 'deepseek-v4-pro' }] } })
      return
    }
    if (!url.includes('/messages')) {
      await route.fulfill({ status: 404, json: {} })
      return
    }
    await route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse(search) })
  })
}

const unlock = async (page: Page) => {
  await install(page)
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()
}

const shot = async (page: Page, name: string) => {
  await page.screenshot({ path: `${shots}/${name}.png` })
}

const focusedTestId = (page: Page) => page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.testid ?? '')

const tabTo = async (page: Page, locator: Locator) => {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  for (let i = 0; i < 80; i += 1) {
    if (await locator.evaluate((el) => el === document.activeElement).catch(() => false)) return
    await page.keyboard.press('Tab')
  }
  throw new Error('control was not reached by Tab')
}

const ask = async (page: Page) => {
  await page.getByTestId('composer').fill('冰岛现在大约多少人口？')
  await page.getByTestId('send').click()
  await expect(page.getByTestId('thinking-toggle')).toBeVisible()
  await expect(page.getByTestId('source-favicons')).toBeVisible()
  await expect(page.getByTestId('assistant-text')).toContainText('394,000')
}

const openSettings = async (page: Page) => {
  await page.getByTestId('user-menu').click()
  await page.getByTestId('settings-open').click()
  await expect(page.getByTestId('settings-dialog')).toBeVisible()
}

test('session menu closes on outside press, Escape, blur, and a menu item', async ({ page }) => {
  await unlock(page)
  await ask(page)
  const menu = page.getByTestId('chat-item-menu')
  const more = page.locator('.chat-link.active .more')

  await more.click()
  await expect(menu).toBeVisible()
  await shot(page, 'popover-chat-menu-open')
  await page.evaluate(() => {
    document.querySelector('[data-testid="composer"]')?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
  })
  await expect(menu).toBeHidden()
  await more.click()
  await expect(menu).toBeVisible()
  await page.getByTestId('composer').click()
  await expect(menu).toBeHidden()
  await shot(page, 'popover-chat-menu-outside')

  await more.click()
  await expect(menu).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
  await expect(page.getByTestId('settings-dialog')).toHaveCount(0)
  await shot(page, 'popover-chat-menu-esc')

  await more.click()
  await expect(menu).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(menu).toBeHidden()

  await more.click()
  await expect(menu).toBeVisible()
  await menu.getByRole('menuitem', { name: '重命名' }).click()
  await expect(menu).toBeHidden()
  await expect(page.getByRole('textbox', { name: '对话标题' })).toBeVisible()
  await shot(page, 'popover-chat-menu-item')
})

test('settings dropdowns close outside, on Escape, and on an item, without closing the dialog', async ({ page }) => {
  await unlock(page)
  await openSettings(page)
  const dialog = page.getByTestId('settings-dialog')
  const outside = page.getByRole('heading', { name: '系统设置' })
  const dropdowns = [
    { id: 'language-trigger', option: '简体中文', shot: 'language' },
    { id: 'safety-select', option: '高（公开站点默认）', shot: 'safety' },
  ]
  await expect(page.getByTestId('purpose-select')).toHaveCount(0)
  await expect(page.getByTestId('voice-select')).toHaveCount(0)
  await expect(page.getByTestId('model-select')).toHaveCount(0)
  await expect(page.getByTestId('effort-select')).toHaveCount(0)

  for (const dropdown of dropdowns) {
    const trigger = page.getByTestId(dropdown.id)
    const menu = page.getByTestId(`${dropdown.id}-menu`)
    await trigger.click()
    await expect(menu).toBeVisible()
    await shot(page, `popover-${dropdown.shot}-open`)
    await page.evaluate(() => {
      document.querySelector('.settings-head')?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    })
    await expect(menu).toBeHidden()
    await expect(dialog).toBeVisible()
    await trigger.click()
    await expect(menu).toBeVisible()
    await outside.click()
    await expect(menu).toBeHidden()
    await expect(dialog).toBeVisible()
    await shot(page, `popover-${dropdown.shot}-outside`)

    await trigger.click()
    await expect(menu).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
    await expect(dialog).toBeVisible()
    await shot(page, `popover-${dropdown.shot}-esc`)

    await trigger.click()
    await expect(menu).toBeVisible()
    await menu.getByRole('option', { name: dropdown.option, exact: true }).click()
    await expect(menu).toBeHidden()
    await expect(dialog).toBeVisible()
    await expect(trigger).toContainText(dropdown.option)
  }

  await page.getByTestId('language-trigger').click()
  await expect(page.getByTestId('language-trigger-menu')).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(page.getByTestId('language-trigger-menu')).toBeHidden()
  await expect(dialog).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect.poll(() => focusedTestId(page)).toBe('composer')
  await shot(page, 'popover-settings-esc')
})

test('thinking and search chips toggle on Enter and Space', async ({ page }) => {
  await unlock(page)
  const thinking = page.getByTestId('toggle-thinking')
  const search = page.getByTestId('toggle-search')
  await expect.poll(() => thinking.evaluate((node) => node.classList.contains('on'))).toBe(false)
  await expect.poll(() => search.evaluate((node) => node.classList.contains('on'))).toBe(false)
  await thinking.click()
  await search.click()

  await tabTo(page, thinking)
  await expect(thinking).toBeFocused()
  await page.keyboard.press('Enter')
  await expect.poll(() => thinking.evaluate((node) => node.classList.contains('on'))).toBe(false)
  await expect(thinking).toHaveAttribute('aria-pressed', 'false')
  await shot(page, 'popover-chip-enter')
  await page.keyboard.press('Space')
  await expect.poll(() => thinking.evaluate((node) => node.classList.contains('on'))).toBe(true)
  await expect(thinking).toHaveAttribute('aria-pressed', 'true')
  await shot(page, 'popover-chip-space')

  await tabTo(page, search)
  await expect(search).toBeFocused()
  await page.keyboard.press('Enter')
  await expect.poll(() => search.evaluate((node) => node.classList.contains('on'))).toBe(false)
  await page.keyboard.press('Space')
  await expect.poll(() => search.evaluate((node) => node.classList.contains('on'))).toBe(true)
})

test('source group and thinking chevron expand and collapse from the keyboard', async ({ page }) => {
  await unlock(page)
  await ask(page)
  const toggle = page.getByTestId('thinking-toggle')
  const collapse = page.locator('.thinking-collapse')
  const sources = page.getByTestId('source-favicons')

  await tabTo(page, toggle)
  await expect(toggle).toBeFocused()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(collapse).toHaveClass(/open/)
  await page.keyboard.press('Enter')
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(collapse).not.toHaveClass(/open/)
  await shot(page, 'popover-thinking-enter')
  await page.keyboard.press('Space')
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(collapse).toHaveClass(/open/)

  await tabTo(page, sources)
  await expect(sources).toBeFocused()
  await expect(sources).toHaveAttribute('aria-expanded', 'false')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('search-panel')).toBeVisible()
  await expect(sources).toHaveAttribute('aria-expanded', 'true')
  await shot(page, 'popover-sources-enter')
  await page.keyboard.press('Space')
  await expect(page.getByTestId('search-panel')).toBeHidden()
  await expect(sources).toHaveAttribute('aria-expanded', 'false')
})
