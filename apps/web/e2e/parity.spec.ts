import { expect, test, type Page, type Route } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

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
  await page.getByTestId('key-ack').check()
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
      const request = indexedDB.open('harbor')
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
  await expect(page.locator('.turn.user')).toHaveCSS('justify-content', 'flex-end')
})

test('stream and stop', async ({ page }) => {
  await unlock(page)
  mode = 'delay'
  await send(page, '慢一点')
  await expect(page.getByTestId('stop')).toBeVisible()
  await page.getByTestId('stop').click()
  await expect(page.getByText('已停止')).toBeVisible()
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
  await expect(row.getByRole('button', { name: '朗读' })).toBeVisible()
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
  await expect(page.locator('.cite')).toContainText('1')
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
  const spacing = await prose.locator('.box-drawing code').evaluate((node) => getComputedStyle(node).letterSpacing)
  expect(['normal', '0px']).toContain(spacing)
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
  await page.locator('.chat-link .more').click()
  await page.getByRole('button', { name: '重命名' }).click()
  await page.getByLabel('对话标题').fill('新名字')
  await page.getByLabel('对话标题').press('Enter')
  await expect(page.getByTestId('sidebar')).toContainText('新名字')
  await page.locator('.chat-link .more').click()
  await page.getByRole('button', { name: '置顶' }).click()
  await expect(page.getByTestId('sidebar')).toContainText('置顶')
  await page.getByRole('button', { name: '多选' }).click()
  await page.getByRole('checkbox', { name: '新名字' }).check()
  page.once('dialog', (dialog) => void dialog.accept())
  await expect(page.getByText('已选择 1 个对话')).toBeVisible()
  await page.locator('.select-bar').getByRole('button', { name: '删除' }).click()
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
  await page.getByRole('button', { name: '数据管理' }).click()
  await expect(page.getByTestId('balance')).toBeVisible()
  await page.getByRole('button', { name: '服务协议' }).click()
  await expect(page.getByTestId('site-footer')).toContainText('OpenLinkOS')
  await page.getByRole('button', { name: '通用设置' }).click()
  await page.getByLabel('语言').selectOption('en')
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByTestId('composer')).toHaveAttribute('placeholder', 'Message DeepSeek')
})

test('key gate', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '对话留在本机' })).toBeVisible()
  await expect(page.getByTestId('site-footer')).toContainText('商标')
  await page.screenshot({ path: join(shots, 'gate-light.png') })
})

test('local mode', async ({ page }) => {
  await unlock(page)
  await expect(page.getByTestId('sidebar')).toContainText('本地模式')
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
  await page.getByTestId('thinking').getByRole('button').click()
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
  await expect(page.locator('.action-row button')).toHaveCount(6)
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
  const dir = join(process.cwd(), '../../docs/parity/ours')
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
  await page.getByLabel('语言').click()
  await page.screenshot({ path: join(dir, 'settings-general-language-dropdown.png') })
  await page.getByTestId('voice-select').click()
  await page.screenshot({ path: join(dir, 'settings-general-voice-dropdown.png') })
  await page.getByRole('button', { name: '账号管理' }).click()
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
  await page.getByTestId('thinking').getByRole('button').click()
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
  await expect(page.getByText('数据用于优化体验')).toBeVisible()
})

test('welcome back', async ({ page }) => {
  await unlock(page)
  await send(page, '回来')
  await page.getByTestId('new-chat').click()
  await expect(page.locator('.greeting')).toContainText('欢迎回来，想从哪里开始？')
  await expect(page.locator('.kbd')).toContainText('Ctrl J')
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
