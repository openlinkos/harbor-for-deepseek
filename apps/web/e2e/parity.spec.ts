import { expect, test, type Page, type Route } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const artifacts = '/opt/cursor/artifacts'
mkdirSync(artifacts, { recursive: true })

const shots = join(process.cwd(), '../../docs/parity/ours')
mkdirSync(shots, { recursive: true })

const sse = (events: unknown[]) =>
  `${events.map((event) => `event: ${(event as { type: string }).type}\ndata: ${JSON.stringify(event)}\n\n`).join('')}: keep-alive\n\n`

const answer = (title: string, text: string, thinking = 'reasoning') => [
  { type: 'message_start', message: { id: 'req', model: 'deepseek-flash' } },
  { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking } },
  { type: 'content_block_stop', index: 0 },
  { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
  { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text } },
  { type: 'content_block_stop', index: 1 },
  { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null, title }, usage: { input_tokens: 10, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 4, service_tier: 'standard', output_tokens_details: { thinking_tokens: 2 } } },
  { type: 'message_stop' },
]

const rich = [
  '# 标题',
  '',
  '- 一层',
  '  - 二层',
  '',
  '> 引用一句',
  '',
  '见 [示例](https://example.com/doc) 和公式 $E=mc^2$。',
  '',
  '![图](data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2210%22%20height%3D%2210%22%3E%3C/svg%3E)',
  '',
  '| 优势 | 风险 |',
  '| --- | --- |',
  '| 收入 | 波动 |',
  '',
  '```',
  '┌──┐',
  '│表│',
  '└──┘',
  '```',
  '',
  '```ts',
  'const n = 1',
  '```',
  '',
  '```mermaid',
  'graph LR',
  '  A-->B',
  '```',
].join('\n')

let mode: 'ok' | 'delay' | 'bad' | 'down' | 'limited' | 'alt' = 'ok'
let richText = false

const fulfill = async (route: Route) => {
  const url = route.request().url()
  if (url.endsWith('/user/balance')) {
    await route.fulfill({ json: { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '1.00', granted_balance: '0', topped_up_balance: '1.00' }] } })
    return
  }
  if (url.endsWith('/models')) {
    await route.fulfill({ json: { data: [{ id: 'deepseek-flash' }] } })
    return
  }
  if (!url.includes('/messages')) {
    await route.fulfill({ status: 404, json: { error: { message: 'not mocked' } } })
    return
  }
  if (mode === 'delay') {
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
  if (mode === 'bad') {
    await route.fulfill({ status: 401, headers: { 'content-type': 'application/json' }, body: '{"error":{"message":"bad key"}}' })
    return
  }
  if (mode === 'down') {
    await route.abort('failed')
    return
  }
  if (mode === 'limited') {
    await route.fulfill({ status: 429, headers: { 'content-type': 'application/json' }, body: '{"error":{"message":"rate limit"}}' })
    return
  }
  const text = mode === 'alt' ? '第二版' : richText ? rich : '第一版'
  await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: sse(answer(mode === 'alt' ? '版本' : '对照', text)) })
}

const unlock = async (page: Page) => {
  mode = 'ok'
  richText = false
  await page.route('https://api.deepseek.com/**', fulfill)
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

const age = async (page: Page, days: number) => {
  await page.evaluate(async (days) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('deepapi')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const tx = db.transaction('conversations', 'readwrite')
    const store = tx.objectStore('conversations')
    const rows = await new Promise<Array<{ updatedAt: string }>>((resolve) => {
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result as Array<{ updatedAt: string }>)
    })
    const when = new Date(Date.now() - days * 86_400_000).toISOString()
    for (const row of rows) {
      row.updatedAt = when
      store.put(row)
    }
    await new Promise((resolve) => {
      tx.oncomplete = () => resolve(null)
    })
    db.close()
  }, days)
  await page.reload()
  await expect(page.getByTestId('composer')).toBeVisible()
}

test('new chat', async ({ page }) => {
  await unlock(page)
  await send(page, '你好')
  await expect(page.getByTestId('assistant-text')).toContainText('第一版')
  await page.getByTestId('new-chat').click()
  await expect(page.getByTestId('assistant-text')).toHaveCount(0)
  await expect(page.getByTestId('sidebar')).toContainText('开启新对话')
  await page.screenshot({ path: join(shots, 'new-chat-light.png') })
})

test('send', async ({ page }) => {
  await unlock(page)
  await page.getByTestId('composer').fill('你好')
  await page.getByTestId('composer').press('Enter')
  await expect(page.getByTestId('message-user')).toContainText('你好')
  await expect(page.locator('.turn.user')).toHaveCSS('flex-direction', 'column')
  await expect(page.locator('.turn.user')).toHaveCSS('align-items', 'flex-end')
})

test('stream and stop', async ({ page }) => {
  await unlock(page)
  mode = 'delay'
  await send(page, '慢一点')
  await expect(page.getByTestId('stop')).toBeVisible()
  await page.getByTestId('stop').click()
  await expect(page.getByTestId('stop')).toBeHidden()
  await expect(page.getByTestId('send')).toBeVisible()
  await expect(page.locator('.form-error')).toHaveCount(0)
  await expect(page.getByText('已停止')).toBeVisible()
  await expect(page.getByTestId('message-user')).toContainText('慢一点')
  mode = 'ok'
  await send(page, '继续')
  await expect(page.getByTestId('assistant-text').last()).toContainText('第一版')
})

