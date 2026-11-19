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
  await expect(page).toHaveTitle('DeepAPI')
  await expect(page.getByRole('heading', { name: 'DeepAPI' })).toBeVisible()
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

  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()
  await expect(page.locator('.footnote')).toHaveCount(0)
  await expect(page.locator('.wordmark')).toHaveText('DeepAPI')
  await page.screenshot({ path: join(shots, 'brand-light.png'), clip: { x: 0, y: 0, width: 280, height: 80 } })
  await page.getByTestId('user-menu').click()
  await page.getByTestId('settings-open').click()
  await page.getByRole('button', { name: '账号管理' }).click()
  await expect(page.getByTestId('balance-side')).toContainText('317.22')
  await page.getByRole('button', { name: '关闭' }).click()
  await page.screenshot({ path: join(shots, '02-empty.png') })
  await expect(page.getByTestId('sidebar')).toContainText('DeepAPI')
  await expect(page.getByTestId('sidebar')).not.toContainText('密钥与对话仅保存在本设备')
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
  await page.getByRole('button', { name: '账号管理' }).click()
  await expect(page.getByTestId('balance-side')).toContainText('317.22')
  await page.getByTestId('refresh-balance').click()
  await expect(page.getByTestId('balance-side')).toContainText('317.22')
  await page.getByRole('button', { name: '数据管理' }).click()
  await expect(page.locator('.usage-grid')).toContainText('41')
  expect(await page.getByTestId('safety-select').textContent()).toContain('高')
  await page.screenshot({ path: join(shots, '04-settings.png') })
  await page.getByRole('button', { name: '账号管理' }).click()
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
  await expect(page.getByTestId('model-select')).toBeVisible()
  await page.getByTestId('model-select').click()
  await page.getByRole('option', { name: 'DeepSeek Pro' }).click()
  await expect(page.getByTestId('model-select')).toContainText('DeepSeek Pro')
  await page.getByTestId('effort-select').click()
  await page.getByRole('option', { name: 'low', exact: true }).click()
  await expect(page.getByTestId('effort-select')).toContainText('low')
  await page.getByTestId('safety-select').click()
  await page.getByRole('option', { name: '低（与不传该参数相同）' }).click()
  await expect(page.getByTestId('safety-select')).toContainText('低')
  await page.getByTestId('safety-select').click()
  await page.getByRole('option', { name: '高（公开站点默认）' }).click()
  await page.getByTestId('skin-reset').click()
  await expect(page.getByTestId('toggle-search')).toHaveAttribute('aria-disabled', 'true')
  const searchClass = await page.getByTestId('toggle-search').getAttribute('class')
  await page.getByTestId('toggle-search').click({ force: true })
  await expect(page.getByTestId('toggle-search')).toHaveAttribute('aria-disabled', 'true')
  await expect(page.getByTestId('toggle-search')).toHaveAttribute('class', searchClass ?? '')
  await expect(page.getByTestId('toggle-read')).toBeDisabled()
  await page.getByTestId('settings-dialog').getByRole('button', { name: '关闭' }).click()

  await page.getByTestId('user-menu').click()
  await page.getByTestId('settings-open').click()
  await page.getByRole('button', { name: '数据管理' }).click()
  await expect(page.getByTestId('export-json')).toBeVisible()
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
  expect(raw).toContain('"format": "deepapi"')

  await page.getByTestId('import-json').setInputFiles(exported)
  await expect(page.getByTestId('import-toast')).toContainText('跳过')
  await page.getByTestId('import-as-copy').click()
  await page.getByTestId('import-json').setInputFiles(exported)
  await expect(page.getByTestId('import-toast')).toContainText('已导入')
  await page.screenshot({ path: join(shots, '06-imported.png') })
  await page.getByTestId('settings-dialog').getByRole('button', { name: '关闭' }).click()
  await page.getByTestId('import-toast').getByRole('button', { name: '关闭' }).click()

  await page.getByTestId('search-panel').getByRole('button', { name: '关闭' }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByTestId('menu').click()
  await expect(page.getByTestId('sidebar')).toBeVisible()
  await expect(page.getByTestId('sidebar')).toContainText('DeepAPI')
  await expect(page.getByTestId('sidebar')).not.toContainText('密钥与对话仅保存在本设备')
  await page.screenshot({ path: join(shots, '07-mobile.png') })
})

