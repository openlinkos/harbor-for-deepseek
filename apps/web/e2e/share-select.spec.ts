// Share selection mode, measured from the 2026-11-20 official captures (1280×800 light, English UI).
// h1_01 / h6_01 are 1920×1200 and scale 1.5× against the 1280 set, so CSS pixels come from the 1280 files.
// Button colors follow the existing ds-button tokens and swap with the theme.
// Ink + elementFromPoint follow e2e/theme-cards.spec.ts (there is no overlay-paint.spec.ts in this repo).
import { expect, test, type Page, type Route } from '@playwright/test'
import { inflateSync } from 'node:zlib'

const sse = (events: unknown[]) => events.map((event) => `event: ${(event as { type: string }).type}\ndata: ${JSON.stringify(event)}\n\n`).join('')
const reply = [
  { type: 'message_start', message: { id: 'req-share', model: 'deepseek-flash' } },
  { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '不会用到' } },
  { type: 'content_block_stop', index: 0 },
  { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { input_tokens: 1, output_tokens: 1 } },
  { type: 'message_stop' },
]

// Screenshot pixels (1280-wide captures). Listed uncertainties are in the PR.
const OFF = {
  check: 12,
  checkRadius: '3px',
  blockRadius: '12px',
  barHeight: 44,
  buttonHeight: '24px',
  buttonRadius: '4096px',
  dialogWidth: 272,
  dialogRadius: '16px',
  dialogButtonHeight: '28px',
  disabledOpacity: '0.45',
  light: {
    checkBg: 'rgb(255, 255, 255)',
    checkBorder: 'rgba(0, 0, 0, 0.1)',
    checkOn: 'rgb(57, 100, 254)',
    block: 'rgb(245, 246, 247)',
    barBg: 'rgb(255, 255, 255)',
    barBorder: 'rgb(245, 245, 245)',
    primary: 'rgb(57, 100, 254)',
    outline: 'rgba(0, 0, 0, 0.1)',
    dialogBg: 'rgb(255, 255, 255)',
  },
  dark: {
    checkBg: 'rgb(21, 21, 23)',
    checkBorder: 'rgba(255, 255, 255, 0.12)',
    checkOn: 'rgb(86, 134, 254)',
    block: 'rgb(44, 44, 46)',
    barBg: 'rgb(21, 21, 23)',
    barBorder: 'rgba(255, 255, 255, 0.12)',
    primary: 'rgb(86, 134, 254)',
    outline: 'rgba(255, 255, 255, 0.12)',
    dialogBg: 'rgb(44, 44, 46)',
  },
}

const install = async (page: Page) => {
  await page.route('https://api.deepseek.com/**', async (route: Route) => {
    const url = route.request().url()
    if (url.endsWith('/user/balance')) return route.fulfill({ json: { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '1', granted_balance: '0', topped_up_balance: '1' }] } })
    if (url.endsWith('/models')) return route.fulfill({ json: { data: [{ id: 'deepseek-flash' }] } })
    if (!url.includes('/messages')) return route.fulfill({ status: 404, json: {} })
    return route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse(reply) })
  })
}