test('versions', async ({ page }) => {
  await unlock(page)
  await send(page, '版本')
  await expect(page.getByTestId('assistant-text')).toContainText('第一版')
  mode = 'alt'
  await page.getByTestId('regenerate').click()
  await expect(page.getByTestId('versions')).toContainText('2 / 2')
  await page.getByRole('button', { name: '‹' }).click()
  await expect(page.getByTestId('assistant-text')).toContainText('第一版')
  await page.getByRole('button', { name: '›' }).click()
  await expect(page.getByTestId('assistant-text')).toContainText('第二版')
})

test('edit and copy', async ({ page }) => {
  await unlock(page)
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await send(page, '要改的句子')
  await page.getByRole('button', { name: '编辑' }).click()
  await expect(page.locator('.edit-card textarea')).toHaveValue('要改的句子')
  await page.getByRole('button', { name: '取消' }).click()
  const copy = page.locator('.action-row').getByRole('button', { name: '复制' })
  await copy.click()
  await expect(copy).toContainText('✓')
})

test('reactions', async ({ page }) => {
  await unlock(page)
  await send(page, '评价')
  const row = page.locator('.action-row')
  await row.getByRole('button', { name: '喜欢', exact: true }).click()
  await expect(row.getByRole('button', { name: '喜欢', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await row.getByRole('button', { name: '不喜欢', exact: true }).click()
  await expect(row.getByRole('button', { name: '不喜欢', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(row.getByRole('button', { name: '朗读' })).toHaveCount(0)
  await expect(row.getByRole('button', { name: '分享' })).toBeVisible()
})

test('tools default on', async ({ page }) => {
  await unlock(page)
  await expect(page.getByTestId('toggle-thinking')).toHaveClass(/on/)
  await expect(page.getByTestId('toggle-search')).toHaveClass(/on/)
  await expect(page.getByTestId('toggle-search')).toContainText('智能搜索')
  await page.getByTestId('toggle-thinking').click()
  await expect(page.getByTestId('toggle-thinking')).not.toHaveClass(/on/)
  await page.getByTestId('toggle-search').click()
  await expect(page.getByTestId('toggle-search')).not.toHaveClass(/on/)
})

test('search citations', async ({ page }) => {
  await unlock(page)
  await page.unroute('https://api.deepseek.com/**')
  await page.route('https://api.deepseek.com/**', async (route) => {
    if (!route.request().url().includes('/messages')) {
      await fulfill(route)
      return
    }
    const events = [
      { type: 'message_start', message: { id: 'req-c', model: 'deepseek-flash' } },
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '人口约 394,000〔1〕' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'citations_delta', citation: { type: 'web_search_result_location', url: 'https://example.com/iceland', title: 'Iceland', cited_text: '394,000', encrypted_index: '' } } },
      { type: 'message_delta', delta: { stop_reason: 'end_turn', title: '引用' }, usage: { input_tokens: 3, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 3, service_tier: 'standard' } },
      { type: 'message_stop' },
    ]
    await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: sse(events) })
  })
  await send(page, '人口')
  await expect(page.locator('.cite')).toHaveText(['1'])
  await page.locator('.cite').hover()
  await expect(page.locator('.search-view-card')).toContainText('Iceland')
  await expect(page.locator('.search-view-card')).toContainText('394,000')
})

const iconPixel = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

const searchResults = [
  { type: 'web_search_result', title: '冰岛人口统计', url: 'https://example.com/pop', snippet: '约三十九万', site_name: '国家统计局', site_icon: iconPixel, page_age: '2026-11-16' },
  { type: 'web_search_result', title: '未引用甲', url: 'https://example.com/a', snippet: '甲', site_name: '甲站' },
  { type: 'web_search_result', title: '未引用乙', url: 'https://example.com/b', snippet: '乙', site_name: '乙站' },
  { type: 'web_search_result', title: '未引用丙', url: 'https://example.com/c', snippet: '丙', site_name: '丙站' },
  { type: 'web_search_result', title: '雷克雅未克概况', url: 'https://example.com/city', snippet: '首都', site_name: '地理志' },
]

const searchCiteEvents = () => [
  { type: 'message_start', message: { id: 'req-cite', model: 'deepseek-flash' } },
  { type: 'content_block_start', index: 0, content_block: { type: 'server_tool_use', id: 'tool-cite', name: 'deepseek_web_search', input: { action: 'search', queries: ['冰岛人口'] }, caller: { type: 'direct' }, kind: 'search' } },
  { type: 'content_block_stop', index: 0 },
  { type: 'content_block_start', index: 1, content_block: { type: 'web_search_tool_result', tool_use_id: 'tool-cite', kind: 'search', content: searchResults } },
  { type: 'content_block_stop', index: 1 },
  { type: 'content_block_start', index: 2, content_block: { type: 'text', text: '' } },
  { type: 'content_block_delta', index: 2, delta: { type: 'text_delta', text: '冰岛大约有三十九万人。' } },
  { type: 'content_block_delta', index: 2, delta: { type: 'citations_delta', citation: { type: 'web_search_result_location', url: 'https://example.com/pop', title: '模型引用标题', cited_text: 'Population of Iceland is about 390,000 according to the source page.', encrypted_index: '' } } },
  { type: 'content_block_delta', index: 2, delta: { type: 'text_delta', text: '首都是雷克雅未克。' } },
  { type: 'content_block_delta', index: 2, delta: { type: 'citations_delta', citation: { type: 'web_search_result_location', url: 'https://example.com/city', title: '模型城市标题', cited_text: 'Reykjavik is the capital city listed on the source page.', encrypted_index: '' } } },
  { type: 'content_block_stop', index: 2 },
  { type: 'message_delta', delta: { stop_reason: 'end_turn', title: '冰岛' }, usage: { input_tokens: 12, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 8, service_tier: 'standard' } },
  { type: 'message_stop' },
]

const openSearchAnswer = async (page: Page) => {
  await unlock(page)
  await page.unroute('https://api.deepseek.com/**')
  await page.route('https://api.deepseek.com/**', async (route) => {
    if (!route.request().url().includes('/messages')) {
      await fulfill(route)
      return
    }
    await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: sse(searchCiteEvents()) })
  })
  await send(page, '冰岛人口和首都')
  return page.getByTestId('assistant-text').locator('.cite')
}

