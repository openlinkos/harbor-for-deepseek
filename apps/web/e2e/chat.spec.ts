import { expect, test, type Page, type Route } from '@playwright/test'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const shots = join(process.cwd(), '../../docs/screenshots')
mkdirSync(shots, { recursive: true })

const thinking = [
  { type: 'message_start', message: { id: 'req-add', model: 'deepseek-flash', usage: { input_tokens: 49, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 0, service_tier: 'standard' } } },
  { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: '3+5=8' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'signature_delta', signature: 'sig-redacted' } },
  { type: 'content_block_stop', index: 0 },
  { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
  { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: '8' } },
  { type: 'content_block_stop', index: 1 },
  { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null, title: '简单加法' }, usage: { input_tokens: 41, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 33, service_tier: 'standard', output_tokens_details: { thinking_tokens: 31 } } },
  { type: 'message_stop' },
]

const search = [
  { type: 'message_start', message: { id: 'req-ice', model: 'deepseek-flash' } },
  { type: 'content_block_start', index: 0, content_block: { type: 'server_tool_use', id: 'srvtoolu_s_00_redacted', name: 'deepseek_web_search', input: { action: 'search', queries: ['冰岛现在大约多少人口', 'Iceland population 2026'] }, caller: { type: 'direct' }, kind: 'search' } },
  { type: 'content_block_start', index: 1, content_block: { type: 'web_search_tool_result', tool_use_id: 'srvtoolu_s_00_redacted', kind: 'search', content: [{ type: 'web_search_result', title: 'Iceland population', url: 'https://example.com/iceland', snippet: 'About 394,000 people.', site_name: 'Example', site_icon: null, page_age: '2026-11-16' }] } },
  { type: 'content_block_start', index: 2, content_block: { type: 'text', text: 'About 394,000.' } },
  { type: 'content_block_delta', index: 2, delta: { type: 'citations_delta', citation: { type: 'web_search_result_location', url: 'https://example.com/iceland', title: 'Iceland population', cited_text: 'About 394,000.', encrypted_index: '' } } },
  { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null, title: '冰岛人口' }, usage: { input_tokens: 1905, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 72, service_tier: 'standard', server_tool_use: { web_search_requests: 1, web_fetch_requests: 0, tool_search: 2, tool_fetch: 0, tool_image_search: 0 } } },
  { type: 'message_stop' },
]

const sse = (events: unknown[]) => `${events.map((event) => `event: ${(event as { type: string }).type}\ndata: ${JSON.stringify(event)}\n\n`).join('')}: keep-alive\n\n`

const fulfill = async (route: Route) => {
  const url = route.request().url()
  if (!url.startsWith('https://api.deepseek.com')) {
    await route.abort()
    return
  }
  expect(route.request().headers().cookie).toBeUndefined()
  if (url.endsWith('/user/balance')) {
    await route.fulfill({
      json: { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '317.22', granted_balance: '0.00', topped_up_balance: '317.22' }] },
    })
    return
  }
  if (url.endsWith('/models')) {
    await route.fulfill({ json: { data: [{ id: 'deepseek-flash' }, { id: 'deepseek-v4-pro' }] } })
    return
  }
  if (url.endsWith('/files') && route.request().method() === 'POST') {
    await route.fulfill({
      json: { id: 'file-api-00000000-0000-4000-8000-000000000001', object: 'file', bytes: 12, created_at: 1794936646, filename: 'note.txt', purpose: 'user_data', expires_at: 1794940246 },
    })
    return
  }
  if (url.includes('/messages')) {
    const body = route.request().postDataJSON() as {
      model: string
      safety_check: { level: string }
      thinking: { type: string }
      tools?: Array<{ type: string }>
      messages: Array<{ content: unknown }>
    }
    expect(body.safety_check.level).toBe('high')
    const tools = body.tools ?? []
    const events = tools.some((tool) => tool.type === 'deepseek_web_search') && body.thinking.type === 'disabled' ? search : thinking
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: sse(events),
    })
    return
  }
  await route.fulfill({ status: 404, json: { error: { message: 'not mocked' } } })
}