test('phone layout matches the docked chat, drawer, and sheets', async ({ page }) => {
  await install(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()
  await page.screenshot({ path: join(shots, 'm-home.png') })
  await page.getByTestId('menu').click()
  await expect(page.getByTestId('sidebar')).toContainText('DeepAPI')
  await page.screenshot({ path: join(shots, 'm-drawer.png') })
  await page.getByTestId('user-menu').click()
  await page.screenshot({ path: join(shots, 'm-user-menu.png') })
  await page.getByTestId('settings-open').click()
  await expect(page.getByTestId('nickname')).toBeHidden()
  await page.getByRole('button', { name: '账号管理' }).click()
  await expect(page.getByTestId('nickname')).toBeVisible()
  await expect(page.getByTestId('avatar-initial')).toBeVisible()
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
  await page.getByTestId('top-new').click()
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
  await expect(page.locator('.wordmark')).toHaveText('DeepAPI')
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
  await expect(page.getByRole('heading', { name: 'DeepAPI' })).toBeVisible()
  await page.screenshot({ path: join(shots, 'landing-light-1280.png') })
  await page.setViewportSize({ width: 390, height: 844 })
  const foot = page.locator('.landing-foot')
  await expect(foot).toBeVisible()
  const footBox = await foot.boundingBox()
  expect(footBox).toBeTruthy()
  expect(footBox!.x).toBeGreaterThanOrEqual(0)
  expect(footBox!.x + footBox!.width).toBeLessThanOrEqual(390)
  const footLinks = foot.locator('a, strong, div > div')
  const footCount = await footLinks.count()
  expect(footCount).toBeGreaterThan(0)
  for (let i = 0; i < footCount; i++) {
    const link = footLinks.nth(i)
    const box = await link.boundingBox()
    expect(box).toBeTruthy()
    expect(box!.height).toBeLessThan(32)
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(390)
  }
  await page.screenshot({ path: join(shots, 'landing-mobile.png') })
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.getByTestId('landing-send').click()
  await page.screenshot({ path: join(shots, 'key-light-1280.png') })
  await page.addInitScript(() => localStorage.setItem('deepapi-theme', 'dark'))
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

const topmostButton = async (page: Page, selector: string) => {
  const box = await page.locator(selector).boundingBox()
  expect(box).toBeTruthy()
  return page.evaluate(({ x, y }) => {
    const hit = document.elementFromPoint(x, y)
    const button = hit?.closest('button')
    return button?.getAttribute('data-testid') || button?.getAttribute('aria-label') || ''
  }, { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 })
}

test('390 top-bar buttons stay above the white fill', async ({ page }) => {
  await install(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await page.getByTestId('composer').fill('3 加 5 等于几？')
  await page.getByTestId('send').click()
  await expect(page.getByTestId('assistant-text')).toContainText('8')
  await page.locator('.top-fill').evaluate((node) => { node.style.pointerEvents = 'auto' })
  expect(await topmostButton(page, '[data-testid="menu"]')).toBe('menu')
  expect(await topmostButton(page, '[data-testid="top-new"]')).toBe('top-new')
  expect(await topmostButton(page, 'button[aria-label="share"]')).toBe('share')
})

test('kept settings rows use the official 60px line and 36px controls', async ({ page }) => {
  await install(page)
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await page.getByTestId('user-menu').click()
  await page.getByTestId('settings-open').click()
  const measure = async () => page.evaluate(() => {
    const row = (selector: string) => {
      const node = document.querySelector(selector)?.closest('.settings-line') as HTMLElement
      const style = getComputedStyle(node)
      return { h: Math.round(node.getBoundingClientRect().height), fs: style.fontSize, lh: style.lineHeight }
    }
    const box = (selector: string) => {
      const node = document.querySelector(selector) as HTMLElement
      const style = getComputedStyle(node)
      const rect = node.getBoundingClientRect()
      return { h: Math.round(rect.height), w: Math.round(rect.width), bg: style.backgroundColor, color: style.color, radius: style.borderRadius, tag: node.tagName }
    }
    return {
      usage: row('[data-testid="usage-grid"] .settings-line span'),
      bullets: document.querySelectorAll('[data-testid="usage-grid"] li').length,
      replace: row('[data-testid="replace-key"] .settings-line span'),
      keyInput: box('[data-testid="replace-key"] input'),
      save: box('[data-testid="replace-save"]'),
      server: row('[data-testid="server-note"] .settings-copy > span'),
      expiry: box('[data-testid="file-expiry"]'),
      purpose: box('[data-testid="purpose-select"]'),
    }
  })
  await page.getByRole('button', { name: '数据管理' }).click()
  const light = await measure()
  expect(light.usage).toMatchObject({ h: 60, fs: '14px', lh: '22px' })
  expect(light.bullets).toBe(0)
  expect(light.replace).toMatchObject({ h: 60, fs: '14px', lh: '22px' })
  expect(light.keyInput.h).toBe(36)
  expect(light.save.h).toBe(36)
  expect(light.save.bg).toBe('rgba(0, 0, 0, 0)')
  expect(light.server).toMatchObject({ h: 86, fs: '14px', lh: '22px' })
  await page.getByRole('button', { name: '通用设置' }).click()
  const general = await measure()
  expect(general.expiry.h).toBe(36)
  expect(general.purpose.h).toBe(36)
  await page.getByRole('button', { name: '深色' }).click()
  await page.getByRole('button', { name: '数据管理' }).click()
  const dark = await measure()
  expect(dark.usage.h).toBe(60)
  expect(dark.keyInput.h).toBe(36)
  expect(dark.keyInput.bg).not.toBe('rgb(53, 54, 56)')
  expect(dark.save.bg).not.toBe('rgb(53, 54, 56)')
  expect(dark.save.color).not.toBe('rgb(15, 17, 21)')
  expect(dark.save.h).toBe(36)
  await page.getByRole('button', { name: '通用设置' }).click()
  const darkGeneral = await measure()
  expect(darkGeneral.expiry.h).toBe(36)
  expect(darkGeneral.purpose.h).toBe(36)
  expect(darkGeneral.purpose.tag).not.toBe('SELECT')
  expect(darkGeneral.purpose.bg).toBe('rgb(67, 69, 74)')
})

test('390 composer and title stay above a sticky code header', async ({ page }) => {
  await install(page)
  await page.route('https://api.deepseek.com/**', async (route) => {
    if (!route.request().url().includes('/messages') || !route.request().postData()?.includes('代码块')) {
      await route.fallback()
      return
    }
    const events = [
      { type: 'message_start', message: { id: 'req-code', model: 'deepseek-flash' } },
      { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: '先写一段代码。' } },
      { type: 'content_block_stop', index: 0 },
      { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: '```js\nconst timerId = setTimeout(captureStyleAudit, 10000)\nclearTimeout(timerId)\n```\n' + '说明。\n'.repeat(30) } },
      { type: 'content_block_stop', index: 1 },
      { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null, title: '自我介绍' }, usage: { input_tokens: 10, output_tokens: 20, output_tokens_details: { thinking_tokens: 4 } } },
      { type: 'message_stop' },
    ]
    await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: sse(events) })
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await page.getByTestId('composer').fill('代码块')
  await page.getByTestId('send').click()
  await expect(page.locator('.code-sticky')).toBeVisible()
  await page.locator('[data-testid="message-list"]').evaluate((node) => { node.scrollTop = node.scrollHeight })
  const layers = await page.evaluate(() => ({
    top: Number(getComputedStyle(document.querySelector('.topbar')!).zIndex),
    composer: Number(getComputedStyle(document.querySelector('.composer-wrap')!).zIndex),
    code: Number(getComputedStyle(document.querySelector('.code-sticky')!).zIndex),
  }))
  expect(layers.top).toBeGreaterThan(layers.code)
  expect(layers.composer).toBeGreaterThan(layers.code)
  const composer = await page.getByTestId('composer').boundingBox()
  const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('[data-testid="composer"], .code-sticky, .code-head')?.getAttribute('data-testid') || document.elementFromPoint(x, y)?.closest('.code-sticky, .code-head')?.className || '', { x: composer!.x + 20, y: composer!.y + 20 })
  expect(hit).toContain('composer')
  const title = await page.locator('.chat-title').boundingBox()
  const thought = await page.getByText(/已思考/).first().boundingBox()
  if (title && thought) {
    const overlaps = title.x < thought.x + thought.width && thought.x < title.x + title.width && title.y < thought.y + thought.height && thought.y < title.y + title.height
    expect(overlaps).toBe(false)
  }
})

