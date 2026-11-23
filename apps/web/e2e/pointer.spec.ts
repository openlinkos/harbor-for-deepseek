import { expect, test, type Locator, type Page, type Route } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const shots = '/opt/cursor/artifacts/pointer'
mkdirSync(shots, { recursive: true })

const sse = (title: string, text: string) => {
  const events = [
    { type: 'message_start', message: { id: 'req', model: 'deepseek-flash' } },
    { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'ok' } },
    { type: 'content_block_stop', index: 0 },
    { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text } },
    { type: 'content_block_stop', index: 1 },
    { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null, title }, usage: { input_tokens: 10, output_tokens: 4, output_tokens_details: { thinking_tokens: 1 } } },
    { type: 'message_stop' },
  ]
  return events.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join('')
}

const install = async (page: Page) => {
  await page.route('https://api.deepseek.com/**', async (route: Route) => {
    const url = route.request().url()
    if (url.endsWith('/user/balance')) {
      await route.fulfill({ json: { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '1', granted_balance: '0', topped_up_balance: '1' }] } })
      return
    }
    if (url.endsWith('/models')) {
      await route.fulfill({ json: { data: [{ id: 'deepseek-flash' }] } })
      return
    }
    if (!url.includes('/messages')) {
      await route.fulfill({ status: 404, json: {} })
      return
    }
    const raw = route.request().postData() ?? ''
    const title = raw.includes('乙') ? '会话乙' : '会话甲'
    await route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse(title, '好') })
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

type CursorPart = { name: string; cursor: string }

const readCursors = async (locator: Locator) => locator.evaluate((node) => {
  const described = (el: Element) => {
    const className = typeof (el as HTMLElement).className === 'string' ? (el as HTMLElement).className : ''
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24)
    return `${el.tagName}${className ? `.${className}` : ''}${text ? `:${text}` : ''}`
  }
  const visible = (el: Element) => {
    const style = getComputedStyle(el)
    const rect = el.getBoundingClientRect()
    return style.display !== 'none' && style.visibility !== 'hidden' && !(el as HTMLElement).hidden && rect.width > 0 && rect.height > 0
  }
  const cursorOf = (el: Element) => getComputedStyle(el).cursor
  const parts: CursorPart[] = [node, ...node.querySelectorAll('span, svg')]
    .filter(visible)
    .map((el) => ({ name: described(el), cursor: cursorOf(el) }))
  const box = node.getBoundingClientRect()
  const hit = document.elementFromPoint(box.left + Math.min(28, box.width / 2), box.top + box.height / 2)
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
    acceptNode(text) {
      return text.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    },
  })
  const text = walker.nextNode()
  let textCursor: CursorPart | null = null
  if (text) {
    const range = document.createRange()
    range.selectNodeContents(text)
    const rect = range.getBoundingClientRect()
    const textHit = rect.width > 0 ? document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2) : text.parentElement
    if (textHit) textCursor = { name: `text:${text.textContent?.trim().slice(0, 24)} via ${described(textHit)}`, cursor: cursorOf(textHit) }
  }
  const svg = node.querySelector('svg')
  let svgCursor: CursorPart | null = null
  if (svg && visible(svg)) {
    const rect = svg.getBoundingClientRect()
    const svgHit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
    svgCursor = { name: `svg via ${svgHit ? described(svgHit) : 'missing'}`, cursor: svgHit ? cursorOf(svgHit) : cursorOf(svg) }
  }
  return {
    parts,
    hit: hit ? { name: described(hit), cursor: cursorOf(hit) } : null,
    textCursor,
    svgCursor,
  }
})

const expectPointer = async (locator: Locator, label: string) => {
  await locator.scrollIntoViewIfNeeded()
  await expect(locator, label).toBeVisible()
  const report = await readCursors(locator)
  expect(report.parts.length, `${label} has no painted parts`).toBeGreaterThan(0)
  for (const part of report.parts) expect(part.cursor, `${label} ${part.name}`).toBe('pointer')
  expect(report.hit?.cursor, `${label} hit ${report.hit?.name}`).toBe('pointer')
  if (report.textCursor) expect(report.textCursor.cursor, `${label} ${report.textCursor.name}`).toBe('pointer')
  if (report.svgCursor) expect(report.svgCursor.cursor, `${label} ${report.svgCursor.name}`).toBe('pointer')
  return report
}

test('clicking blank space on a sidebar row opens that chat', async ({ page }) => {
  await unlock(page)
  await page.getByTestId('composer').fill('甲的问题')
  await page.getByTestId('send').click()
  await expect(page.getByTestId('assistant-text')).toContainText('好')
  await page.getByTestId('new-chat').click()
  await expect(page.locator('.greeting')).toBeVisible()
  const row = page.locator('a.chat-link', { hasText: '会话甲' })
  await expect(row).not.toHaveClass(/active/)
  const blank = await row.evaluate((node) => {
    const rowBox = node.getBoundingClientRect()
    const title = node.querySelector('.chat-row > button:not(.more)')
    const titleBox = title?.getBoundingClientRect()
    const gap = titleBox ? titleBox.right + 12 : rowBox.left + 4
    const x = Math.min(gap, rowBox.right - 40) - rowBox.left
    return { x, y: rowBox.height / 2, titleRight: titleBox ? titleBox.right - rowBox.left : 0 }
  })
  expect(blank.x).toBeGreaterThan(blank.titleRight)
  await row.click({ position: { x: blank.x, y: blank.y } })
  await expect(row).toHaveClass(/active/)
  await expect(page.getByTestId('message-user')).toContainText('甲的问题')
  await expect(page.locator('.greeting')).toHaveCount(0)
  await page.screenshot({ path: join(shots, 'row-blank-opens-chat.png') })

  await page.getByTestId('new-chat').click()
  await expect(page.locator('.greeting')).toBeVisible()
  await row.getByRole('button', { name: '会话甲' }).click()
  await expect(page.getByTestId('message-user')).toContainText('甲的问题')

  await page.getByTestId('new-chat').click()
  await expect(page.locator('.greeting')).toBeVisible()
  await row.hover()
  await row.locator('.more').click()
  await expect(page.getByRole('menuitem', { name: '重命名' })).toBeVisible()
  await expect(page.locator('.greeting')).toBeVisible()
  await expect(row).not.toHaveClass(/active/)
})

