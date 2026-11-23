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
  await expect(page.getByTestId('balance-side')).toContainText('CNY 可用')
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
  await expect(page.locator('.action-row button')).toHaveCount(5)
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
  await page.getByTestId('toggle-search').click()
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
  await expect(page.getByTestId('model-select')).toHaveCount(0)
  await expect(page.getByTestId('effort-select')).toHaveCount(0)
  await page.getByTestId('safety-select').click()
  await page.getByRole('option', { name: '低（与不传该参数相同）' }).click()
  await expect(page.getByTestId('safety-select')).toContainText('低')
  await page.getByTestId('safety-select').click()
  await page.getByRole('option', { name: '高（公开站点默认）' }).click()
  await page.getByTestId('skin-reset').click()
  await expect(page.getByTestId('toggle-search')).not.toHaveAttribute('aria-disabled', 'true')
  await expect(page.getByTestId('toggle-read')).toBeEnabled()
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
  await expect(page.getByTestId('avatar-initial')).toHaveAttribute('placeholder', '字')
  expect(await page.getByTestId('avatar-initial').evaluate((node) => getComputedStyle(node).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)')
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
  await page.getByTestId('toggle-search').click()
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

test('uploads a file and keeps safety review on', async ({ page }) => {
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
  expect(await topmostButton(page, '.topbar button[aria-label="分享"]')).toBe('分享')
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
    const label = (selector: string) => {
      const node = document.querySelector(selector) as HTMLElement
      const style = getComputedStyle(node)
      const row = node.closest('.settings-line') as HTMLElement
      return { h: Math.round(row.getBoundingClientRect().height), fs: style.fontSize, lh: style.lineHeight }
    }
    const hint = (selector: string) => {
      const node = document.querySelector(selector) as HTMLElement
      const style = getComputedStyle(node)
      return { fs: style.fontSize, lh: style.lineHeight, fits: node.scrollHeight <= node.clientHeight + 1 }
    }
    const box = (selector: string) => {
      const node = document.querySelector(selector) as HTMLElement
      const style = getComputedStyle(node)
      const rect = node.getBoundingClientRect()
      return { h: Math.round(rect.height), w: Math.round(rect.width), bg: style.backgroundColor, color: style.color, radius: style.borderRadius, tag: node.tagName }
    }
    const paired = (selector: string) => {
      const button = document.querySelector(selector) as HTMLElement
      const row = button.closest('.settings-line') as HTMLElement
      return { label: row.querySelector(':scope > span')?.textContent ?? '', button: button.textContent ?? '' }
    }
    return {
      usage: label('[data-testid="usage-grid"] .settings-line > span'),
      bullets: document.querySelectorAll('[data-testid="usage-grid"] li').length,
      replace: label('[data-testid="replace-key"] .settings-line > span'),
      keyInput: box('[data-testid="replace-key"] input'),
      save: box('[data-testid="replace-save"]'),
      savePair: paired('[data-testid="replace-save"]'),
      server: label('[data-testid="server-note"] .settings-copy > span'),
      serverHint: hint('[data-testid="server-note"] .hint'),
    }
  })
  await page.getByRole('button', { name: '数据管理' }).click()
  await expect(page.getByText('导出本机保存的对话记录。')).toBeVisible()
  await expect(page.getByText('下载链接的有效期为 7 天')).toHaveCount(0)
  const light = await measure()
  expect(light.usage).toMatchObject({ h: 60, fs: '14px', lh: '22px' })
  expect(light.bullets).toBe(0)
  expect(light.replace).toMatchObject({ h: 60, fs: '14px', lh: '22px' })
  expect(light.keyInput.h).toBe(36)
  expect(light.save.h).toBe(36)
  expect(light.save.bg).toBe('rgba(0, 0, 0, 0)')
  expect(light.savePair.label).not.toBe(light.savePair.button)
  expect(light.server.fs).toBe('14px')
  expect(light.server.lh).toBe('22px')
  expect(light.server.h).toBeGreaterThanOrEqual(86)
  expect(light.serverHint).toMatchObject({ fs: '12px', lh: '18px', fits: true })
  await page.getByRole('button', { name: '通用设置' }).click()
  const generalLabels = await page.locator('.settings-general .settings-line > span:first-child').allTextContents()
  expect(generalLabels.map((label) => label.trim()).filter(Boolean)).toEqual(['语言', '界面包', '安全审核', '打开网页'])
  await page.getByRole('button', { name: '深色' }).click()
  await page.getByRole('button', { name: '数据管理' }).click()
  const dark = await measure()
  expect(dark.usage).toMatchObject({ h: 60, fs: '14px', lh: '22px' })
  expect(dark.serverHint).toMatchObject({ fs: '12px', lh: '18px', fits: true })
  expect(dark.keyInput.h).toBe(36)
  expect(dark.keyInput.bg).not.toBe('rgb(53, 54, 56)')
  expect(dark.save.bg).not.toBe('rgb(53, 54, 56)')
  expect(dark.save.color).not.toBe('rgb(15, 17, 21)')
  expect(dark.save.h).toBe(36)
  await page.getByRole('button', { name: '通用设置' }).click()
  const darkLabels = await page.locator('.settings-general .settings-line > span:first-child').allTextContents()
  expect(darkLabels.map((label) => label.trim()).filter(Boolean)).toEqual(['语言', '界面包', '安全审核', '打开网页'])
})