test('search cite numbers follow the result list', async ({ page }) => {
  const cites = await openSearchAnswer(page)
  await expect(cites).toHaveText(['1', '5'])
  const shape = await page.getByTestId('assistant-text').evaluate((root) =>
    [...root.querySelectorAll('.cite')].map((node) => {
      const style = getComputedStyle(node)
      return {
        text: node.textContent,
        connected: node.isConnected,
        tl: style.borderTopLeftRadius,
        tr: style.borderTopRightRadius,
        br: style.borderBottomRightRadius,
        bl: style.borderBottomLeftRadius,
        background: style.backgroundColor,
      }
    }),
  )
  expect(shape).toHaveLength(2)
  expect(shape[0]).toMatchObject({ text: '1', connected: true, tl: '6px', tr: '6px', br: '6px', bl: '0px' })
  expect(shape[0]?.background).not.toBe('rgba(0, 0, 0, 0)')
  expect(shape[1]?.text).toBe('5')
  await page.locator('.turn.assistant').screenshot({ path: join(artifacts, 'cite-badges.png') })
})

test('search cite marks sit at the end of the cited sentence', async ({ page }) => {
  await openSearchAnswer(page)
  const placed = await page.getByTestId('assistant-text').evaluate((root) => {
    const groups = [...root.querySelectorAll('[data-citation-group]')]
    const group = groups[0]
    const previous = group?.previousSibling
    return {
      groups: groups.length,
      cites: [...root.querySelectorAll('.cite')].map((node) => node.textContent),
      prev: previous && previous.nodeType === Node.TEXT_NODE ? previous.textContent ?? '' : '',
      onlyAnchors: group ? [...group.children].every((el) => el.tagName === 'A') : false,
    }
  })
  expect(placed.groups).toBe(1)
  expect(placed.cites).toEqual(['1', '5'])
  expect(placed.prev.endsWith('雷克雅未克。')).toBe(true)
  expect(placed.prev.includes('三十九万人。')).toBe(true)
  expect(placed.onlyAnchors).toBe(true)
})

test('search cite hover shows the result title and site', async ({ page }) => {
  const cites = await openSearchAnswer(page)
  await cites.nth(0).hover()
  const first = page.locator('.search-view-card').filter({ hasText: '冰岛人口统计' })
  await expect(first).toBeVisible()
  await expect(first).toContainText('冰岛人口统计')
  await expect(first).toContainText('国家统计局')
  await expect(first).not.toContainText('模型引用标题')
  await page.screenshot({ path: join(artifacts, 'cite-hover-1.png') })
  await page.mouse.move(8, 8)
  await cites.nth(1).hover()
  const second = page.locator('.search-view-card').filter({ hasText: '雷克雅未克概况' })
  await expect(second).toBeVisible()
  await expect(second).toContainText('雷克雅未克概况')
  await expect(second).toContainText('地理志')
  await expect(second).not.toContainText('模型城市标题')
  await page.screenshot({ path: join(artifacts, 'cite-hover-5.png') })
})

test('search cite click opens the result url in a new tab', async ({ page }) => {
  await page.context().route('https://example.com/**', async (route) => {
    const url = route.request().url()
    await route.fulfill({ status: 200, contentType: 'text/html', body: `<!doctype html><title>${url}</title><h1>${url}</h1>` })
  })
  const cites = await openSearchAnswer(page)
  await expect(cites.nth(0)).toHaveAttribute('href', 'https://example.com/pop')
  await expect(cites.nth(0)).toHaveAttribute('target', '_blank')
  const [first] = await Promise.all([
    page.context().waitForEvent('page'),
    cites.nth(0).click(),
  ])
  await first.waitForLoadState('domcontentloaded')
  await expect(first).toHaveURL('https://example.com/pop')
  await first.screenshot({ path: join(artifacts, 'cite-click-1.png') })
  await first.close()
  await expect(cites.nth(1)).toHaveAttribute('href', 'https://example.com/city')
  await expect(cites.nth(1)).toHaveAttribute('target', '_blank')
  const [second] = await Promise.all([
    page.context().waitForEvent('page'),
    cites.nth(1).click(),
  ])
  await second.waitForLoadState('domcontentloaded')
  await expect(second).toHaveURL('https://example.com/city')
  await second.screenshot({ path: join(artifacts, 'cite-click-5.png') })
})