const install = async (page: Page) => {
  await page.route('https://api.deepseek.com/**', fulfill)
}

test('chats with mocks, switches tools, and round-trips an export', async ({ page }) => {
  await install(page)
  await page.goto('/')
  await expect(page).toHaveTitle('Harbor for DeepSeek')
  await expect(page.getByRole('heading', { name: '对话留在本机' })).toBeVisible()
  await expect(page.getByTestId('site-footer')).toContainText('OpenLinkOS 发起的开源项目')
  await expect(page.getByTestId('key-dialog')).toHaveCount(0)
  await expect(page.locator('.footnote')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('非官方社区项目')
  await page.screenshot({ path: join(shots, '01-key-gate.png'), fullPage: true })

  await page.getByTestId('landing-send').click()
  await expect(page.getByTestId('key-dialog')).toBeVisible()
  await expect(page.getByTestId('key-dialog')).not.toContainText('非官方')
  const kit = join(process.cwd(), '../../submission/awesome-deepseek-integration/docs/harbor/assets')
  mkdirSync(kit, { recursive: true })
  await page.screenshot({ path: join(kit, 'api-key.png'), fullPage: true })
  await page.screenshot({ path: join(shots, '01-key-step.png'), fullPage: true })

  await page.getByTestId('key-ack').check()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()
  await expect(page.locator('.footnote')).toHaveCount(0)
  await expect(page.locator('.wordmark')).toHaveText('Harbor for DeepSeek')
  await page.screenshot({ path: join(shots, 'brand-light.png'), clip: { x: 0, y: 0, width: 280, height: 80 } })
  await page.getByTestId('user-menu').click()
  await expect(page.getByTestId('balance-side')).toContainText('317.22')
  await page.getByTestId('user-menu').click()
  await page.screenshot({ path: join(shots, '02-empty.png') })
  await expect(page.getByTestId('sidebar')).toContainText('本地模式')
  await expect(page.getByTestId('sidebar')).toContainText('密钥与对话仅保存在本设备')
  await page.screenshot({ path: join(shots, 'sidebar-footer.png'), clip: { x: 0, y: 700, width: 280, height: 120 } })

  await page.getByTestId('composer').fill('3 加 5 等于几？')
  await page.getByTestId('send').click()
  await expect(page.getByTestId('assistant-text')).toContainText('8')
  await expect(page.getByTestId('thinking')).toContainText('3+5=8')
  await expect(page.getByTestId('sidebar')).toContainText('简单加法')
  await page.screenshot({ path: join(shots, '03-reasoning.png') })
  await page.screenshot({ path: join(process.cwd(), '../../submission/awesome-deepseek-integration/docs/harbor/assets/chat.png') })
  await expect(page.locator('.action-row button')).toHaveCount(6)
  await expect(page.getByTestId('message-list')).not.toContainText('输入')

  await page.getByTestId('user-menu').click()
  await page.getByTestId('settings-open').click()
  await page.getByRole('button', { name: '数据管理' }).click()
  await page.getByTestId('settings-more-data').evaluate((el: HTMLDetailsElement) => { el.open = true })
  await expect(page.getByTestId('balance')).toContainText('317.22')
  await expect(page.locator('.usage-grid')).toContainText('41')
  await expect(page.getByTestId('safety-select')).toHaveValue('high')
  await page.screenshot({ path: join(shots, '04-settings.png') })
  await page.getByRole('heading', { name: '更换 Key' }).evaluate((el) => el.scrollIntoView({ block: 'center' }))
  await page.screenshot({ path: join(process.cwd(), '../../submission/awesome-deepseek-integration/docs/harbor/assets/settings-key.png') })
  await page.getByRole('button', { name: '通用设置' }).click()
  await page.getByRole('button', { name: '深色' }).click()
  await page.getByTestId('settings-dialog').getByRole('button', { name: '关闭' }).click()
  await page.screenshot({ path: join(shots, '13-dark.png') })
  await page.screenshot({ path: join(shots, 'brand-dark.png'), clip: { x: 0, y: 0, width: 280, height: 80 } })
  await page.getByTestId('user-menu').click()
  await page.getByTestId('settings-open').click()
  await page.getByRole('button', { name: '浅色' }).click()
  await page.getByTestId('settings-dialog').getByRole('button', { name: '关闭' }).click()
  await expect(page.getByTestId('settings-dialog')).toBeHidden()

  await page.getByTestId('new-chat').click()
  await page.getByTestId('toggle-thinking').click()
  await page.getByTestId('composer').fill('冰岛现在大约多少人口？')
  await page.getByTestId('send').click()
  await page.getByTestId('search-results').click()
  await expect(page.getByTestId('search-panel')).toContainText('Iceland population')
  await expect(page.getByTestId('assistant-text')).toContainText('394,000')
  await page.mouse.move(8, 8)
  await page.screenshot({ path: join(shots, '05-search.png') })

  await page.getByTestId('user-menu').click()
  await page.getByTestId('settings-open').click()
  await page.getByRole('button', { name: '通用设置' }).click()
  await page.getByTestId('settings-more-general').evaluate((el: HTMLDetailsElement) => { el.open = true })
  await page.getByTestId('model-select').selectOption('deepseek-v4-pro')
  await expect(page.getByTestId('toggle-search')).toBeDisabled()
  await expect(page.getByTestId('toggle-read')).toBeDisabled()
  await page.getByTestId('settings-dialog').getByRole('button', { name: '关闭' }).click()

  await page.getByTestId('user-menu').click()
  await page.getByTestId('settings-open').click()
  await page.getByRole('button', { name: '数据管理' }).click()
  await page.getByTestId('settings-more-data').evaluate((el: HTMLDetailsElement) => { el.open = true })
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-json').click(),
  ])
  const exported = join(process.cwd(), 'test-results/export.json')
  mkdirSync(dirname(exported), { recursive: true })
  await download.saveAs(exported)
  const raw = readFileSync(exported, 'utf8')
  expect(raw).not.toContain('demo-local-key')
  expect(raw).toContain('简单加法')
  expect(raw).toContain('"format": "harbor"')

  await page.getByTestId('import-json').setInputFiles(exported)
  await expect(page.getByTestId('import-toast')).toContainText('跳过')
  await page.getByTestId('import-as-copy').check()
  await page.getByTestId('import-json').setInputFiles(exported)
  await expect(page.getByTestId('import-toast')).toContainText('已导入')
  await page.screenshot({ path: join(shots, '06-imported.png') })
  await page.getByTestId('settings-dialog').getByRole('button', { name: '关闭' }).click()
  await page.getByTestId('import-toast').getByRole('button', { name: '关闭' }).click()

  await page.getByTestId('search-panel').getByRole('button', { name: '关闭' }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByTestId('menu').click()
  await expect(page.getByTestId('sidebar')).toBeVisible()
  await expect(page.getByTestId('sidebar')).toContainText('本地模式')
  await expect(page.getByTestId('sidebar')).toContainText('密钥与对话仅保存在本设备')
  await page.screenshot({ path: join(shots, '07-mobile.png') })
})