test('390 balance label stays on one line', async ({ page }) => {
  await install(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await page.getByTestId('menu').click()
  await page.getByTestId('user-menu').click()
  await page.getByTestId('settings-open').click()
  await page.getByRole('button', { name: '账号管理' }).click()
  const box = await page.getByTestId('balance-label').boundingBox()
  expect(box).toBeTruthy()
  expect(Math.round(box!.height)).toBe(22)
  expect(box!.width).toBeGreaterThan(27)
})

test('390 balance label and refresh sit on the row centre', async ({ page }) => {
  await install(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await page.getByTestId('menu').click()
  await page.getByTestId('user-menu').click()
  await page.getByTestId('settings-open').click()
  await page.getByRole('button', { name: '账号管理' }).click()
  const metrics = await page.evaluate(() => {
    const box = (selector: string) => {
      const rect = document.querySelector(selector)!.getBoundingClientRect()
      return { top: rect.top, bottom: rect.bottom, mid: rect.top + rect.height / 2, right: rect.right }
    }
    const row = document.querySelector('[data-testid="balance-label"]')!.closest('.settings-line')!.getBoundingClientRect()
    return {
      rowMid: row.top + row.height / 2,
      rowRight: row.right,
      label: box('[data-testid="balance-label"]'),
      value: box('[data-testid="balance-value"]'),
      button: box('[data-testid="refresh-balance"]'),
      hint: box('[data-testid="balance-hint"]'),
    }
  })
  expect(Math.abs(metrics.label.mid - metrics.rowMid)).toBeLessThanOrEqual(1)
  expect(Math.abs(metrics.button.mid - metrics.rowMid)).toBeLessThanOrEqual(1)
  expect(Math.abs(metrics.button.right - metrics.rowRight)).toBeLessThanOrEqual(1)
  expect(metrics.hint.top).toBeGreaterThanOrEqual(metrics.value.bottom - 1)
  expect(metrics.button.right).toBeGreaterThan(metrics.value.right)
})

test('balance hint keeps a gap from the value', async ({ page }) => {
  await install(page)
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await page.getByTestId('user-menu').click()
  await page.getByTestId('settings-open').click()
  await page.getByRole('button', { name: '账号管理' }).click()
  const gap = () => page.evaluate(() => {
    const value = document.querySelector('[data-testid="balance-value"]')!.getBoundingClientRect()
    const hint = document.querySelector('[data-testid="balance-hint"]')!.getBoundingClientRect()
    if (hint.top >= value.bottom - 1) return hint.top - value.bottom
    return hint.left - value.right
  })
  await page.setViewportSize({ width: 1440, height: 900 })
  expect(await gap()).toBeGreaterThanOrEqual(4)
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await gap()).toBeGreaterThanOrEqual(4)
})

test('390 language menu stays inside the viewport', async ({ page }) => {
  await install(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await page.getByTestId('menu').click()
  await page.getByTestId('user-menu').click()
  await page.getByTestId('settings-open').click()
  await page.getByTestId('language-trigger').click()
  const menu = page.locator('.lang-menu')
  await expect(menu).toBeVisible()
  const box = await menu.boundingBox()
  expect(box).toBeTruthy()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(390)
  const mark = menu.locator('button[aria-selected="true"] svg')
  await expect(mark).toBeVisible()
  const markBox = await mark.boundingBox()
  expect(markBox).toBeTruthy()
  expect(markBox!.x).toBeGreaterThanOrEqual(0)
  expect(markBox!.x + markBox!.width).toBeLessThanOrEqual(390)
})

test('server note hint fits at 1440 and 390', async ({ page }) => {
  await install(page)
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await page.getByTestId('user-menu').click()
  await page.getByTestId('settings-open').click()
  await page.getByRole('button', { name: '数据管理' }).click()
  const fits = () => page.locator('[data-testid="server-note"] .hint').evaluate((node) => node.scrollHeight <= node.clientHeight + 1)
  await page.setViewportSize({ width: 1440, height: 900 })
  expect(await fits()).toBe(true)
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await fits()).toBe(true)
})

test('settings stay up when balance has no infos', async ({ page }) => {
  await install(page)
  await page.route('https://api.deepseek.com/user/balance', async (route) => {
    await route.fulfill({ json: { is_available: true } })
  })
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await page.getByTestId('user-menu').click()
  await page.getByTestId('settings-open').click()
  await page.getByRole('button', { name: '账号管理' }).click()
  await expect(page.getByTestId('settings-dialog')).toBeVisible()
  await expect(page.getByTestId('balance-side')).toHaveText('没有读到余额。')
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
    const thinking = page.getByTestId('landing-thinking')
    if (!((await thinking.getAttribute('class')) ?? '').includes('on')) await thinking.click()
    await page.mouse.move(0, 0)
    await expect(thinking).toHaveCSS('background-color', 'rgb(237, 243, 254)')
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

const enterChat = async (page: Page) => {
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()
}

const openSettings = async (page: Page) => {
  await page.getByTestId('user-menu').click()
  await page.getByTestId('settings-open').click()
  await expect(page.getByTestId('settings-dialog')).toBeVisible()
}

test('settings no longer show an upload file expiry row', async ({ page }) => {
  await install(page)
  await enterChat(page)
  await openSettings(page)
  await expect(page.getByTestId('file-expiry')).toHaveCount(0)
  await expect(page.getByTestId('purpose-select')).toHaveCount(0)
  await expect(page.getByTestId('settings-dialog')).not.toContainText('上传文件过期')
  await expect(page.getByTestId('settings-dialog')).not.toContainText('PDF / Office')
  const labels = await page.locator('.settings-general .settings-line > span:first-child').allTextContents()
  expect(labels.map((label) => label.trim()).filter(Boolean)).toEqual(['语言', '界面包', '安全审核', '打开网页'])
  await page.getByTestId('language-trigger').click()
  await page.getByRole('option', { name: 'English' }).click()
  await expect(page.getByTestId('settings-dialog')).not.toContainText('Uploaded files expire')
  await expect(page.getByTestId('file-expiry')).toHaveCount(0)
})

test('a local upload does not send expires_after', async ({ page }) => {
  await install(page)
  await enterChat(page)
  const req = page.waitForRequest((request) => request.method() === 'POST' && request.url().endsWith('/files'))
  await page.getByTestId('file-input').setInputFiles({
    name: 'note.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('hello harbor'),
  })
  await expect(page.locator('.drafts')).toContainText('note.txt')
  const fileBody = (await req).postData() ?? ''
  expect(fileBody).toContain('user_data')
  expect(fileBody).toContain('note.txt')
  expect(fileBody).not.toContain('expires_after')
  expect(fileBody.toLowerCase()).not.toContain('expire')
})

test('a stored fileExpireDays value still lets the page load', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await install(page)
  await enterChat(page)
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('deepapi')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('kv', 'readwrite')
      const store = tx.objectStore('kv')
      const read = store.get('settings')
      read.onerror = () => reject(read.error)
      read.onsuccess = () => {
        const current = read.result
        if (!current || typeof current !== 'object') {
          reject(new Error('settings missing'))
          return
        }
        store.put({ ...current, fileExpireDays: 3 }, 'settings')
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  })
  await page.reload()
  await expect(page.getByTestId('composer')).toBeVisible()
  await openSettings(page)
  await expect(page.getByTestId('file-expiry')).toHaveCount(0)
  await expect(page.getByTestId('settings-dialog')).not.toContainText('上传文件过期')
  expect(pageErrors).toEqual([])
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
  await expect(page.getByTestId('toggle-read')).toHaveCSS('background-color', 'rgb(86, 134, 254)')
})