const seed = async (page: Page) => {
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((ok, ko) => {
      const request = indexedDB.open('deepapi')
      request.onsuccess = () => ok(request.result)
      request.onerror = () => ko(request.error)
    })
    const tx = db.transaction(['conversations', 'messages'], 'readwrite')
    const id = 'share-sample'
    const when = new Date().toISOString()
    const message = (mid: string, parentId: string | null, role: 'user' | 'assistant', text: string, createdAt: string) => ({
      id: mid, conversationId: id, parentId, role, blocks: [{ type: 'text', text }], status: 'complete', usage: null, errorMessage: null, createdAt, updatedAt: createdAt, rev: 1, deletedAt: null,
    })
    tx.objectStore('conversations').put({
      id, title: '分享样本', titleSource: 'user', model: 'deepseek-flash', thinking: false, search: false, readLink: false, effort: 'high', pinned: false, archived: false, activeLeafId: 'a2', createdAt: when, updatedAt: when, rev: 1, deletedAt: null,
    })
    tx.objectStore('messages').put(message('u1', null, 'user', '第一问', '2026-11-20T00:00:00.000Z'))
    tx.objectStore('messages').put(message('a1', 'u1', 'assistant', '第一答', '2026-11-20T00:00:01.000Z'))
    tx.objectStore('messages').put(message('u2', 'a1', 'user', '第二问', '2026-11-20T00:00:02.000Z'))
    tx.objectStore('messages').put(message('a2', 'u2', 'assistant', '第二答', '2026-11-20T00:00:03.000Z'))
    await new Promise((ok, ko) => { tx.oncomplete = () => ok(null); tx.onerror = () => ko(tx.error) })
    db.close()
  })
  await page.reload()
  await expect(page.getByTestId('composer')).toBeVisible()
  const narrow = (page.viewportSize()?.width ?? 1440) < 768
  if (narrow) {
    await page.getByTestId('menu').click()
    await page.waitForTimeout(400)
  }
  await page.locator('.chat-link', { hasText: '分享样本' }).click()
  await expect(page.getByText('第二答')).toBeVisible()
  await expect(page.locator('.chat-title')).toHaveText('分享样本')
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' })
}

const boot = async (page: Page, theme: string) => {
  await install(page)
  await page.addInitScript((value) => localStorage.setItem('deepapi-theme', value), theme)
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()
  await seed(page)
}

const paeth = (left: number, up: number, upLeft: number) => {
  const estimate = left + up - upLeft
  const leftDistance = Math.abs(estimate - left)
  const upDistance = Math.abs(estimate - up)
  const diagonal = Math.abs(estimate - upLeft)
  if (leftDistance <= upDistance && leftDistance <= diagonal) return left
  if (upDistance <= diagonal) return up
  return upLeft
}

const decodePng = (png: Buffer) => {
  if (png.toString('ascii', 1, 4) !== 'PNG') throw new Error('screenshot is not a png')
  const width = png.readUInt32BE(16)
  const height = png.readUInt32BE(20)
  const channels = png[25] === 6 ? 4 : png[25] === 2 ? 3 : 0
  if (png[24] !== 8 || channels === 0) throw new Error(`unsupported png ${png[24]}/${png[25]}`)
  const parts: Buffer[] = []
  let offset = 8
  while (offset < png.length) {
    const length = png.readUInt32BE(offset)
    const type = png.toString('ascii', offset + 4, offset + 8)
    if (type === 'IDAT') parts.push(png.subarray(offset + 8, offset + 8 + length))
    if (type === 'IEND') break
    offset += 12 + length
  }
  const inflated = inflateSync(Buffer.concat(parts))
  const stride = width * channels
  const raw = Buffer.alloc(height * stride)
  let source = 0
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[source]
    source += 1
    const row = y * stride
    for (let x = 0; x < stride; x += 1) {
      const byte = inflated[source]
      source += 1
      const left = x >= channels ? raw[row + x - channels] : 0
      const up = y > 0 ? raw[row - stride + x] : 0
      const upLeft = y > 0 && x >= channels ? raw[row - stride + x - channels] : 0
      let value = byte
      if (filter === 1) value = (byte + left) & 255
      else if (filter === 2) value = (byte + up) & 255
      else if (filter === 3) value = (byte + Math.floor((left + up) / 2)) & 255
      else if (filter === 4) value = (byte + paeth(left, up, upLeft)) & 255
      else if (filter !== 0) throw new Error(`png filter ${filter}`)
      raw[row + x] = value
    }
  }
  const data = Buffer.alloc(width * height * 4)
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const input = pixel * channels
    const output = pixel * 4
    data[output] = raw[input]
    data[output + 1] = raw[input + 1]
    data[output + 2] = raw[input + 2]
    data[output + 3] = channels === 4 ? raw[input + 3] : 255
  }
  return { width, height, data }
}