test('dark landing matches the light landing', async ({ page }) => {
  const read = async () => page.evaluate(() => {
    const chip = document.querySelector('.landing .chip.on') as HTMLElement
    const lang = document.querySelector('.landing .lang') as HTMLElement
    const en = [...document.querySelectorAll('.landing .lang button')].find((node) => node.textContent?.trim() === 'EN') as HTMLElement
    const word = document.querySelector('.landing .wordmark-name') as HTMLElement
    const box = document.querySelector('.landing .composer') as HTMLElement
    const chipStyle = getComputedStyle(chip)
    return {
      word: getComputedStyle(word).color,
      border: getComputedStyle(box).borderTopColor,
      chipBg: chipStyle.backgroundColor,
      chipText: chipStyle.color,
      chipBorder: chipStyle.borderTopColor,
      lang: getComputedStyle(lang).backgroundColor,
      en: getComputedStyle(en).color,
    }
  })
  for (const width of [1920, 1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
    await page.emulateMedia({ colorScheme: 'light' })
    await page.addInitScript(() => localStorage.setItem('deepapi-theme', 'system'))
    await page.goto('/')
    await page.locator('.landing .chip.on').first().waitFor()
    const light = await read()
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.reload()
    await page.locator('.landing .chip.on').first().waitFor()
    const dark = await read()
    expect(dark).toEqual(light)
    expect(dark.word).not.toBe('rgb(249, 250, 251)')
    expect(dark.chipBg).toBe('rgb(237, 243, 254)')
    expect(dark.chipText).toBe('rgb(57, 100, 254)')
    expect(dark.chipBorder).toBe('rgb(183, 200, 254)')
    expect(dark.lang).toBe('rgb(241, 243, 245)')
    expect(dark.en).toBe('rgb(15, 17, 21)')
    expect(dark.border).toBe('rgba(0, 0, 0, 0.1)')
    await page.getByTestId('landing-send').click()
    const key = await page.locator('.key-card').evaluate((node) => {
      const input = node.querySelector('input') as HTMLElement
      return { card: getComputedStyle(node).backgroundColor, border: getComputedStyle(input).borderTopColor }
    })
    expect(key.card).toBe('rgb(255, 255, 255)')
    expect(key.border).toBe('rgba(0, 0, 0, 0.1)')
  }
})

test('a dark settings switch stays brand blue when on', async ({ page }) => {
  await install(page)
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await page.getByTestId('user-menu').click()
  await page.getByTestId('settings-open').click()
  await page.getByTestId('toggle-read').click()
  await page.getByRole('button', { name: '深色' }).click()
  await expect(page.getByTestId('toggle-read')).toHaveCSS('background-color', 'rgb(57, 100, 254)')
})
