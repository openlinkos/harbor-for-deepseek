import { expect, test, type Page, type Route } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const shots = '/opt/cursor/artifacts'
mkdirSync(shots, { recursive: true })

type Body = {
  thinking?: { type?: string }
  tools?: Array<{ type?: string }>
}

const sse = (events: unknown[]) =>
  `${events.map((event) => `event: ${(event as { type: string }).type}\ndata: ${JSON.stringify(event)}\n\n`).join('')}: keep-alive\n\n`

const thinkEvents = (title: string, thought: string, text: string) => [
  { type: 'message_start', message: { id: 'req-think', model: 'deepseek-flash' } },
  { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: thought } },
  { type: 'content_block_stop', index: 0 },
  { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
  { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text } },
  { type: 'content_block_stop', index: 1 },
  { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null, title }, usage: { input_tokens: 10, output_tokens: 4, output_tokens_details: { thinking_tokens: 2 } } },
  { type: 'message_stop' },
]

const searchEvents = () => [
  { type: 'message_start', message: { id: 'req-search', model: 'deepseek-flash' } },
  { type: 'content_block_start', index: 0, content_block: { type: 'server_tool_use', id: 'srvtoolu_s_00_redacted', name: 'deepseek_web_search', input: { action: 'search', queries: ['冰岛现在大约多少人口'] }, caller: { type: 'direct' }, kind: 'search' } },
  { type: 'content_block_start', index: 1, content_block: { type: 'web_search_tool_result', tool_use_id: 'srvtoolu_s_00_redacted', kind: 'search', content: [{ type: 'web_search_result', title: 'Iceland population', url: 'https://example.com/iceland', snippet: 'About 394,000 people.', site_name: 'Example', site_icon: null, page_age: '2026-11-16' }] } },
  { type: 'content_block_start', index: 2, content_block: { type: 'text', text: 'About 394,000.' } },
  { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null, title: '只搜索' }, usage: { input_tokens: 20, output_tokens: 8, server_tool_use: { web_search_requests: 1, web_fetch_requests: 0, tool_search: 1, tool_fetch: 0, tool_image_search: 0 } } },
  { type: 'message_stop' },
]

const plainEvents = () => [
  { type: 'message_start', message: { id: 'req-plain', model: 'deepseek-flash' } },
  { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '好的' } },
  { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null, title: '新的一句' }, usage: { input_tokens: 8, output_tokens: 2 } },
  { type: 'message_stop' },
]

const hasSearch = (body: Body) => (body.tools ?? []).some((tool) => tool.type === 'deepseek_web_search')

const install = async (page: Page, bodies: Body[], eventsFor: (body: Body) => unknown[]) => {
  await page.route('https://api.deepseek.com/**', async (route: Route) => {
    const url = route.request().url()
    if (url.endsWith('/user/balance')) {
      await route.fulfill({ json: { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '1.00', granted_balance: '0.00', topped_up_balance: '1.00' }] } })
      return
    }
    if (url.endsWith('/models')) {
      await route.fulfill({ json: { data: [{ id: 'deepseek-flash' }, { id: 'deepseek-v4-pro' }] } })
      return
    }
    if (url.includes('/messages')) {
      const body = route.request().postDataJSON() as Body
      bodies.push(body)
      await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: sse(eventsFor(body)) })
      return
    }
    await route.fulfill({ status: 404, json: { error: { message: 'not mocked' } } })
  })
}

const unlock = async (page: Page) => {
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()
}

const send = async (page: Page, text: string) => {
  await page.getByTestId('composer').fill(text)
  await page.getByTestId('send').click()
}

const expectChip = async (page: Page, testId: string, on: boolean) => {
  const chip = page.getByTestId(testId)
  if (on) await expect(chip).toHaveClass(/\bon\b/)
  else await expect(chip).not.toHaveClass(/\bon\b/)
}

const openSavedChat = async (page: Page, title: string) => {
  await page.getByTestId('sidebar').getByRole('button', { name: title, exact: true }).click()
  await expect(page.getByTestId('assistant-text')).toBeVisible()
}

const backHome = async (page: Page, title: string, how: 'click' | 'Control+j' | 'Meta+j') => {
  await openSavedChat(page, title)
  if (how === 'click') await page.getByTestId('new-chat').click()
  else await page.keyboard.press(how)
  await expect(page.locator('.greeting')).toBeVisible()
}

test('home turns deep thinking off and the request stays disabled', async ({ page }) => {
  const bodies: Body[] = []
  await install(page, bodies, () => plainEvents())
  await unlock(page)
  await expectChip(page, 'toggle-thinking', true)
  await page.getByTestId('toggle-thinking').click()
  await expectChip(page, 'toggle-thinking', false)
  await page.screenshot({ path: join(shots, 'thinking-off-home.png') })
  await send(page, '不要思考')
  await expect(page.getByTestId('assistant-text')).toContainText('好的')
  expect(bodies.at(-1)?.thinking?.type).toBe('disabled')
})