const inkRatio = (png: Buffer) => {
  const { width, height, data } = decodePng(png)
  const inset = Math.max(1, Math.round(Math.min(width, height) * 0.08))
  const corners = [[inset, inset], [width - 1 - inset, inset], [inset, height - 1 - inset], [width - 1 - inset, height - 1 - inset]]
  const background = corners
    .map(([x, y]) => {
      const index = (y * width + x) * 4
      return [data[index], data[index + 1], data[index + 2]]
    })
    .reduce((sum, pixel) => [sum[0] + pixel[0], sum[1] + pixel[1], sum[2] + pixel[2]], [0, 0, 0])
    .map((channel) => channel / corners.length)
  let ink = 0
  for (let index = 0; index < data.length; index += 4) {
    const distance = Math.abs(data[index] - background[0]) + Math.abs(data[index + 1] - background[1]) + Math.abs(data[index + 2] - background[2])
    if (distance > 36) ink += 1
  }
  return ink / (width * height)
}

const cssOf = (page: Page, selector: string) => page.locator(selector).first().evaluate((node) => {
  const style = getComputedStyle(node)
  const box = node.getBoundingClientRect()
  const mark = getComputedStyle(node, '::after')
  return {
    w: box.width,
    h: box.height,
    bg: style.backgroundColor,
    color: style.color,
    radius: style.borderRadius,
    borderTopWidth: style.borderTopWidth,
    borderTopStyle: style.borderTopStyle,
    borderTopColor: style.borderTopColor,
    opacity: style.opacity,
    mark: mark.borderBottomColor,
  }
})