test('non-search citations keep citation-order marks', async ({ page }) => {
  await unlock(page)
  await page.unroute('https://api.deepseek.com/**')
  await page.route('https://api.deepseek.com/**', async (route) => {
    if (!route.request().url().includes('/messages')) {
      await fulfill(route)
      return
    }
    const events = [
      { type: 'message_start', message: { id: 'req-plain', model: 'deepseek-flash' } },
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '甲结论。乙结论。〔1〕〔2〕' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'citations_delta', citation: { type: 'web_search_result_location', url: 'https://example.com/a', title: '甲来源', cited_text: '甲', encrypted_index: '' } } },
      { type: 'content_block_delta', index: 0, delta: { type: 'citations_delta', citation: { type: 'web_search_result_location', url: 'https://example.com/b', title: '乙来源', cited_text: '乙', encrypted_index: '' } } },
      { type: 'message_delta', delta: { stop_reason: 'end_turn', title: '顺序' }, usage: { input_tokens: 3, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 3, service_tier: 'standard' } },
      { type: 'message_stop' },
    ]
    await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: sse(events) })
  })
  await send(page, '两处引用')
  const cites = page.getByTestId('assistant-text').locator('.cite')
  await expect(cites).toHaveText(['1', '2'])
  const tail = await cites.nth(0).evaluate((node) => node.parentElement?.previousSibling?.textContent ?? '')
  expect(tail.endsWith('乙结论。')).toBe(true)
  const grouped = await cites.nth(1).evaluate((node) => {
    const parent = node.parentElement
    return Boolean(parent?.hasAttribute('data-citation-group') && parent.querySelectorAll('.cite').length === 2)
  })
  expect(grouped).toBe(true)
  await cites.nth(0).hover()
  await expect(page.locator('.search-view-card')).toContainText('甲来源')
  await page.locator('.turn.assistant').screenshot({ path: join(artifacts, 'cite-nonssearch.png') })
})

test('search cite hover card matches the official source card', async ({ page }) => {
  await page.context().route('https://example.com/**', async (route) => {
    const url = route.request().url()
    await route.fulfill({ status: 200, contentType: 'text/html', body: `<!doctype html><title>${url}</title><h1>${url}</h1>` })
  })
  const cites = await openSearchAnswer(page)
  const started = Date.now()
  await cites.nth(0).hover()
  expect(await page.locator('.search-view-card').count()).toBe(0)
  const card = page.locator('.search-view-card')
  await expect(card).toBeVisible()
  expect(Date.now() - started).toBeGreaterThanOrEqual(280)
  const shape = await card.evaluate((node) => {
    const style = getComputedStyle(node)
    const title = node.querySelector('.search-view-card__title')
    const snippet = node.querySelector('.search-view-card__snippet')
    const icon = node.querySelector('.search-view-card__icon')
    const titleStyle = title ? getComputedStyle(title) : null
    const snippetStyle = snippet ? getComputedStyle(snippet) : null
    const iconStyle = icon ? getComputedStyle(icon) : null
    return {
      maxWidth: style.maxWidth,
      padding: style.padding,
      radius: style.borderRadius,
      titleWeight: titleStyle?.fontWeight ?? '',
      titleSize: titleStyle?.fontSize ?? '',
      titleLine: titleStyle?.lineHeight ?? '',
      snippetSize: snippetStyle?.fontSize ?? '',
      snippetLine: snippetStyle?.lineHeight ?? '',
      icon: iconStyle ? `${iconStyle.width}x${iconStyle.height}` : '',
      order: [...node.querySelectorAll('.search-view-card__icon, .search-view-card__site, .search-view-card__date, .search-view-card__title, .search-view-card__snippet')].map((el) => el.className),
    }
  })
  expect(shape).toMatchObject({
    maxWidth: '355px',
    padding: '16px',
    radius: '12px',
    titleWeight: '500',
    titleSize: '16px',
    titleLine: '25px',
    snippetSize: '13px',
    snippetLine: '20px',
    icon: '18pxx18px',
    order: ['search-view-card__icon', 'search-view-card__site', 'search-view-card__date', 'search-view-card__title', 'search-view-card__snippet'],
  })
  await expect(card).toContainText('国家统计局')
  await expect(card).toContainText('2026/11/16')
  await expect(card).toContainText('冰岛人口统计')
  await expect(card).toContainText('约三十九万')
  await page.screenshot({ path: join(artifacts, 'cite-hover-card.png') })
  await page.setViewportSize({ width: 390, height: 844 })
  await cites.nth(0).hover()
  await expect(card).toBeVisible()
  const hit = await cites.nth(0).evaluate((node) => {
    const rect = node.getBoundingClientRect()
    const target = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
    return Boolean(target && (target === node || node.contains(target)))
  })
  expect(hit).toBe(true)
  const [popup] = await Promise.all([
    page.context().waitForEvent('page'),
    cites.nth(0).click(),
  ])
  await popup.waitForLoadState('domcontentloaded')
  await expect(popup).toHaveURL('https://example.com/pop')
  await popup.close()
})