test('new chat label and icon use a pointer', async ({ page }) => {
  await unlock(page)
  const button = page.getByTestId('new-chat')
  const report = await expectPointer(button, '开启新对话')
  expect(report.parts.some((part) => part.name.includes('开启新对话'))).toBe(true)
  expect(report.svgCursor, '开启新对话 icon').not.toBeNull()
  await button.screenshot({ path: join(shots, 'new-chat-pointer.png') })
})

test('thinking and search chips use a pointer on the label and icon', async ({ page }) => {
  await unlock(page)
  const thinking = page.getByTestId('toggle-thinking')
  const search = page.getByTestId('toggle-search')
  const thinkingReport = await expectPointer(thinking, '深度思考')
  const searchReport = await expectPointer(search, '智能搜索')
  expect(thinkingReport.textCursor?.name).toContain('深度思考')
  expect(searchReport.textCursor?.name).toContain('智能搜索')
  expect(thinkingReport.svgCursor).not.toBeNull()
  expect(searchReport.svgCursor).not.toBeNull()
  await page.locator('.composer').screenshot({ path: join(shots, 'chips-pointer.png') })
})

test('sidebar search and collapse icons use a pointer', async ({ page }) => {
  await unlock(page)
  const search = page.locator('.sider-icons').getByRole('button', { name: '搜索' })
  const collapse = page.locator('.sider-icons').getByRole('button', { name: '收起边栏' })
  const searchReport = await expectPointer(search, '侧栏搜索')
  const collapseReport = await expectPointer(collapse, '侧栏收起')
  expect(searchReport.svgCursor).not.toBeNull()
  expect(collapseReport.svgCursor).not.toBeNull()
  await page.locator('.sider-top').screenshot({ path: join(shots, 'sider-icons-pointer.png') })
})

test('settings theme cards and general dropdown triggers use a pointer', async ({ page }) => {
  await unlock(page)
  await page.getByTestId('user-menu').click()
  await page.getByTestId('settings-open').click()
  const dialog = page.getByTestId('settings-dialog')
  await expect(dialog).toBeVisible()
  for (const name of ['浅色', '深色', '跟随系统']) {
    const card = dialog.locator('.theme-cards').getByRole('button', { name })
    const report = await expectPointer(card, `主题 ${name}`)
    expect(report.textCursor?.name).toContain(name)
    expect(report.svgCursor).not.toBeNull()
  }
  for (const testId of ['language-trigger', 'safety-select']) {
    const trigger = dialog.getByTestId(testId)
    const report = await expectPointer(trigger, testId)
    expect(report.svgCursor, testId).not.toBeNull()
    expect(report.textCursor, testId).not.toBeNull()
  }
  await expect(dialog.getByTestId('model-select')).toHaveCount(0)
  await expect(dialog.getByTestId('effort-select')).toHaveCount(0)
  await expect(dialog.getByTestId('voice-select')).toHaveCount(0)
  await expect(dialog.getByTestId('purpose-select')).toHaveCount(0)
  await expect(dialog).not.toContainText('朗读音色')
  await expect(dialog).not.toContainText('思考强度')
  await expect(dialog).not.toContainText('PDF / Office 解析')
  await expect(dialog.getByTestId('file-expiry')).toHaveCount(0)
  await expect(dialog).not.toContainText('上传文件过期')
  await dialog.locator('.settings-main').evaluate((node) => { node.scrollTop = 0 })
  await dialog.locator('.theme-cards').screenshot({ path: join(shots, 'theme-cards.png') })
  await dialog.locator('.settings-shell').screenshot({ path: join(shots, 'settings-theme-dropdowns.png') })
})

test('empty composer disables send; text makes it a pointer', async ({ page }) => {
  await unlock(page)
  const send = page.getByTestId('send')
  await expect(send).toBeDisabled()
  const empty = await readCursors(send)
  for (const part of empty.parts) expect(part.cursor, `empty ${part.name}`).not.toBe('pointer')
  expect(empty.hit?.cursor).not.toBe('pointer')
  expect(empty.svgCursor?.cursor).toBe('not-allowed')
  expect(empty.parts.every((part) => part.cursor === 'not-allowed')).toBe(true)
  await page.locator('.composer').screenshot({ path: join(shots, 'send-empty.png') })

  await page.getByTestId('composer').fill('   ')
  await expect(send).toBeDisabled()
  await page.getByTestId('composer').fill('你好')
  await expect(send).toBeEnabled()
  await expect(send).toHaveClass(/ready/)
  const ready = await expectPointer(send, '发送')
  expect(ready.svgCursor).not.toBeNull()
  await page.locator('.composer').screenshot({ path: join(shots, 'send-ready.png') })
  await page.getByTestId('composer').fill('')
  await expect(send).toBeDisabled()
})
