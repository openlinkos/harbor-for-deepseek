import { expect, test, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const shots = '/opt/cursor/artifacts'
mkdirSync(shots, { recursive: true })

test.use({
  userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.33 Safari/537.36',
})

const viewports = [
  { name: '1440', width: 1440, height: 900 },
  { name: '390', width: 390, height: 844 },
] as const

type Seed = { title: string; pinned: boolean; daysAgo: number }

const sse = (events: unknown[]) =>
  `${events.map((event) => `event: ${(event as { type: string }).type}\ndata: ${JSON.stringify(event)}\n\n`).join('')}: keep-alive\n\n`

const unlock = async (page: Page) => {
  await page.route('https://api.deepseek.com/**', async (route) => {
    const url = route.request().url()
    if (url.endsWith('/user/balance')) {
      await route.fulfill({ json: { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '1.00', granted_balance: '0', topped_up_balance: '1.00' }] } })
      return
    }
    if (url.endsWith('/models')) {
      await route.fulfill({ json: { data: [{ id: 'deepseek-flash' }] } })
      return
    }
    if (url.includes('/messages')) {
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
        body: sse([
          { type: 'message_start', message: { id: 'req', model: 'deepseek-flash' } },
          { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
          { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '好' } },
          { type: 'content_block_stop', index: 0 },
          { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null, title: '对照' }, usage: { input_tokens: 1, output_tokens: 1 } },
          { type: 'message_stop' },
        ]),
      })
      return
    }
    await route.fulfill({ status: 404, json: { error: { message: 'not mocked' } } })
  })
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()
}

const showSidebar = async (page: Page) => {
  const width = page.viewportSize()?.width ?? 1440
  if (width < 768) {
    await page.getByTestId('menu').click()
    await expect.poll(async () => Math.round((await page.locator('.sidebar').boundingBox())?.x ?? -1)).toBe(0)
  }
  await expect(page.locator('.sidebar')).toBeVisible()
}

const seedGroups = async (page: Page, rows: Seed[]) => {
  await unlock(page)
  await page.evaluate(async (incoming) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('deepapi')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const tx = db.transaction('conversations', 'readwrite')
    const store = tx.objectStore('conversations')
    for (const row of incoming) {
      const when = new Date(Date.now() - row.daysAgo * 86_400_000).toISOString()
      store.put({
        id: crypto.randomUUID(),
        title: row.title,
        titleSource: 'user',
        model: 'deepseek-flash',
        thinking: true,
        search: true,
        readLink: false,
        effort: 'high',
        pinned: row.pinned,
        archived: false,
        activeLeafId: null,
        createdAt: when,
        updatedAt: when,
        rev: 1,
        deletedAt: null,
      })
    }
    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(null)
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  }, rows)
  await page.reload()
  await expect(page.getByTestId('composer')).toBeVisible()
  await showSidebar(page)
}