for (const theme of ['light', 'dark'] as const) for (const [w, h] of [[1440, 900], [390, 844]] as const) {
  const tone = OFF[theme]
  test.describe(`share select ${theme} ${w}`, () => {
    test.use({ viewport: { width: w, height: h }, colorScheme: theme, bypassCSP: true })
    test('selection, count, dialog, and measured chrome', async ({ page }) => {
      test.setTimeout(90_000)
      await boot(page, theme)
      await page.locator('.action-row button[aria-label="分享"]').last().click()

      const boxes = page.locator('input.share-box')
      await expect(boxes).toHaveCount(4)
      await expect(boxes.nth(0)).not.toBeChecked()
      await expect(boxes.nth(1)).not.toBeChecked()
      await expect(boxes.nth(2)).toBeChecked()
      await expect(boxes.nth(3)).toBeChecked()
      await expect(page.getByTestId('share-count')).toHaveText('已选择 1 组对话')
      await expect(page.getByTestId('share-all')).not.toBeChecked()
      await expect(page.locator('.chat-title')).toHaveText('分享样本')
      await expect(page.getByRole('heading', { name: '选择对话' })).toHaveCount(0)
      await expect(page.locator('.share-block.on')).toHaveCount(2)
      await expect(page.getByTestId('composer')).toBeHidden()

      await boxes.nth(0).click()
      for (let index = 0; index < 4; index += 1) await expect(boxes.nth(index)).toBeChecked()
      await expect(page.getByTestId('share-count')).toHaveText('已选择 2 组对话')
      await expect(page.getByTestId('share-all')).toBeChecked()
      await expect(page.locator('.share-block.on')).toHaveCount(4)

      await page.getByTestId('share-all').click()
      for (let index = 0; index < 4; index += 1) await expect(boxes.nth(index)).not.toBeChecked()
      await expect(page.getByTestId('share-count')).toHaveText('已选择 0 组对话')
      await expect(page.getByTestId('share-all')).not.toBeChecked()
      await expect(page.getByTestId('share-create')).toBeDisabled()

      await page.getByTestId('share-all').click()
      await expect(page.getByTestId('share-count')).toHaveText('已选择 2 组对话')
      await expect(page.getByTestId('share-create')).toBeEnabled()
      await boxes.nth(0).click()
      await expect(page.getByTestId('share-count')).toHaveText('已选择 1 组对话')
      await expect(page.getByTestId('share-all')).not.toBeChecked()

      const bar = await cssOf(page, '.share-bar')
      expect(bar.h).toBeGreaterThanOrEqual(OFF.barHeight - 0.5)
      expect(bar.h).toBeLessThanOrEqual(OFF.barHeight + 0.5)
      expect(bar.bg).toBe(tone.barBg)
      expect(bar.borderTopWidth).toBe('1px')
      expect(bar.borderTopStyle).toBe('solid')
      expect(bar.borderTopColor).toBe(tone.barBorder)
      const barBox = (await page.locator('.share-bar').boundingBox())!
      expect(Math.abs(barBox.y + barBox.height - h)).toBeLessThanOrEqual(1)

      const idle = await cssOf(page, 'input.share-box:not(:checked)')
      expect(Math.abs(idle.w - OFF.check)).toBeLessThanOrEqual(0.5)
      expect(Math.abs(idle.h - OFF.check)).toBeLessThanOrEqual(0.5)
      expect(idle.radius).toBe(OFF.checkRadius)
      expect(idle.bg).toBe(tone.checkBg)
      expect(idle.borderTopColor).toBe(tone.checkBorder)
      expect(idle.borderTopWidth).toBe('1px')
      const on = await cssOf(page, 'input.share-box:checked')
      expect(on.bg).toBe(tone.checkOn)
      expect(on.mark).toBe('rgb(255, 255, 255)')
      const block = await cssOf(page, '.share-block.on')
      expect(block.bg).toBe(tone.block)
      expect(block.radius).toBe(OFF.blockRadius)

      const create = page.getByTestId('share-create')
      const cancel = page.getByTestId('share-cancel')
      await expect(create).toHaveClass(/ds-button--primary/)
      await expect(cancel).toHaveClass(/ds-button--outlined/)
      const createBox = await create.evaluate((node) => {
        const style = getComputedStyle(node)
        const fill = node.querySelector('.ds-button__background')
        return {
          h: node.getBoundingClientRect().height,
          radius: style.borderRadius,
          color: style.color,
          fill: fill ? getComputedStyle(fill).backgroundColor : '',
        }
      })
      expect(createBox.h).toBeCloseTo(24, 0)
      expect(createBox.radius).toBe(OFF.buttonRadius)
      expect(createBox.color).toBe('rgb(255, 255, 255)')
      expect(createBox.fill).toBe(tone.primary)
      const cancelBox = await cancel.evaluate((node) => {
        const style = getComputedStyle(node)
        const border = node.querySelector('.ds-button__border')
        return {
          h: node.getBoundingClientRect().height,
          radius: style.borderRadius,
          border: border ? getComputedStyle(border).borderTopColor : '',
        }
      })
      expect(cancelBox.h).toBeCloseTo(24, 0)
      expect(cancelBox.radius).toBe(OFF.buttonRadius)
      expect(cancelBox.border).toBe(tone.outline)

      await page.getByTestId('share-all').click()
      await expect(page.getByTestId('share-count')).toHaveText('已选择 2 组对话')
      await page.getByTestId('share-all').click()
      await expect(page.getByTestId('share-create')).toBeDisabled()
      const faded = await page.getByTestId('share-create').evaluate((node) => getComputedStyle(node).opacity)
      expect(faded).toBe(OFF.disabledOpacity)
      const fadedFill = await page.getByTestId('share-create').locator('.ds-button__background').evaluate((node) => getComputedStyle(node).backgroundColor)
      expect(fadedFill).toBe(tone.primary)

      await page.getByTestId('share-cancel').click()
      await expect(page.locator('.share-bar')).toHaveCount(0)
      await expect(page.locator('input.share-box')).toHaveCount(0)
      await expect(page.getByTestId('composer')).toBeVisible()
      await expect(page.locator('.chat-title')).toHaveText('分享样本')

      await page.locator('.topbar button[aria-label="share"]').click()
      await expect(page.getByTestId('share-count')).toHaveText('已选择 1 组对话')
      await page.getByTestId('share-create').click()
      const dialog = page.getByTestId('share-soon')
      await expect(dialog).toBeVisible()
      await expect(dialog.getByRole('heading')).toBeVisible()
      await expect(page.getByTestId('share-soon-ok')).toHaveText('知道了')
      const hit = await dialog.evaluate((node) => {
        const card = node.querySelector('.share-soon-card') ?? node
        const box = card.getBoundingClientRect()
        const probe = (x: number, y: number) => {
          const target = document.elementFromPoint(x, y)
          return target instanceof Node && node.contains(target)
        }
        return {
          w: box.width,
          radius: getComputedStyle(card).borderRadius,
          bg: getComputedStyle(card).backgroundColor,
          center: probe(box.left + box.width / 2, box.top + box.height / 2),
          title: (() => {
            const title = card.querySelector('h2')
            if (!title) return false
            const titleBox = title.getBoundingClientRect()
            return probe(titleBox.left + titleBox.width / 2, titleBox.top + titleBox.height / 2)
          })(),
        }
      })
      expect(Math.abs(hit.w - OFF.dialogWidth)).toBeLessThanOrEqual(1)
      expect(hit.radius).toBe(OFF.dialogRadius)
      expect(hit.bg).toBe(tone.dialogBg)
      expect(hit.center, 'dialog center must be the top element').toBe(true)
      expect(hit.title, 'dialog title must be the top element').toBe(true)
      const buttonHit = await page.getByTestId('share-soon-ok').evaluate((node) => {
        const box = node.getBoundingClientRect()
        const target = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
        const style = getComputedStyle(node)
        const fill = node.querySelector('.ds-button__background')
        return {
          inside: target instanceof Node && node.contains(target),
          h: box.height,
          w: box.width,
          cardW: node.parentElement?.getBoundingClientRect().width ?? 0,
          fill: fill ? getComputedStyle(fill).backgroundColor : '',
          color: style.color,
          radius: style.borderRadius,
        }
      })
      expect(buttonHit.inside, 'dialog button must be the top element').toBe(true)
      expect(buttonHit.h).toBeCloseTo(28, 0)
      expect(buttonHit.radius).toBe(OFF.buttonRadius)
      expect(buttonHit.fill).toBe(tone.primary)
      expect(buttonHit.color).toBe('rgb(255, 255, 255)')
      expect(buttonHit.cardW - buttonHit.w).toBeGreaterThan(24)
      expect(buttonHit.cardW - buttonHit.w).toBeLessThan(40)
      const ink = inkRatio(await dialog.locator('.share-soon-card').screenshot())
      expect(ink, `dialog ink ${ink}`).toBeGreaterThan(0.08)

      await page.getByTestId('share-soon-ok').click()
      await expect(dialog).toHaveCount(0)
      await expect(page.locator('.share-bar')).toHaveCount(0)
      await expect(page.locator('input.share-box')).toHaveCount(0)

      await page.locator('.action-row button[aria-label="分享"]').last().click()
      await page.getByTestId('share-create').click()
      await expect(page.getByTestId('share-soon')).toBeVisible()
      await page.getByTestId('share-soon-x').click()
      await expect(page.getByTestId('share-soon')).toHaveCount(0)
      await expect(page.locator('.share-bar')).toHaveCount(0)

      await page.locator('.topbar button[aria-label="share"]').click()
      await expect(page.locator('.share-bar')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.locator('.share-bar')).toHaveCount(0)
    })
  })
}