test('search cite badge hover uses the citation color', async ({ page }) => {
  await unlock(page)
  await page.unroute('https://api.deepseek.com/**')
  await page.route('https://api.deepseek.com/**', async (route) => {
    if (!route.request().url().includes('/messages')) {
      await fulfill(route)
      return
    }
    const results = Array.from({ length: 10 }, (_, index) => ({
      type: 'web_search_result',
      title: `结果${index + 1}`,
      url: `https://example.com/r${index + 1}`,
      snippet: `摘要${index + 1}`,
      site_name: `站点${index + 1}`,
    }))
    const events = [
      { type: 'message_start', message: { id: 'req-wide', model: 'deepseek-flash' } },
      { type: 'content_block_start', index: 0, content_block: { type: 'web_search_tool_result', tool_use_id: 'tool-wide', kind: 'search', content: results } },
      { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: '第一句。' } },
      { type: 'content_block_delta', index: 1, delta: { type: 'citations_delta', citation: { type: 'web_search_result_location', url: 'https://example.com/r1', title: '模型1', cited_text: 'source one', encrypted_index: '' } } },
      { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: '第十句。' } },
      { type: 'content_block_delta', index: 1, delta: { type: 'citations_delta', citation: { type: 'web_search_result_location', url: 'https://example.com/r10', title: '模型10', cited_text: 'source ten', encrypted_index: '' } } },
      { type: 'message_delta', delta: { stop_reason: 'end_turn', title: '两位' }, usage: { input_tokens: 4, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 4, service_tier: 'standard' } },
      { type: 'message_stop' },
    ]
    await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: sse(events) })
  })
  await send(page, '两位数字')
  const cites = page.getByTestId('assistant-text').locator('.cite')
  await expect(cites).toHaveText(['1', '10'])
  const read = async (index: number) => page.getByTestId('assistant-text').evaluate((root, index) => {
    const node = root.querySelectorAll('.cite')[index]
    if (!node) return { background: '', variant: '', space: '', minWidth: '' }
    const style = getComputedStyle(node)
    return {
      background: style.backgroundColor,
      variant: style.fontVariantNumeric,
      space: style.whiteSpace,
      minWidth: style.minWidth,
    }
  }, index)
  expect(await read(0)).toMatchObject({ background: 'rgb(245, 246, 247)', minWidth: '14px' })
  await cites.nth(0).hover()
  expect(await read(0)).toMatchObject({
    background: 'rgb(235, 238, 242)',
    variant: 'tabular-nums',
    space: 'nowrap',
    minWidth: '14px',
  })
  expect(await read(1)).toMatchObject({ variant: 'tabular-nums', space: 'nowrap', minWidth: '20px' })
})

test('markdown surfaces', async ({ page }) => {
  await unlock(page)
  richText = true
  await send(page, '排版')
  const prose = page.locator('.prose').first()
  await expect(prose.locator('h1')).toContainText('标题')
  await expect(prose.locator('ul ul li')).toContainText('二层')
  await expect(prose.locator('blockquote')).toContainText('引用一句')
  await expect(prose.locator('a')).toHaveAttribute('target', '_blank')
  await expect(prose.locator('img')).toHaveAttribute('alt', '图')
  await expect(prose.locator('table')).toContainText('优势')
  await expect(prose.locator('.box-drawing')).toContainText('┌──┐')
  // React replaces the code node as the last stream frame lands, so a one-shot
  // getComputedStyle can see a detached element and return "". Retry the same values.
  await expect(prose.locator('.box-drawing code')).toHaveCSS('letter-spacing', /^(normal|0px)$/)
  await expect(prose.locator('.code-card').filter({ hasText: 'const n = 1' })).toBeVisible()
  await expect(prose.locator('.katex')).toBeVisible()
  await page.screenshot({ path: join(shots, 'markdown-light.png') })
})

test('mermaid card', async ({ page }) => {
  await unlock(page)
  richText = true
  await send(page, '图')
  const card = page.getByTestId('mermaid-card')
  await expect(card.getByRole('tab', { name: '图表' })).toBeVisible()
  await expect(card.locator('svg')).toBeVisible({ timeout: 15_000 })
  await card.getByRole('button', { name: '放大' }).click()
  await card.getByRole('tab', { name: '代码' }).click()
  await expect(card.locator('.diagram-source')).toContainText('graph LR')
  await expect(card.getByRole('button', { name: '下载' })).toBeVisible()
  await expect(card.getByRole('button', { name: '全屏' })).toBeVisible()
  await page.screenshot({ path: join(shots, 'mermaid-light.png') })
})

test('scroll', async ({ page }) => {
  await unlock(page)
  richText = true
  await send(page, '很长')
  const list = page.getByTestId('message-list')
  await list.evaluate((node) => {
    const pad = document.createElement('div')
    pad.style.height = '2400px'
    node.prepend(pad)
  })
  await list.hover()
  await page.mouse.wheel(0, -900)
  await expect(page.getByRole('button', { name: '回到底部' })).toBeVisible()
  await page.screenshot({ path: join(shots, 'scroll-light.png') })
})

test('errors', async ({ page }) => {
  await unlock(page)
  mode = 'bad'
  await send(page, '坏钥匙')
  await expect(page.locator('.form-error')).toBeVisible()
  await expect(page.getByTestId('retry')).toBeVisible()
  mode = 'limited'
  await send(page, '太多')
  await expect(page.locator('.form-error').last()).toBeVisible()
  mode = 'down'
  await send(page, '断网')
  await expect(page.locator('.form-error').last()).toBeVisible()
})