test('phone layout matches the docked chat, drawer, and sheets', async ({ page }) => {
  await install(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-ack').check()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()
  await page.screenshot({ path: join(shots, 'm-home.png') })
  await page.getByTestId('menu').click()
  await expect(page.getByTestId('sidebar')).toContainText('本地模式')
  await page.screenshot({ path: join(shots, 'm-drawer.png') })
  await page.getByTestId('user-menu').click()
  await page.screenshot({ path: join(shots, 'm-user-menu.png') })
  await page.getByTestId('settings-open').click()
  await expect(page.getByTestId('nickname')).toBeHidden()
  await page.getByRole('button', { name: '账号管理' }).click()
  await page.getByTestId('nickname').fill('阿港')
  await page.getByTestId('avatar-initial').fill('港')
  await page.getByRole('button', { name: '保存' }).click()
  await page.screenshot({ path: join(shots, 'm-settings.png') })
  await page.getByTestId('settings-dialog').getByRole('button', { name: '关闭' }).click()
  await page.getByTestId('sidebar').getByRole('button', { name: '隐藏' }).click()
  await page.getByTestId('composer').fill('3 加 5 等于几？')
  await page.getByTestId('send').click()
  await expect(page.getByTestId('assistant-text')).toContainText('8')
  await expect(page.getByTestId('thinking')).toContainText('已思考')
  await page.screenshot({ path: join(shots, 'm-thinking.png') })
  await page.getByRole('button', { name: '开启新对话' }).click()
  await page.getByTestId('toggle-thinking').click()
  await page.getByTestId('composer').fill('冰岛现在大约多少人口？')
  await page.getByTestId('send').click()
  await expect(page.getByTestId('assistant-text')).toContainText('394,000')
  await expect(page.getByText('搜索到 1 个网页')).toBeVisible()
  await page.screenshot({ path: join(shots, 'm-search.png') })
  await page.getByTestId('search-results').click()
  await expect(page.getByTestId('search-panel')).toContainText('Iceland population')
  await page.screenshot({ path: join(shots, 'm-sources.png') })
  await page.getByTestId('search-panel').getByRole('button', { name: '关闭' }).click()
  await page.getByTestId('menu').click()
  await page.getByTestId('user-menu').click()
  await page.getByTestId('settings-open').click()
  await page.getByRole('button', { name: '深色' }).click()
  await page.getByTestId('settings-dialog').getByRole('button', { name: '关闭' }).click()
  await expect(page.locator('.wordmark')).toHaveText('Harbor for DeepSeek')
  await page.screenshot({ path: join(shots, 'm-drawer-dark.png') })
  await page.getByTestId('sidebar').getByRole('button', { name: '隐藏' }).click()
  await page.screenshot({ path: join(shots, 'm-dark.png') })
})

test('uploads a file with an expiry and keeps safety review on', async ({ page }) => {
  const bodies: Array<Record<string, unknown>> = []
  await page.route('https://api.deepseek.com/**', async (route) => {
    if (route.request().url().includes('/messages')) {
      bodies.push(route.request().postDataJSON() as Record<string, unknown>)
    }
    await fulfill(route)
  })
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-ack').check()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await page.getByTestId('file-input').setInputFiles({ name: 'note.txt', mimeType: 'text/plain', buffer: Buffer.from('hello harbor') })
  await expect(page.locator('.drafts')).toContainText('note.txt')
  await page.getByTestId('composer').fill('what is in the file?')
  await page.getByTestId('send').click()
  await expect(page.getByTestId('assistant-text')).toContainText('8')
  const body = bodies.at(-1) as { messages: Array<{ content: unknown }>; safety_check: { level: string } }
  expect(body.safety_check.level).toBe('high')
  expect(JSON.stringify(body.messages[0]?.content)).toContain('file-api-')
})

test('landing and key step at desktop and phone sizes', async ({ page }) => {
  await install(page)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '对话留在本机' })).toBeVisible()
  await page.screenshot({ path: join(shots, 'landing-light-1280.png') })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: join(shots, 'landing-mobile.png') })
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.getByTestId('landing-send').click()
  await page.screenshot({ path: join(shots, 'key-light-1280.png') })
  await page.addInitScript(() => localStorage.setItem('harbor-theme', 'dark'))
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await page.screenshot({ path: join(shots, 'landing-dark-1280.png') })
  await page.getByTestId('landing-send').click()
  await page.screenshot({ path: join(shots, 'key-dark-1280.png') })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: join(shots, 'key-mobile.png') })
})

test('english footer keeps the trademark note off the composer', async ({ page }) => {
  await install(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'English' }).click()
  await expect(page.getByTestId('site-footer')).toContainText('Open source by OpenLinkOS')
  await expect(page.getByTestId('site-footer')).toContainText('not affiliated with DeepSeek')
  await expect(page.locator('.footnote')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('平替')
  await expect(page.locator('body')).not.toContainText('非官方社区项目')
})