const shortcutBox = (page: Page) => page.getByTestId('new-chat').evaluate((node) => {
  const after = getComputedStyle(node, '::after')
  const buttonStyle = getComputedStyle(node)
  const rect = node.getBoundingClientRect()
  const borderTop = parseFloat(buttonStyle.borderTopWidth) || 0
  const borderRight = parseFloat(buttonStyle.borderRightWidth) || 0
  const borderBottom = parseFloat(buttonStyle.borderBottomWidth) || 0
  const padHeight = rect.height - borderTop - borderBottom
  const topPx = after.top.endsWith('%') ? (parseFloat(after.top) / 100) * padHeight : parseFloat(after.top)
  const rightPx = parseFloat(after.right)
  const probe = document.createElement('span')
  probe.textContent = after.content.replace(/^["']|["']$/g, '')
  probe.style.cssText = `position:absolute;left:0;top:0;visibility:hidden;white-space:pre;font-size:${after.fontSize};font-weight:${after.fontWeight};font-family:${after.fontFamily};line-height:${after.lineHeight};letter-spacing:${after.letterSpacing};`
  node.appendChild(probe)
  const probeBox = probe.getBoundingClientRect()
  probe.remove()
  let shiftY = 0
  const matrix = after.transform.match(/matrix\(([^)]+)\)/)
  if (matrix) {
    shiftY = Number(matrix[1].split(',')[5]) || 0
  }
  const afterTop = rect.top + borderTop + topPx + shiftY
  const afterRight = rect.right - borderRight - rightPx
  return {
    content: after.content,
    opacity: after.opacity,
    right: after.right,
    gapRight: rect.right - afterRight,
    centerDelta: afterTop + probeBox.height / 2 - (rect.top + rect.height / 2),
  }
})

for (const viewport of viewports) {
  test(`非首组 marginTop 16px、paddingTop 4px @${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await seedGroups(page, [
      { title: '今天的对话', pinned: false, daysAgo: 0 },
      { title: '昨天的对话', pinned: false, daysAgo: 1 },
    ])
    const later = page.locator('.side-scroll .group').nth(1)
    await expect(later).toHaveCSS('margin-top', '16px')
    await expect(later).toHaveCSS('padding-top', '4px')
    await expect(later).not.toHaveClass(/is-first/)
  })

  test(`首组 marginTop 0 @${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await seedGroups(page, [
      { title: '今天的对话', pinned: false, daysAgo: 0 },
      { title: '昨天的对话', pinned: false, daysAgo: 1 },
    ])
    const first = page.locator('.side-scroll .group').first()
    await expect(first).toHaveClass(/is-first/)
    await expect(first).toHaveCSS('margin-top', '0px')
    await expect(first).toContainText('今天')
    if (viewport.name === '1440') {
      await page.screenshot({ path: join(shots, 'sidebar-groups-1440.png'), clip: { x: 0, y: 0, width: 280, height: 640 } })
    }
  })

  test(`置顶组后 1px 分隔线 margin 16px 0 0 10px @${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await seedGroups(page, [
      { title: '置顶对话', pinned: true, daysAgo: 0 },
      { title: '今天的对话', pinned: false, daysAgo: 0 },
    ])
    const pinned = page.locator('.group.pinned')
    await expect(pinned).toHaveCSS('margin-top', '0px')
    await expect(pinned).toHaveCSS('padding-top', '0px')
    const rule = page.getByTestId('pinned-rule')
    await expect(rule).toHaveCount(1)
    await expect(rule).toHaveCSS('height', '1px')
    await expect(rule).toHaveCSS('margin-top', '16px')
    await expect(rule).toHaveCSS('margin-right', '0px')
    await expect(rule).toHaveCSS('margin-bottom', '0px')
    await expect(rule).toHaveCSS('margin-left', '10px')
    const order = await pinned.evaluate((node) => {
      const kids = [...node.children].map((child) => child.className)
      const ruleAt = kids.findIndex((name) => name.includes('group-rule'))
      const linkAt = kids.findIndex((name) => name.includes('chat-link'))
      return { last: kids.at(-1) ?? '', ruleAt, linkAt }
    })
    expect(order.last).toContain('group-rule')
    expect(order.ruleAt).toBeGreaterThan(order.linkAt)
    const link = await pinned.locator('.chat-link').boundingBox()
    const line = await rule.boundingBox()
    expect(line?.height ?? 0).toBeGreaterThan(0)
    expect((line?.y ?? 0)).toBeGreaterThan((link?.y ?? 0) + (link?.height ?? 0) - 1)
    if (viewport.name === '390') {
      await page.screenshot({ path: join(shots, 'sidebar-groups-390.png') })
    } else {
      const lineBox = await rule.boundingBox()
      if (lineBox) {
        await page.screenshot({
          path: join(shots, 'sidebar-pinned-rule-1440.png'),
          clip: { x: 0, y: Math.max(0, lineBox.y - 80), width: 280, height: 180 },
        })
      }
    }
  })

  test(`悬停新对话按钮时 ⌘J 距右边 11px 且垂直居中 @${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await unlock(page)
    await showSidebar(page)
    await page.mouse.move(0, 0)
    const hidden = await shortcutBox(page)
    expect(hidden.content).toBe('"⌘ J"')
    expect(hidden.opacity).toBe('0')
    await page.getByTestId('new-chat').hover()
    await expect.poll(async () => (await shortcutBox(page)).opacity).toBe('1')
    const shown = await shortcutBox(page)
    expect(shown.right).toBe('11px')
    expect(shown.gapRight).toBeGreaterThanOrEqual(10)
    expect(shown.gapRight).toBeLessThanOrEqual(12)
    expect(Math.abs(shown.centerDelta)).toBeLessThanOrEqual(1)
    const button = await page.getByTestId('new-chat').boundingBox()
    if (button) {
      await page.screenshot({
        path: join(shots, `new-chat-shortcut-${viewport.name}.png`),
        clip: {
          x: Math.max(0, button.x - 8),
          y: Math.max(0, button.y - 12),
          width: Math.min(viewport.width - button.x + 8, button.width + 16),
          height: button.height + 28,
        },
      })
    }
    await page.mouse.move(0, 0)
    await expect.poll(async () => (await shortcutBox(page)).opacity).toBe('0')
  })

  test(`分组标题字号颜色行高对照官方 @${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await seedGroups(page, [
      { title: '置顶对话', pinned: true, daysAgo: 0 },
      { title: '今天的对话', pinned: false, daysAgo: 0 },
    ])
    const labels = page.locator('.group-label')
    await expect(labels).toHaveCount(2)
    for (const label of await labels.all()) {
      await expect(label).toHaveCSS('font-size', '12px')
      await expect(label).toHaveCSS('line-height', '18px')
      await expect(label).toHaveCSS('color', 'rgb(129, 133, 140)')
      await expect(label).toHaveCSS('font-weight', '500')
    }
  })
}