test('attachment', async ({ page }) => {
  await unlock(page)
  await page.getByTestId('file-input').setInputFiles({ name: 'note.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') })
  await expect(page.locator('.drafts')).toContainText('note.txt')
})

test('sidebar', async ({ page }) => {
  await unlock(page)
  await send(page, '侧栏')
  await page.locator('.chat-link').hover()
  await page.locator('.chat-link .more').click()
  await page.getByRole('menuitem', { name: '重命名' }).click()
  await page.getByLabel('对话标题').fill('新名字')
  await page.getByLabel('对话标题').press('Enter')
  await expect(page.getByTestId('sidebar')).toContainText('新名字')
  const title = page.locator('a.chat-link').first()
  const titlePaint = await title.evaluate((node) => {
    const button = node.querySelector('button')
    const linkStyle = getComputedStyle(node)
    const textStyle = getComputedStyle(button ?? node)
    return { decoration: linkStyle.textDecorationLine, color: textStyle.color, buttonDecoration: textStyle.textDecorationLine }
  })
  expect(titlePaint.decoration).toBe('none')
  expect(titlePaint.buttonDecoration).toBe('none')
  expect(titlePaint.color).not.toBe('rgb(0, 0, 238)')
  await page.locator('.chat-link').hover()
  await page.locator('.chat-link .more').click()
  await page.getByRole('menuitem', { name: '置顶' }).click()
  await expect(page.getByTestId('sidebar')).toContainText('置顶')
  await page.locator('.chat-link').hover()
  await page.locator('.chat-link .more').click()
  await page.getByRole('menuitem', { name: '多选' }).click()
  await expect(page.getByText('选择对话')).toBeVisible()
  const closeIcon = await page.locator('.select-close svg').evaluate((node) => {
    const style = getComputedStyle(node)
    const path = node.querySelector('path')
    const pathFill = path ? getComputedStyle(path).fill : style.fill
    return { fill: style.fill, stroke: style.stroke, pathFill }
  })
  expect(closeIcon.fill === 'none' || closeIcon.fill === 'rgba(0, 0, 0, 0)').toBe(false)
  expect(closeIcon.stroke === 'none' || closeIcon.stroke === 'rgba(0, 0, 0, 0)').toBe(true)
  expect(closeIcon.pathFill === 'none' || closeIcon.pathFill === 'rgba(0, 0, 0, 0)').toBe(false)
  await page.getByRole('checkbox', { name: '新名字' }).click()
  await expect(page.getByText('已选择 1 个对话')).toBeVisible()
  await page.locator('.select-foot').getByRole('button', { name: '置顶' }).click()
  await page.locator('.select-foot').getByRole('button', { name: '删除' }).click()
  await expect(page.getByTestId('sidebar')).not.toContainText('新名字')
})

test('keyboard and search', async ({ page }) => {
  await unlock(page)
  await send(page, '快捷键')
  await page.keyboard.press('Control+k')
  await expect(page.locator('.side-filter')).toBeVisible()
  await expect(page.getByTestId('sidebar')).toContainText('对照')
  await page.locator('.side-filter').fill('没有这句')
  await expect(page.getByTestId('sidebar')).not.toContainText('对照')
  await page.locator('.side-filter').fill('对照')
  await expect(page.getByTestId('sidebar')).toContainText('对照')
  await page.keyboard.press('Escape')
  await page.keyboard.press('Control+j')
  await expect(page.getByTestId('assistant-text')).toHaveCount(0)
})

test('date groups', async ({ page }) => {
  await unlock(page)
  await send(page, '分组')
  await expect(page.getByTestId('sidebar')).toContainText('今天')
  await age(page, 1)
  await expect(page.getByTestId('sidebar')).toContainText('昨天')
  await age(page, 3)
  await expect(page.getByTestId('sidebar')).toContainText('30 天内')
  await age(page, 12)
  await expect(page.getByTestId('sidebar')).toContainText('30 天内')
  await age(page, 40)
  await expect(page.getByTestId('sidebar').locator('.group-label').last()).toContainText(/\d{4}-\d{2}/)
})

test('settings', async ({ page }) => {
  await unlock(page)
  await page.getByTestId('user-menu').click()
  await page.getByTestId('settings-open').click()
  await expect(page.getByRole('button', { name: '通用设置' })).toBeVisible()
  await page.getByRole('button', { name: '深色' }).click()
  await expect(page.locator('body')).toHaveAttribute('data-ds-dark-theme', '')
  await page.screenshot({ path: join(shots, 'settings-dark.png') })
  await page.getByRole('button', { name: '浅色' }).click()
  await expect(page.locator('body')).not.toHaveAttribute('data-ds-dark-theme', '')
  await page.getByRole('button', { name: '跟随系统' }).click()
  await page.getByRole('button', { name: '账号管理' }).click()
  await expect(page.getByTestId('nickname')).toBeVisible()
  await expect(page.getByText('微信')).toHaveCount(0)
  await expect(page.getByTestId('balance-side')).toBeVisible()
  await page.getByRole('button', { name: '数据管理' }).click()
  await page.getByRole('button', { name: '服务协议' }).click()
  await expect(page.getByTestId('site-footer')).toContainText('OpenLinkOS')
  await page.getByRole('button', { name: '通用设置' }).click()
  await page.getByTestId('language-trigger').click()
  await page.getByRole('option', { name: 'English' }).click()
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByTestId('composer')).toHaveAttribute('placeholder', 'Message DeepSeek')
})

