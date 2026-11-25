// SP-CMP-255 / SP-CMP-256. 昊辰 11/26 00:30 (owner screenshots of chat.deepseek.com): 深度思考 and 智能搜索
// are on by default and still on after a refresh. Official does not remember a change across reload.
// In this page session a change carries over New chat (search_state_on_manually_created_chat "keep").
import { expect, test, type Page, type Route } from '@playwright/test'

type Body = { thinking?: { type?: string }; tools?: Array<{ type?: string }> }

const sse = (events: unknown[]) => events.map((event) => `event: ${(event as { type: string }).type}\ndata: ${JSON.stringify(event)}\n\n`).join('')
const plain = () => [
  { type: 'message_start', message: { id: 'req-default', model: 'deepseek-flash' } },
  { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '好的' } },
  { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null, title: '默认开关' }, usage: { input_tokens: 1, output_tokens: 1 } },
  { type: 'message_stop' },
]
const hasSearch = (body: Body) => (body.tools ?? []).some((tool) => tool.type === 'deepseek_web_search')

const install = async (page: Page, bodies: Body[]) => {
  await page.route('https://api.deepseek.com/**', async (route: Route) => {
    const url = route.request().url()
    if (url.endsWith('/user/balance')) return route.fulfill({ json: { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '1.00', granted_balance: '0.00', topped_up_balance: '1.00' }] } })
    if (url.endsWith('/models')) return route.fulfill({ json: { data: [{ id: 'deepseek-flash' }] } })
    if (url.includes('/messages')) {
      bodies.push(route.request().postDataJSON() as Body)
      return route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: sse(plain()) })
    }
    return route.fulfill({ status: 404, json: {} })
  })
}

const unlock = async (page: Page) => {
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()
}

// Official selected toggle: --dsw-alias-button-ghost-active-fill / brand-text / ghost-active-border.
const ACTIVE = {
  light: { bg: 'rgb(237, 243, 254)', color: 'rgb(57, 100, 254)', border: 'rgb(183, 200, 254)' },
  dark: { bg: 'rgb(40, 49, 66)', color: 'rgb(103, 158, 254)', border: 'rgb(72, 104, 178)' },
}

const expectOn = async (page: Page, testId: string, on: boolean, theme: 'light' | 'dark' = 'light') => {
  const chip = page.getByTestId(testId)
  await expect(chip).toHaveAttribute('aria-pressed', String(on))
  if (on) {
    await expect(chip).toHaveClass(/\bon\b/)
    await expect(chip).toHaveCSS('background-color', ACTIVE[theme].bg)
    await expect(chip).toHaveCSS('color', ACTIVE[theme].color)
    await expect(chip).toHaveCSS('border-top-color', ACTIVE[theme].border)
  } else {
    await expect(chip).not.toHaveClass(/\bon\b/)
  }
}

const both = async (page: Page, prefix: 'landing' | 'toggle', on: boolean, theme: 'light' | 'dark' = 'light') => {
  await page.mouse.move(0, 0)
  await expectOn(page, `${prefix}-thinking`, on, theme)
  await expectOn(page, `${prefix}-search`, on, theme)
}

test('fresh load: landing and composer toggles are on, and stay on after reload and New chat', async ({ page }) => {
  const bodies: Body[] = []
  await install(page, bodies)
  await page.goto('/')
  expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0)
  await both(page, 'landing', true)
  await page.reload()
  await both(page, 'landing', true)
  await unlock(page)
  await both(page, 'toggle', true)
  await page.reload()
  await expect(page.getByTestId('composer')).toBeVisible()
  await both(page, 'toggle', true)
  await page.getByTestId('new-chat').click()
  await expect(page.locator('.greeting')).toBeVisible()
  await both(page, 'toggle', true)
})

test('the first request on fresh load carries thinking and search enabled', async ({ page }) => {
  const bodies: Body[] = []
  await install(page, bodies)
  await page.goto('/')
  await unlock(page)
  await page.getByTestId('composer').fill('第一句')
  await page.getByTestId('send').click()
  await expect(page.getByTestId('assistant-text')).toContainText('好的')
  expect(bodies).toHaveLength(1)
  expect(bodies[0].thinking?.type).toBe('enabled')
  expect(hasSearch(bodies[0])).toBe(true)
  await page.getByTestId('new-chat').click()
  await both(page, 'toggle', true)
})

test('dark theme and 390 phone: fresh-load toggles render the official active style', async ({ page }) => {
  await install(page, [])
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')
  await unlock(page)
  await expect(page.locator('body')).toHaveAttribute('data-ds-dark-theme', /.*/)
  await both(page, 'toggle', true, 'dark')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByTestId('toggle-thinking')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('toggle-search')).toHaveAttribute('aria-pressed', 'true')
})

test('a change holds through New chat in this page session and reload returns to the official on', async ({ page }) => {
  const bodies: Body[] = []
  await install(page, bodies)
  await page.goto('/')
  await unlock(page)
  await page.getByTestId('toggle-thinking').click()
  await page.getByTestId('toggle-search').click()
  await both(page, 'toggle', false)
  await page.getByTestId('composer').fill('关掉之后')
  await page.getByTestId('send').click()
  await expect(page.getByTestId('assistant-text')).toContainText('好的')
  expect(bodies.at(-1)?.thinking?.type).toBe('disabled')
  expect(hasSearch(bodies.at(-1) ?? {})).toBe(false)
  await page.getByTestId('new-chat').click()
  await expect(page.locator('.greeting')).toBeVisible()
  await both(page, 'toggle', false)
  await page.reload()
  await expect(page.getByTestId('composer')).toBeVisible()
  await both(page, 'toggle', true)
})

test('a stale stored toggle from an older build does not override the official default', async ({ page }) => {
  await install(page, [])
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('deepapi-toggles', JSON.stringify({ thinking: false, search: false }))
      sessionStorage.setItem('seeded', '1')
    }
  })
  await page.goto('/')
  await both(page, 'landing', true)
  await unlock(page)
  await both(page, 'toggle', true)
})