test('deep thinking stays off after new chat, the shortcut, and reload', async ({ page }) => {
  const bodies: Body[] = []
  let shape: 'think' | 'plain' = 'think'
  await install(page, bodies, () => (shape === 'think' ? thinkEvents('已有对话', '先算一下', '8') : plainEvents()))
  await unlock(page)
  await send(page, '先留下一句带思考的')
  await expect(page.getByTestId('sidebar')).toContainText('已有对话')
  await page.getByTestId('new-chat').click()
  await expect(page.locator('.greeting')).toBeVisible()
  await page.getByTestId('toggle-thinking').click()
  await expectChip(page, 'toggle-thinking', false)

  await backHome(page, '已有对话', 'click')
  await expectChip(page, 'toggle-thinking', false)
  await backHome(page, '已有对话', 'Control+j')
  await expectChip(page, 'toggle-thinking', false)
  await backHome(page, '已有对话', 'Meta+j')
  await expectChip(page, 'toggle-thinking', false)
  await page.screenshot({ path: join(shots, 'thinking-off-after-shortcut.png') })

  await page.reload()
  await expect(page.getByTestId('composer')).toBeVisible()
  await expectChip(page, 'toggle-thinking', true)
  await page.screenshot({ path: join(shots, 'thinking-off-after-reload.png') })

  await page.getByTestId('new-chat').click()
  shape = 'plain'
  await send(page, '刷新之后再发')
  await expect(page.getByTestId('assistant-text')).toContainText('好的')
  expect(bodies.at(-1)?.thinking?.type).toBe('enabled')
})

test('smart search stays on after new chat and the shortcut, and resets off on reload', async ({ page }) => {
  const bodies: Body[] = []
  await install(page, bodies, () => plainEvents())
  await unlock(page)
  await send(page, '先搜索过一次')
  await expect(page.getByTestId('sidebar')).toContainText('新的一句')
  await page.getByTestId('new-chat').click()
  await page.getByTestId('toggle-search').click()
  await expectChip(page, 'toggle-search', false)

  await backHome(page, '新的一句', 'click')
  await expectChip(page, 'toggle-search', false)
  await backHome(page, '新的一句', 'Control+j')
  await expectChip(page, 'toggle-search', false)
  await backHome(page, '新的一句', 'Meta+j')
  await expectChip(page, 'toggle-search', false)

  await page.reload()
  await expect(page.getByTestId('composer')).toBeVisible()
  await expectChip(page, 'toggle-search', true)
  await page.screenshot({ path: join(shots, 'search-off-after-reload.png') })

  await page.getByTestId('new-chat').click()
  await send(page, '刷新之后不搜索')
  await expect(page.getByTestId('assistant-text').last()).toContainText('好的')
  expect(hasSearch(bodies.at(-1) ?? {})).toBe(true)
  expect(bodies.at(-1)?.thinking?.type).toBe('enabled')
})

test('landing chips are the same global toggles', async ({ page }) => {
  const bodies: Body[] = []
  await install(page, bodies, () => plainEvents())
  await page.goto('/')
  await expectChip(page, 'landing-thinking', true)
  await expectChip(page, 'landing-search', true)
  await page.getByTestId('landing-thinking').click()
  await page.getByTestId('landing-search').click()
  await expectChip(page, 'landing-thinking', false)
  await expectChip(page, 'landing-search', false)
  await page.screenshot({ path: join(shots, 'landing-toggles-off.png') })

  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await expectChip(page, 'toggle-thinking', false)
  await expectChip(page, 'toggle-search', false)

  await page.reload()
  await expect(page.getByTestId('composer')).toBeVisible()
  await expectChip(page, 'toggle-thinking', true)
  await expectChip(page, 'toggle-search', true)
  await send(page, '落地页带进来的开关')
  await expect(page.getByTestId('assistant-text')).toContainText('好的')
  expect(bodies.at(-1)?.thinking?.type).toBe('enabled')
  expect(hasSearch(bodies.at(-1) ?? {})).toBe(true)
})

test('a search-only answer does not render the thought shell', async ({ page }) => {
  const bodies: Body[] = []
  await install(page, bodies, () => searchEvents())
  await unlock(page)
  await page.getByTestId('toggle-thinking').click()
  await expectChip(page, 'toggle-thinking', false)
  await expectChip(page, 'toggle-search', true)
  await send(page, '冰岛现在大约多少人口？')
  await expect(page.getByTestId('assistant-text')).toContainText('394,000')
  await expect(page.getByText('搜索到 1 个网页')).toBeVisible()
  await expect(page.getByTestId('thinking')).toHaveCount(0)
  await expect(page.getByText('已思考')).toHaveCount(0)
  await page.screenshot({ path: join(shots, 'search-only-no-thought.png') })
  expect(bodies.at(-1)?.thinking?.type).toBe('disabled')
  expect(hasSearch(bodies.at(-1) ?? {})).toBe(true)
})

test('an existing thinking answer stays intact after the toggle changes', async ({ page }) => {
  const bodies: Body[] = []
  await install(page, bodies, () => thinkEvents('简单加法', '3+5=8', '8'))
  await unlock(page)
  await send(page, '3 加 5 等于几？')
  await expect(page.getByTestId('thinking')).toContainText('已思考')
  await expect(page.getByTestId('thinking')).toContainText('3+5=8')
  await expect(page.getByTestId('assistant-text')).toContainText('8')

  await page.getByTestId('new-chat').click()
  await page.getByTestId('toggle-thinking').click()
  await expectChip(page, 'toggle-thinking', false)
  await openSavedChat(page, '简单加法')
  await expectChip(page, 'toggle-thinking', false)
  await expect(page.getByTestId('thinking')).toContainText('已思考')
  await expect(page.getByTestId('thinking')).toContainText('3+5=8')
  await expect(page.getByTestId('assistant-text')).toContainText('8')
  await expect(page.getByTestId('message-list').getByTestId('assistant-text')).toHaveCount(1)
  await page.screenshot({ path: join(shots, 'history-thinking-kept.png') })

  await page.reload()
  await expect(page.getByTestId('composer')).toBeVisible()
  await expect(page.getByTestId('thinking')).toContainText('已思考')
  await expect(page.getByTestId('thinking')).toContainText('3+5=8')
  await expectChip(page, 'toggle-thinking', true)
})