test('key gate', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'DeepAPI' })).toBeVisible()
  await expect(page.getByTestId('site-footer')).toContainText('商标')
  await page.screenshot({ path: join(shots, 'gate-light.png') })
})

test('local mode', async ({ page }) => {
  await unlock(page)
  await expect(page.getByTestId('sidebar')).toContainText('DeepAPI')
  await expect(page.getByTestId('sidebar')).not.toContainText('OpenLinkOS')
})

test('mobile drawer', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await unlock(page)
  await page.getByTestId('menu').click()
  await expect(page.getByTestId('sidebar')).toBeVisible()
  await page.screenshot({ path: join(shots, 'mobile-light.png') })
})

test('thinking motion', async ({ page }) => {
  await unlock(page)
  await send(page, '思考')
  const collapse = page.locator('.thinking-collapse')
  await expect(collapse).toHaveClass(/open/)
  await expect(collapse).toHaveCSS('transition-duration', /0\.2s/)
  await expect(page.getByTestId('thinking')).toContainText('reasoning')
  await page.getByTestId('thinking-toggle').click()
  await expect(collapse).not.toHaveClass(/open/)
})

test('dialog motion', async ({ page }) => {
  await unlock(page)
  await page.getByTestId('user-menu').click()
  await page.getByTestId('settings-open').click()
  await expect(page.locator('.settings-shell')).toHaveCSS('animation-name', /harbor-pop/)
  await page.getByRole('button', { name: '关闭' }).click()
  await expect(page.getByTestId('settings-dialog')).toBeHidden()
})

test('sidebar motion', async ({ page }) => {
  await unlock(page)
  await expect(page.locator('.sidebar')).toHaveCSS('transition-duration', /0\.3s/)
  await page.getByRole('button', { name: '隐藏' }).click()
  await expect(page.locator('.shell')).toHaveClass(/sider-collapsed/)
  await expect(page.locator('.sidebar')).toHaveCSS('opacity', '0')
})

test('action row', async ({ page }) => {
  await unlock(page)
  await send(page, '动作')
  await expect(page.locator('.action-row button')).toHaveCount(5)
  await expect(page.getByTestId('message-list')).not.toContainText('输入')
  await page.screenshot({ path: join(shots, 'actions-light.png') })
  await page.getByTestId('user-menu').click()
  await page.getByTestId('settings-open').click()
  await page.getByRole('button', { name: '深色' }).click()
  await page.getByRole('button', { name: '关闭' }).click()
  await page.screenshot({ path: join(shots, 'actions-dark.png') })
})

test('disclaimer', async ({ page }) => {
  await unlock(page)
  await expect(page.locator('.ai-note')).toHaveCount(0)
  await send(page, '声明')
  await expect(page.locator('.ai-note')).toHaveText('内容由 AI 生成，请仔细甄别')
})

test('official states', async ({ page }) => {
  const dir = join(process.cwd(), '../../docs/parity/tour')
  await unlock(page)
  await page.getByTestId('user-menu').click()
  await page.getByTestId('settings-open').click()
  await page.getByRole('button', { name: '深色' }).click()
  await page.getByRole('button', { name: '关闭' }).click()
  await page.screenshot({ path: join(dir, 'home.png') })
  await page.getByTestId('composer').focus()
  await page.screenshot({ path: join(dir, 'composer-focus.png') })
  await page.keyboard.press('Control+k')
  await page.screenshot({ path: join(dir, 'search-dialog.png') })
  await page.keyboard.press('Escape')
  await page.getByTestId('user-menu').click()
  await page.screenshot({ path: join(dir, 'user-menu.png') })
  await page.getByTestId('settings-open').click()
  await page.screenshot({ path: join(dir, 'settings-general.png') })
  await page.getByTestId('language-trigger').click()
  await page.screenshot({ path: join(dir, 'settings-general-language-dropdown.png') })
  await page.getByTestId('language-trigger').click()
  await page.getByRole('button', { name: '账号管理' }).click()
  await expect(page.getByTestId('nickname')).toBeVisible()
  await page.screenshot({ path: join(dir, 'settings-account.png') })
  await page.getByRole('button', { name: '数据管理' }).click()
  await page.screenshot({ path: join(dir, 'settings-data.png') })
  await page.getByRole('button', { name: '服务协议' }).click()
  await page.screenshot({ path: join(dir, 'settings-agreement.png') })
  await page.getByRole('button', { name: '通用设置' }).click()
  await page.getByRole('button', { name: '浅色' }).click()
  await page.screenshot({ path: join(dir, 'settings-general-light.png') })
  await page.getByRole('button', { name: '关闭' }).click()
  await page.screenshot({ path: join(dir, 'home-light.png') })
  await page.getByTestId('user-menu').click()
  await page.getByTestId('settings-open').click()
  await page.getByRole('button', { name: '深色' }).click()
  await page.getByRole('button', { name: '关闭' }).click()
  mode = 'delay'
  await send(page, '停一下')
  await expect(page.getByTestId('stop')).toBeVisible()
  await page.screenshot({ path: join(dir, 'streaming-stop-button.png') })
  await page.getByTestId('stop').click()
  mode = 'ok'
  richText = true
  await send(page, '排版对照')
  await expect(page.locator('.katex')).toBeVisible()
  await page.getByTestId('message-user').last().hover()
  await page.screenshot({ path: join(dir, 'answer-rich-thinking-expanded-user-bubble.png') })
  await page.getByTestId('thinking-toggle').click()
  await page.screenshot({ path: join(dir, 'answer-rich-thinking-collapsed.png') })
  await page.screenshot({ path: join(dir, 'answer-rich-table-math-code.png') })
  await page.locator('.code-card').filter({ hasText: 'const n' }).getByRole('button').first().hover()
  await page.screenshot({ path: join(dir, 'answer-rich-code-copy-hover.png') })
  await page.locator('.action-row').last().getByRole('button', { name: '复制' }).hover()
  await page.waitForTimeout(200)
  await page.screenshot({ path: join(dir, 'answer-rich-actionrow-copy-tooltip.png') })
  await page.locator('.action-row').last().getByRole('button', { name: '分享' }).hover()
  await page.waitForTimeout(200)
  await page.screenshot({ path: join(dir, 'answer-rich-actionrow-share-tooltip.png') })
  const pitch = await page.locator('.action-row button').evaluateAll((nodes) => {
    const boxes = nodes.slice(0, 2).map((node) => node.getBoundingClientRect())
    return { size: Math.round(boxes[0]?.width ?? 0), pitch: Math.round((boxes[1]?.left ?? 0) - (boxes[0]?.left ?? 0)) }
  })
  expect(pitch.size).toBe(28)
  expect(pitch.pitch).toBe(38)
  await page.getByTestId('user-menu').click()
  await page.getByTestId('settings-open').click()
  await page.getByRole('button', { name: '浅色' }).click()
  await page.getByRole('button', { name: '关闭' }).click()
  await page.screenshot({ path: join(dir, 'answer-rich-light.png') })
  await page.locator('.chat-link').last().hover()
  await page.locator('.chat-link .more').last().click()
  await page.screenshot({ path: join(dir, 'sidebar-item-menu.png') })
})

test('feedback', async ({ page }) => {
  await unlock(page)
  await send(page, '不满意')
  await page.getByRole('button', { name: '不喜欢', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '反馈' })).toBeVisible()
  await expect(page.getByRole('button', { name: '有害/不安全' })).toBeVisible()
  await page.getByRole('button', { name: '取消' }).click()
  await expect(page.getByRole('dialog', { name: '反馈' })).toBeHidden()
})

test('data settings', async ({ page }) => {
  await unlock(page)
  await page.getByTestId('user-menu').click()
  await page.getByTestId('settings-open').click()
  await page.getByRole('button', { name: '数据管理' }).click()
  await expect(page.getByText('导出所有历史对话')).toBeVisible()
  await expect(page.getByText('删除所有对话')).toBeVisible()
  await expect(page.getByText('数据用于优化体验')).toHaveCount(0)
})

test('welcome back', async ({ page }) => {
  await unlock(page)
  await send(page, '回来')
  await page.getByTestId('new-chat').click()
  await page.mouse.move(0, 0)
  await expect(page.locator('.greeting')).toContainText(/欢迎回来，(想从哪里开始？|随时开始吧)|你好，我能帮什么忙吗？/)
  const shortcut = await page.locator('.new-chat').evaluate((node) => {
    const style = getComputedStyle(node, '::after')
    const windows = navigator.userAgent.toLowerCase().includes('windows')
    return { content: style.content, windows }
  })
  expect(shortcut.content).toBe(shortcut.windows ? '"Ctrl + J"' : '"⌘ J"')
  await page.mouse.move(0, 0)
  await expect.poll(() => page.locator('.new-chat').evaluate((node) => getComputedStyle(node, '::after').opacity)).toBe('0')
  await page.getByTestId('new-chat').hover()
  await expect.poll(() => page.locator('.new-chat').evaluate((node) => getComputedStyle(node, '::after').opacity)).toBe('1')
  await expect(page.locator('.new-chat')).toHaveCSS('justify-content', 'center')
  const on = page.getByTestId('toggle-thinking')
  await expect(on).toHaveCSS('background-color', 'rgb(237, 243, 254)')
  await expect(on).toHaveCSS('color', 'rgb(57, 100, 254)')
  await expect(on).toHaveCSS('border-top-width', '1px')
  await expect(on).toHaveCSS('border-top-color', 'rgb(183, 200, 254)')
  await on.click()
  await page.mouse.move(0, 0)
  await expect(on).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(on).toHaveCSS('color', 'rgb(15, 17, 21)')
  await expect(on).toHaveCSS('border-top-width', '1px')
})

test('reduced motion', async ({ page }) => {
  await unlock(page)
  const text = await page.evaluate(() =>
    [...document.styleSheets].flatMap((sheet) => {
      try {
        return [...sheet.cssRules].map((rule) => rule.cssText)
      } catch {
        return []
      }
    }).join('\n'),
  )
  expect(text).toContain('prefers-reduced-motion')
  expect(text).toContain('0.01ms')
})
