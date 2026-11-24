// Share selection mode. The 1280×800 captures are a 1920×1200 DPR1 frame scaled to 2/3,
// so CSS pixels are those ink sizes × 1.5, then the frozen official tokens where they exist
// (ds-checkbox--l 18/6/1.5 border-l3, bar 65 + border-l2, ds-button m 36, modal radius 24
// and padding 22/24, ds-button xl 44). Dialog width 408 is the scaled card; no modal token is 408.
// Ink + elementFromPoint follow e2e/overlay-paint.spec.ts.
import { expect, test, type Locator, type Page, type Route } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inflateSync } from 'node:zlib'

const SSE = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'lib/fb1344-sse.js'), 'utf8')

const sse = (events: unknown[]) => events.map((event) => `event: ${(event as { type: string }).type}\ndata: ${JSON.stringify(event)}\n\n`).join('')
const reply = [
  { type: 'message_start', message: { id: 'req-share', model: 'deepseek-flash' } },
  { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '不会用到' } },
  { type: 'content_block_stop', index: 0 },
  { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { input_tokens: 1, output_tokens: 1 } },
  { type: 'message_stop' },
]

// Official CSS pixels. Colors are the computed tokens (border-l3, brand fill, border-l2, inverted label).
const OFF = {
  check: 18,
  checkRadius: '6px',
  checkBorderWidth: '1.5px',
  blockPad: 15,
  barHeight: 65,
  buttonHeight: 36,
  buttonRadius: '4096px',
  dialogWidth: 408,
  dialogRadius: '24px',
  dialogButtonHeight: 44,
  disabledOpacity: '0.45',
  light: {
    checkBg: 'rgba(0, 0, 0, 0)',
    checkBorder: 'rgba(0, 0, 0, 0.12)',
    checkOn: 'rgb(86, 134, 254)',
    checkMark: 'rgb(255, 255, 255)',
    block: 'rgb(245, 246, 247)',
    barBg: 'rgb(255, 255, 255)',
    barBorder: 'rgba(0, 0, 0, 0.1)',
    primary: 'rgb(57, 100, 254)',
    outline: 'rgba(0, 0, 0, 0.1)',
    dialogBg: 'rgb(255, 255, 255)',
  },
  dark: {
    checkBg: 'rgba(0, 0, 0, 0)',
    checkBorder: 'rgba(255, 255, 255, 0.16)',
    checkOn: 'rgb(86, 134, 254)',
    checkMark: 'rgb(53, 54, 56)',
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

const seed = async (page: Page, firstUser = '请联网搜索混元\n大模型人事变动\n用中文分条回答\n每条用「人名」\n与「职位」加粗', firstAnswer = '第一答') => {
  await page.evaluate(async ({ firstUser, firstAnswer }) => {
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
    tx.objectStore('messages').put(message('u1', null, 'user', firstUser, '2026-11-20T00:00:00.000Z'))
    tx.objectStore('messages').put(message('a1', 'u1', 'assistant', firstAnswer, '2026-11-20T00:00:01.000Z'))
    tx.objectStore('messages').put(message('u2', 'a1', 'user', '第二问', '2026-11-20T00:00:02.000Z'))
    tx.objectStore('messages').put(message('a2', 'u2', 'assistant', '第二答', '2026-11-20T00:00:03.000Z'))
    const other = 'share-other'
    tx.objectStore('conversations').put({
      id: other, title: '另一会话', titleSource: 'user', model: 'deepseek-flash', thinking: false, search: false, readLink: false, effort: 'high', pinned: false, archived: false, activeLeafId: 'ou1', createdAt: when, updatedAt: when, rev: 1, deletedAt: null,
    })
    tx.objectStore('messages').put({ id: 'ou1', conversationId: other, parentId: null, role: 'user', blocks: [{ type: 'text', text: '旁边的问题' }], status: 'complete', usage: null, errorMessage: null, createdAt: when, updatedAt: when, rev: 1, deletedAt: null })
    await new Promise((ok, ko) => { tx.oncomplete = () => ok(null); tx.onerror = () => ko(tx.error) })
    db.close()
  }, { firstUser, firstAnswer })
  await page.reload()
  await expect(page.getByTestId('composer')).toBeVisible()
  const width = page.viewportSize()?.width ?? 1440
  if (width < 768) {
    await page.getByTestId('menu').click()
    await page.waitForTimeout(400)
  } else if (width < 1024) {
    // SP-SB-631. The in-flow sider starts collapsed from 768 through 1023.
    await page.getByRole('button', { name: '打开边栏' }).click()
  }
  await page.locator('.chat-link', { hasText: '分享样本' }).click()
  await expect(page.getByText('第二答')).toBeVisible()
  await expect(page.locator('.chat-title')).toHaveText('分享样本')
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' })
}

const boot = async (page: Page, theme: string, staged = false, firstUser?: string, firstAnswer?: string) => {
  await install(page)
  if (staged) await page.addInitScript(SSE)
  await page.addInitScript((value) => localStorage.setItem('deepapi-theme', value), theme)
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()
  await seed(page, firstUser, firstAnswer)
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

const renderedBorderPx = (png: Buffer) => {
  const { width, height, data } = decodePng(png)
  const y = Math.floor(height / 2)
  const at = (x: number) => {
    const index = (y * width + x) * 4
    return [data[index], data[index + 1], data[index + 2]]
  }
  const background = at(Math.min(width - 1, Math.max(0, Math.floor(width / 2))))
  const distance = (color: number[]) => Math.abs(color[0] - background[0]) + Math.abs(color[1] - background[1]) + Math.abs(color[2] - background[2])
  let x = 0
  while (x < width / 2 && distance(at(x)) < 12) x += 1
  if (x >= width / 2) return 0
  const full = distance(at(x))
  let coverage = 0
  for (; x < Math.floor(width / 2); x += 1) {
    const amount = distance(at(x)) / full
    if (amount < 0.15) break
    coverage += Math.min(1, amount)
  }
  return coverage
}

const firstLine = (root: Locator) => root.evaluate((node) => {
  const host = node.querySelector('.prose') ?? node.querySelector('.bubble') ?? node
  const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT)
  let current: Node | null = walker.nextNode()
  while (current) {
    const value = current.textContent ?? ''
    const index = value.search(/\S/)
    if (index >= 0) {
      const range = document.createRange()
      range.setStart(current, index)
      range.setEnd(current, value.length)
      const rect = range.getClientRects()[0]
      if (rect && rect.width >= 1) return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    }
    current = walker.nextNode()
  }
  return null
})

const near = (actual: number, expected: number, name: string, tolerance = 1) => {
  expect(Math.abs(actual - expected), `${name} ${actual} vs ${expected} ±${tolerance}`).toBeLessThanOrEqual(tolerance)
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
      const boxOf = async (selector: string) => (await page.locator(selector).first().boundingBox())!
      const columnBefore = await boxOf('.chat-column')
      const proseBefore = await boxOf('.turn.assistant .prose')
      const bubbleBefore = await boxOf('.turn.user .bubble')
      await page.locator('.action-row button[aria-label="分享"]').last().click()
      const columnAfter = await boxOf('.chat-column')
      const proseAfter = await boxOf('.turn.assistant .prose')
      const bubbleAfter = await boxOf('.turn.user .bubble')
      expect(Math.abs(columnAfter.x - columnBefore.x), 'column x').toBeLessThanOrEqual(1)
      expect(Math.abs(columnAfter.width - columnBefore.width), 'column width').toBeLessThanOrEqual(1)
      if (w >= 768) {
        expect(Math.abs(proseAfter.x - proseBefore.x), 'prose x').toBeLessThanOrEqual(1)
        expect(Math.abs(proseAfter.width - proseBefore.width), 'prose width').toBeLessThanOrEqual(1)
        expect(Math.abs(bubbleAfter.x - bubbleBefore.x), 'bubble x').toBeLessThanOrEqual(1)
        expect(Math.abs(bubbleAfter.width - bubbleBefore.width), 'bubble width').toBeLessThanOrEqual(1)
      } else if (w === 390) {
        near(proseBefore.x, 20, 'answer text stays at the column before selection')
        near(proseAfter.x, 62, 'answer text area left')
        near(proseAfter.width, 308, 'answer text area width')
        near(proseAfter.x + proseAfter.width, 370, 'answer text area right')
        near(bubbleAfter.height, bubbleBefore.height, 'question bubble height follows its text')
        near(bubbleAfter.x + bubbleAfter.width, 354, 'question bubble right')
      }
      await expect(page.locator('.action-row:visible')).toHaveCount(0)
      await expect(page.locator('.user-actions:visible')).toHaveCount(0)
      await expect(page.locator('article.turn.assistant > .prose')).toHaveCount(2)

      const boxes = page.locator('input.share-box:visible')
      await expect(boxes).toHaveCount(4)
      await expect(boxes.nth(0)).not.toBeChecked()
      await expect(boxes.nth(1)).not.toBeChecked()
      await expect(boxes.nth(2)).toBeChecked()
      await expect(boxes.nth(3)).toBeChecked()
      await expect(page.getByTestId('share-all')).not.toBeChecked()
      if (w >= 800) {
        await expect(page.getByTestId('share-count')).toHaveText('已选择 1 组对话')
        await expect(page.locator('.chat-title')).toHaveText('分享样本')
      } else {
        if (w < 640) await expect(page.getByTestId('share-count')).toBeHidden()
        else await expect(page.getByTestId('share-count')).toBeVisible()
        await expect(page.getByTestId('share-cancel')).toBeHidden()
        await expect(page.getByTestId('share-top-cancel')).toBeVisible()
        await expect(page.locator('.chat-title')).toHaveText('选择对话')
        if (w === 390) {
          near(columnAfter.x, 20, 'message column left')
          near(columnAfter.width, 350, 'message column width')
          near(columnAfter.x + columnAfter.width, 370, 'message column right')
        }
      }
      await expect(page.getByRole('heading', { name: '选择对话' })).toHaveCount(0)
      await expect(page.locator('.share-halo:visible')).toHaveCount(2)
      await expect(page.getByTestId('composer')).toBeHidden()

      const userTurn = page.locator('.turn.user').nth(1)
      const answerTurn = page.locator('.turn.assistant').nth(1)
      const text = await firstLine(answerTurn)
      expect(text, 'answer has a first line').not.toBeNull()
      const allBox = (await page.getByTestId('share-all').boundingBox())!
      const overlaps = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) =>
        a.x < b.x + b.width - 0.5 && a.x + a.width > b.x + 0.5 && a.y < b.y + b.height - 0.5 && a.y + a.height > b.y + 0.5
      const fits = (rect: { x: number; y: number; width: number; height: number }, name: string) => {
        expect(rect.x, `${name} left`).toBeGreaterThanOrEqual(0)
        expect(rect.x + rect.width, `${name} right`).toBeLessThanOrEqual(w)
        expect(rect.y, `${name} top`).toBeGreaterThanOrEqual(0)
        expect(rect.y + rect.height, `${name} bottom`).toBeLessThanOrEqual(h)
      }
      fits(allBox, 'select-all')
      for (const turn of [page.locator('.turn.user').first(), page.locator('.turn.assistant').first(), userTurn, answerTurn]) {
        const rect = (await turn.locator('.share-box').boundingBox())!
        fits(rect, 'message checkbox')
        if (w >= 768) {
          expect(Math.abs(rect.x - (text!.x - 41)), 'checkbox is 41px left of the body text').toBeLessThanOrEqual(1)
          expect(Math.abs(rect.x - allBox.x), 'select-all shares the checkbox column').toBeLessThanOrEqual(1)
        } else {
          expect(Math.abs(rect.x - 20), 'checkbox x').toBeLessThanOrEqual(1)
          expect(Math.abs(rect.width - 18), 'checkbox width').toBeLessThanOrEqual(0.5)
          expect(Math.abs(rect.height - 18), 'checkbox height').toBeLessThanOrEqual(0.5)
        }
      }
      if (w < 768) near(allBox.x, 36, 'select-all x')
      if (w === 390) {
        near(allBox.y, 802.5, 'select-all y')
        const label = (await page.locator('.share-all span').boundingBox())!
        near(label.x, 66, 'select-all label left')
        const firstQuestion = (await page.locator('.turn.user').first().locator('.share-box').boundingBox())!
        const firstAnswer = (await page.locator('.turn.assistant').first().locator('.share-box').boundingBox())!
        near(firstQuestion.y, 76.5, 'question checkbox y')
        near(firstAnswer.y, bubbleAfter.y + bubbleAfter.height + 76, 'answer checkbox follows the question bubble')
        const boxStyle = await page.locator('input.share-box').first().evaluate((node) => {
          const style = getComputedStyle(node)
          return { margin: style.margin, padding: style.padding }
        })
        expect(boxStyle.margin, 'checkbox margin').toBe('0px')
        expect(boxStyle.padding, 'checkbox padding').toBe('0px')
      }
      const userGrey = (await userTurn.locator('.share-halo').boundingBox())!
      const answerGrey = (await answerTurn.locator('.share-halo').boundingBox())!
      expect(Math.abs(userGrey.x - answerGrey.x), 'question and answer grey left edges').toBeLessThanOrEqual(1)
      expect(Math.abs(userGrey.x + userGrey.width - (answerGrey.x + answerGrey.width)), 'question and answer grey right edges').toBeLessThanOrEqual(1)
      const userCheck = (await userTurn.locator('.share-box').boundingBox())!
      const answerCheck = (await answerTurn.locator('.share-box').boundingBox())!
      const contained = (inner: { x: number; y: number; width: number; height: number }, outer: { x: number; y: number; width: number; height: number }) =>
        inner.x >= outer.x - 0.5 && inner.y >= outer.y - 0.5 && inner.x + inner.width <= outer.x + outer.width + 0.5 && inner.y + inner.height <= outer.y + outer.height + 0.5
      if (w >= 768) {
        expect(overlaps(userCheck, userGrey), 'user checkbox stays outside its grey block').toBe(false)
        expect(overlaps(answerCheck, answerGrey), 'answer checkbox stays outside its grey block').toBe(false)
      } else {
        expect(Math.abs(userGrey.x - 0), 'selected fill left').toBeLessThanOrEqual(1)
        expect(Math.abs(userGrey.x + userGrey.width - 371), 'selected fill right').toBeLessThanOrEqual(1)
        expect(Math.abs(answerGrey.x - 0), 'answer fill left').toBeLessThanOrEqual(1)
        expect(Math.abs(answerGrey.x + answerGrey.width - 371), 'answer fill right').toBeLessThanOrEqual(1)
        expect(contained(userCheck, userGrey), 'user checkbox sits inside the selected fill').toBe(true)
        expect(contained(answerCheck, answerGrey), 'answer checkbox sits inside the selected fill').toBe(true)
      }
      expect(Math.abs(answerGrey.y - (userGrey.y + userGrey.height) - 12), 'grey blocks in one pair are 12px apart').toBeLessThanOrEqual(1)
      expect(answerCheck.y - answerGrey.y, 'answer checkbox from grey top').toBeGreaterThanOrEqual(32)
      expect(answerCheck.y - answerGrey.y, 'answer checkbox from grey top').toBeLessThanOrEqual(35)
      expect(Math.abs((answerCheck.y + answerCheck.height / 2) - (text!.y + text!.height / 2)), 'answer checkbox aligns with the first line').toBeLessThanOrEqual(2)
      expect(Math.abs(userCheck.y - userGrey.y - 3), 'user checkbox is about 3px from the grey top').toBeLessThanOrEqual(1)
      if (w === 390) {
        near(text!.x, 62, 'answer first line left')
        expect(overlaps(answerCheck, text!), 'checkbox must not cover the answer first line').toBe(false)
      }
      const createRect = (await page.getByTestId('share-create').boundingBox())!
      if (w >= 768) expect(Math.abs(createRect.x + createRect.width - (answerGrey.x + answerGrey.width)), 'create button right edge').toBeLessThanOrEqual(1)
      else if (w === 390) {
        near(createRect.x + createRect.width, 370, 'create button right')
        near(createRect.height, 36, 'create button height')
        near(createRect.y, 793.5, 'create button top')
        near(createRect.y + createRect.height, 829.5, 'create button bottom')
      }
      for (const id of (w >= 768 ? ['share-cancel', 'share-create'] : ['share-create']) as ('share-cancel' | 'share-create')[]) {
        const rect = (await page.getByTestId(id).boundingBox())!
        expect(rect.x, `${id} left`).toBeGreaterThanOrEqual(-0.5)
        expect(rect.x + rect.width, `${id} right`).toBeLessThanOrEqual(w + 0.5)
        const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('button')?.getAttribute('data-testid') ?? '', { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 })
        expect(hit, `${id} center`).toBe(id)
      }

      await page.locator('.turn').first().click()
      for (let index = 0; index < 4; index += 1) await expect(boxes.nth(index)).toBeChecked()
      if (w >= 768) await expect(page.getByTestId('share-count')).toHaveText('已选择 2 组对话')
      await expect(page.getByTestId('share-all')).toBeChecked()
      await expect(page.locator('.share-halo:visible')).toHaveCount(4)
      for (const index of [0, 1]) {
        const question = (await page.locator('.turn.user').nth(index).locator('.share-halo').boundingBox())!
        const answer = (await page.locator('.turn.assistant').nth(index).locator('.share-halo').boundingBox())!
        expect(Math.abs(question.x - answer.x), `pair ${index} grey left`).toBeLessThanOrEqual(1)
        expect(Math.abs(question.x + question.width - (answer.x + answer.width)), `pair ${index} grey right`).toBeLessThanOrEqual(1)
      }

      await page.getByTestId('share-all').click()
      for (let index = 0; index < 4; index += 1) await expect(boxes.nth(index)).not.toBeChecked()
      if (w >= 768) await expect(page.getByTestId('share-count')).toHaveText('已选择 0 组对话')
      await expect(page.getByTestId('share-all')).not.toBeChecked()
      await expect(page.getByTestId('share-create')).toBeDisabled()

      await page.getByTestId('share-all').click()
      if (w >= 768) await expect(page.getByTestId('share-count')).toHaveText('已选择 2 组对话')
      await expect(page.getByTestId('share-create')).toBeEnabled()
      await page.locator('.turn').first().click()
      await expect(page.getByTestId('share-count')).toHaveText('已选择 1 组对话')
      await expect(page.getByTestId('share-all')).not.toBeChecked()

      const bar = await cssOf(page, '.share-bar')
      expect(Math.abs(bar.h - OFF.barHeight)).toBeLessThanOrEqual(0.5)
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
      const dpr = await page.evaluate(() => window.devicePixelRatio)
      const borderNode = page.locator('input.share-box:not(:checked)').first()
      const borderShot = await borderNode.screenshot()
      const renderedBorder = renderedBorderPx(borderShot) / dpr
      expect(Math.abs(renderedBorder - 1.5), `rendered checkbox border ${renderedBorder}`).toBeLessThanOrEqual(0.4)
      const on = await cssOf(page, 'input.share-box:checked')
      expect(on.bg).toBe(tone.checkOn)
      expect(on.mark).toBe(tone.checkMark)
      const block = await page.locator('.share-halo:visible').first().evaluate((node) => {
        const style = getComputedStyle(node)
        return { bg: style.backgroundColor, radius: style.borderTopLeftRadius }
      })
      expect(block.bg).toBe(w < 768 && theme === 'light' ? 'rgb(236, 242, 249)' : tone.block)
      expect(block.radius).toBe('18px')

      const create = page.getByTestId('share-create')
      const cancel = page.getByTestId('share-cancel')
      await expect(create).toHaveClass(/ds-button--primary/)
      if (w >= 768) await expect(cancel).toHaveClass(/ds-button--outlined/)
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
      expect(createBox.h).toBeCloseTo(OFF.buttonHeight, 0)
      expect(createBox.radius).toBe(OFF.buttonRadius)
      expect(createBox.color).toBe('rgb(255, 255, 255)')
      expect(createBox.fill).toBe(tone.primary)
      if (w === 390) {
        const topCancel = page.getByTestId('share-top-cancel')
        await expect(topCancel).toHaveClass(/ds-button--outlined/)
        const topBox = (await topCancel.boundingBox())!
        near(topBox.x, 300, 'cancel left')
        near(topBox.x + topBox.width, 374, 'cancel right')
        near(topBox.width, 73.9, 'cancel width')
        near(topBox.height, 36, 'cancel height')
        near(topBox.y, 13, 'cancel y')
        const titleBox = (await page.getByTestId('share-title').boundingBox())!
        near(titleBox.x, 16, 'selection title left')
        near((titleBox.y + titleBox.height / 2) - (topBox.y + topBox.height / 2), 0, 'cancel and title share a midline')
        const headerButtons = await page.locator('header.topbar button').evaluateAll((nodes) => nodes.filter((node) => {
          const style = getComputedStyle(node)
          const box = node.getBoundingClientRect()
          return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0
        }).map((node) => node.getAttribute('data-testid')))
        expect(headerButtons, 'selection top bar has only the cancel button').toEqual(['share-top-cancel'])
        const border = await topCancel.evaluate((node) => {
          const edge = node.querySelector('.ds-button__border')
          return edge ? getComputedStyle(edge).borderTopWidth + ' ' + getComputedStyle(edge).borderTopStyle : 'none'
        })
        expect(border, 'cancel is an outlined button').toBe('1px solid')
      }
      if (w >= 768) {
      const cancelBox = await cancel.evaluate((node) => {
        const style = getComputedStyle(node)
        const border = node.querySelector('.ds-button__border')
        return {
          h: node.getBoundingClientRect().height,
          radius: style.borderRadius,
          border: border ? getComputedStyle(border).borderTopColor : '',
        }
      })
      expect(cancelBox.h).toBeCloseTo(OFF.buttonHeight, 0)
      expect(cancelBox.radius).toBe(OFF.buttonRadius)
      expect(cancelBox.border).toBe(tone.outline)
      }

      await page.getByTestId('share-all').click()
      if (w >= 768) await expect(page.getByTestId('share-count')).toHaveText('已选择 2 组对话')
      await page.getByTestId('share-all').click()
      await expect(page.getByTestId('share-create')).toBeDisabled()
      const faded = await page.getByTestId('share-create').evaluate((node) => getComputedStyle(node).opacity)
      expect(faded).toBe(OFF.disabledOpacity)
      const fadedFill = await page.getByTestId('share-create').locator('.ds-button__background').evaluate((node) => getComputedStyle(node).backgroundColor)
      expect(fadedFill).toBe(tone.primary)

      await (w >= 800 ? page.getByTestId('share-cancel') : page.getByTestId('share-top-cancel')).click()
      await expect(page.locator('.share-bar')).toHaveCount(0)
      await expect(page.locator('input.share-box:visible')).toHaveCount(0)
      await expect(page.getByTestId('composer')).toBeVisible()
      await expect(page.locator('.chat-title')).toHaveText('分享样本')

      await page.locator('.topbar button[aria-label="分享"]').click()
      for (let index = 0; index < 4; index += 1) await expect(boxes.nth(index)).toBeChecked()
      await expect(page.getByTestId('share-all')).toBeChecked()
      if (w >= 768) await expect(page.getByTestId('share-count')).toHaveText('已选择 2 组对话')
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
      if (w >= 768) expect(Math.abs(hit.w - OFF.dialogWidth)).toBeLessThanOrEqual(1)
      else expect(hit.w).toBeLessThanOrEqual(w - 16)
      expect(hit.radius).toBe(OFF.dialogRadius)
      expect(hit.bg).toBe(tone.dialogBg)
      const dialogPad = await dialog.locator('.share-soon-card').evaluate((node) => {
        const style = getComputedStyle(node)
        return [style.paddingTop, style.paddingBottom]
      })
      expect(dialogPad).toEqual(['22px', '22px'])
      expect(hit.center, 'dialog center must be the top element').toBe(true)
      expect(hit.title, 'dialog title must be the top element').toBe(true)
      await page.mouse.move(0, 0)
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
      expect(buttonHit.h).toBeCloseTo(OFF.dialogButtonHeight, 0)
      expect(buttonHit.radius).toBe(OFF.buttonRadius)
      expect(buttonHit.fill).toBe(tone.primary)
      expect(buttonHit.color).toBe('rgb(255, 255, 255)')
      expect(buttonHit.cardW - buttonHit.w).toBeGreaterThan(44)
      expect(buttonHit.cardW - buttonHit.w).toBeLessThan(52)
      const ink = inkRatio(await dialog.locator('.share-soon-card').screenshot())
      expect(ink, `dialog ink ${ink}`).toBeGreaterThan(0.08)

      await page.getByTestId('share-soon-ok').click()
      await expect(dialog).toHaveCount(0)
      await expect(page.locator('.share-bar')).toHaveCount(0)
      await expect(page.locator('input.share-box:visible')).toHaveCount(0)

      await page.locator('.action-row button[aria-label="分享"]').last().click()
      await page.getByTestId('share-create').click()
      await expect(page.getByTestId('share-soon')).toBeVisible()
      await page.getByTestId('share-soon-x').click()
      await expect(page.getByTestId('share-soon')).toHaveCount(0)
      await expect(page.locator('.share-bar')).toHaveCount(0)

      await page.locator('.topbar button[aria-label="分享"]').click()
      await expect(page.locator('.share-bar')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.locator('.share-bar')).toBeVisible()
      await page.getByTestId(w < 800 ? 'share-top-cancel' : 'share-cancel').click()
      await expect(page.locator('.share-bar')).toHaveCount(0)

      await page.locator('.action-row button[aria-label="分享"]').first().click()
      await expect(boxes.nth(0)).toBeChecked()
      await expect(boxes.nth(1)).toBeChecked()
      await expect(boxes.nth(2)).not.toBeChecked()
      await expect(boxes.nth(3)).not.toBeChecked()
      await expect(page.getByTestId('share-all')).not.toBeChecked()
      console.log(`SHARE_METRICS ${JSON.stringify({ theme, w, check: idle.w, bar: bar.h, button: createBox.h, dialogButton: buttonHit.h, dialog: hit.w })}`)
    })

    test('entering and leaving selection keeps thought time and collapsed state', async ({ page }) => {
      test.setTimeout(90_000)
      await boot(page, theme, true)
      await page.getByTestId('composer').fill('思考一下')
      await page.getByTestId('send').click()
      await page.waitForFunction(() => (window as unknown as { __sse: { count: () => number } }).__sse.count() > 0)
      const thinking = [
        { type: 'message_start', message: { id: 'thought', model: 'deepseek-flash' } },
        { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: '先想一步。' } },
      ]
      await page.evaluate((events) => (window as unknown as { __sse: { push: (value: unknown[]) => void } }).__sse.push(events), thinking)
      const toggle = page.getByTestId('thinking-toggle').last()
      await expect(toggle).toBeVisible()
      await page.waitForTimeout(2200)
      const done = [
        { type: 'content_block_stop', index: 0 },
        { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
        { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: '想完了。' } },
        { type: 'content_block_stop', index: 1 },
        { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { input_tokens: 1, output_tokens: 1 } },
        { type: 'message_stop' },
      ]
      await page.evaluate((events) => {
        const sse = (window as unknown as { __sse: { push: (value: unknown[]) => void; end: () => void } }).__sse
        sse.push(events)
        sse.end()
      }, done)
      await expect(page.getByTestId('assistant-text').last()).toContainText('想完了')
      const label = async () => (await toggle.innerText()).replace(/\s+/g, '')
      const before = await label()
      expect(before).toMatch(/用时[2-9]/)
      await toggle.click()
      await expect(toggle).toHaveAttribute('aria-expanded', 'false')
      await page.locator('.action-row button[aria-label="分享"]').last().click()
      await expect(page.locator('.share-bar')).toBeVisible()
      await expect(toggle).toHaveAttribute('aria-expanded', 'false')
      expect(await label()).toBe(before)
      await expect(page.locator('article.turn.assistant > .prose').last()).toBeVisible()
      await ((page.viewportSize()?.width ?? 1440) >= 800 ? page.getByTestId('share-cancel') : page.getByTestId('share-top-cancel')).click()
      await expect(page.locator('.share-bar')).toHaveCount(0)
      await expect(toggle).toHaveAttribute('aria-expanded', 'false')
      expect(await label()).toBe(before)
    })

    test('opening another chat leaves selection mode', async ({ page }) => {
      await boot(page, theme)
      await page.locator('.action-row button[aria-label="分享"]').last().click()
      await expect(page.locator('.share-bar')).toBeVisible()
      if (w < 800) await expect(page.getByTestId('menu')).toBeHidden()
      if (w < 768) {
        await page.getByTestId('share-top-cancel').click()
        await page.getByTestId('menu').click()
        await page.waitForTimeout(400)
      }
      await page.locator('.chat-link', { hasText: '另一会话' }).click()
      await expect(page.getByText('旁边的问题')).toBeVisible()
      await expect(page.locator('.share-bar')).toHaveCount(0)
      await expect(page.getByText('已选择 0 组对话')).toHaveCount(0)
    })

    test('a long selected answer keeps its checkbox pinned in the viewport', async ({ page }) => {
      test.setTimeout(90_000)
      const lines = Array.from({ length: 48 }, (_, index) => `长回答第 ${index + 1} 行，滚动后中段留在列表里。`).join('\n')
      await boot(page, theme, false, '请展开说明', lines)
      await page.locator('.turn.assistant').first().locator('button[aria-label="分享"]').click()
      await expect(page.locator('.share-bar')).toBeVisible()
      const box = page.locator('.turn.assistant').first().locator('.share-box')
      await expect(box).toBeChecked()
      const host = page.locator('.transcript')
      const scrolled = await host.evaluate((node) => {
        const answer = node.querySelector('.turn.assistant')
        if (!(answer instanceof HTMLElement)) return 0
        node.scrollTop = Math.max(0, answer.offsetTop + answer.offsetHeight / 2 - node.clientHeight / 2)
        return node.scrollTop
      })
      expect(scrolled, 'the long answer actually scrolls').toBeGreaterThan(200)
      const stuck = await box.boundingBox()
      const transcript = await host.boundingBox()
      const prose = await page.locator('.turn.assistant').first().locator('.prose').boundingBox()
      expect(stuck, 'checkbox stays rendered').not.toBeNull()
      expect(transcript, 'transcript box').not.toBeNull()
      expect(prose, 'answer box').not.toBeNull()
      const middle = prose!.y + prose!.height / 2
      expect(middle, 'answer middle is inside the transcript').toBeGreaterThan(transcript!.y)
      expect(middle, 'answer middle is inside the transcript').toBeLessThan(transcript!.y + transcript!.height)
      expect(stuck!.y, 'checkbox stays below the transcript top').toBeGreaterThanOrEqual(transcript!.y - 20)
      expect(stuck!.y + stuck!.height, 'checkbox stays inside the viewport').toBeLessThanOrEqual(h)
      expect(stuck!.y, 'checkbox stays inside the viewport').toBeGreaterThanOrEqual(0)
      expect(Math.abs(stuck!.y - middle), 'checkbox does not travel with the answer middle').toBeGreaterThan(80)
      const pin = await page.locator('.turn.assistant').first().locator('.share-sticky').evaluate((node) => {
        const style = getComputedStyle(node)
        return { position: style.position, top: style.top }
      })
      expect(pin.position).toBe('sticky')
      expect(pin.top).toBe('0px')
    })
  })
}

// Official bundle: selection top bar when width < 800, selected-count hidden when width < 640.
// 639/641 split the count breakpoint. 799/801 split the top-bar breakpoint. 767 sits in neither gap.
for (const theme of ['light', 'dark'] as const) for (const w of [600, 639, 641, 660, 700, 780, 799, 801, 820] as const) {
  test.describe(`share breakpoints ${theme} ${w}`, () => {
    test.use({ viewport: { width: w, height: 844 }, colorScheme: theme, bypassCSP: true })
    test('top bar and selected count follow the official widths', async ({ page }) => {
      test.setTimeout(90_000)
      await boot(page, theme)
      await page.locator('.action-row button[aria-label="分享"]').last().click()
      await expect(page.locator('.share-bar')).toBeVisible()
      const narrowTop = w < 800
      if (narrowTop) {
        await expect(page.getByTestId('share-top-cancel')).toBeVisible()
        await expect(page.getByTestId('share-cancel')).toBeHidden()
        await expect(page.locator('.chat-title')).toHaveText('选择对话')
        await expect(page.getByTestId('menu')).toBeHidden()
      } else {
        await expect(page.getByTestId('share-top-cancel')).toHaveCount(0)
        await expect(page.getByTestId('share-cancel')).toBeVisible()
        await expect(page.locator('.chat-title')).toHaveText('分享样本')
      }
      if (w < 640) await expect(page.getByTestId('share-count')).toBeHidden()
      else await expect(page.getByTestId('share-count')).toBeVisible()
    })
  })
}

// Width and height of a question come from its text. These fail while selection mode
// forces the official sample's 152px bubble, 208px bubble, 164.3px button, or 60px label.
for (const theme of ['light', 'dark'] as const) {
  test.describe(`share natural size ${theme}`, () => {
    test.use({ viewport: { width: 390, height: 844 }, colorScheme: theme, bypassCSP: true })
    test('one-line question keeps its bubble height in selection mode', async ({ page }) => {
      test.setTimeout(90_000)
      await boot(page, theme, false, '你好')
      const before = (await page.locator('.turn.user .bubble').first().boundingBox())!
      await page.locator('.action-row button[aria-label="分享"]').last().click()
      await expect(page.locator('.share-bar')).toBeVisible()
      const after = (await page.locator('.turn.user .bubble').first().boundingBox())!
      near(after.height, before.height, 'one-line bubble height')
    })
    test('short question bubble shrink-wraps and stays right-aligned', async ({ page }) => {
      test.setTimeout(90_000)
      await boot(page, theme)
      await page.locator('.action-row button[aria-label="分享"]').last().click()
      await expect(page.locator('.share-bar')).toBeVisible()
      const bubble = (await page.locator('.turn.user', { hasText: '第二问' }).locator('.bubble').boundingBox())!
      expect(bubble.width, `short bubble width ${bubble.width}`).toBeLessThan(208)
      near(bubble.x + bubble.width, 354, 'short bubble right')
    })
    test('create button and select-all label use natural width', async ({ page }) => {
      test.setTimeout(90_000)
      await boot(page, theme)
      await page.locator('.action-row button[aria-label="分享"]').last().click()
      await expect(page.locator('.share-bar')).toBeVisible()
      const create = page.getByTestId('share-create')
      const specified = await create.evaluate((node) => {
        const read = (el: Element, prop: string) => {
          const walk = (rules: CSSRule[]): string => {
            let value = ''
            for (const rule of rules) {
              if (rule instanceof CSSMediaRule) {
                if (window.matchMedia(rule.media.mediaText).matches) value = walk([...rule.cssRules]) || value
              } else if (rule instanceof CSSStyleRule && rule.selectorText) {
                let matches = false
                try { matches = el.matches(rule.selectorText) } catch { matches = false }
                if (matches) {
                  const next = rule.style.getPropertyValue(prop)
                  if (next) value = next
                }
              }
            }
            return value
          }
          let value = ''
          for (const sheet of [...document.styleSheets]) {
            let rules: CSSRule[]
            try { rules = [...sheet.cssRules] } catch { continue }
            const next = walk(rules)
            if (next) value = next
          }
          return value || 'auto'
        }
        const style = getComputedStyle(node)
        const content = node.querySelector('.ds-button__content')!.getBoundingClientRect().width
        const pad = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
        return { width: read(node, 'width'), box: node.getBoundingClientRect().width, content, pad }
      })
      expect(specified.width, 'create button width').toBe('auto')
      near(specified.pad, 28, 'create button horizontal padding')
      near(specified.box, specified.content + specified.pad, 'create button width is content plus padding')
      const label = await page.locator('.share-all span').evaluate((node) => {
        const walk = (el: Element, prop: string) => {
          const read = (rules: CSSRule[]): string => {
            let value = ''
            for (const rule of rules) {
              if (rule instanceof CSSMediaRule) {
                if (window.matchMedia(rule.media.mediaText).matches) value = read([...rule.cssRules]) || value
              } else if (rule instanceof CSSStyleRule && rule.selectorText) {
                let matches = false
                try { matches = el.matches(rule.selectorText) } catch { matches = false }
                if (matches) {
                  const next = rule.style.getPropertyValue(prop)
                  if (next) value = next
                }
              }
            }
            return value
          }
          let value = ''
          for (const sheet of [...document.styleSheets]) {
            let rules: CSSRule[]
            try { rules = [...sheet.cssRules] } catch { continue }
            const next = read(rules)
            if (next) value = next
          }
          return value || 'auto'
        }
        const range = document.createRange()
        range.selectNodeContents(node)
        return {
          width: walk(node, 'width'),
          minWidth: walk(node, 'min-width'),
          box: node.getBoundingClientRect().width,
          text: range.getBoundingClientRect().width,
        }
      })
      expect(label.width, 'select-all label width').toBe('auto')
      expect(label.minWidth, 'select-all label min-width').toBe('auto')
      near(label.box, label.text, 'select-all label matches its text')
    })
  })
}

// SP-SHARE-033 / 102–105 / 149. The checkbox column lives in the message wrapper, so a click
// on the checkbox itself toggles that turn. Round-4 sharegeo: once the box is pinned in the
// middle of a long answer it sits about 50px under the title top (official), not ~56px.
const LONG_ANSWER = Array.from({ length: 40 }, (_, index) => `第${index + 1}段，这是一段用于测试粘性复选框的较长回答文本。`).join('\n\n')

for (const [w, h] of [[1440, 900], [390, 844]] as const) {
  test.describe(`share checkbox hit ${w}`, () => {
    test.use({ viewport: { width: w, height: h }, colorScheme: 'light', bypassCSP: true })
    test('clicking the checkbox itself toggles the question and the answer', async ({ page }) => {
      test.setTimeout(90_000)
      await boot(page, 'light')
      await page.locator('.action-row button[aria-label="分享"]').last().click()
      await expect(page.locator('input.share-box:visible')).toHaveCount(4)
      for (const role of ['user', 'assistant'] as const) {
        const box = page.locator(`.turn.${role}`).first().locator('input.share-box')
        const before = await box.isChecked()
        const rect = (await box.boundingBox())!
        const point = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
        const hit = await page.evaluate(({ x, y }) => {
          const el = document.elementFromPoint(x, y)
          const article = el?.closest('article.turn')?.getBoundingClientRect()
          return {
            cls: typeof el?.className === 'string' ? el.className : '',
            inside: Boolean(article && x >= article.left - 0.5 && x <= article.right + 0.5 && y >= article.top - 0.5 && y <= article.bottom + 0.5),
          }
        }, point)
        expect(hit.cls, `${role} checkbox receives the click at ${w}`).toContain('share-box')
        expect(hit.inside, `${role} checkbox is inside the message box at ${w}`).toBe(true)
        await page.mouse.click(point.x, point.y)
        expect(await box.isChecked(), `${role} toggles at ${w}`).toBe(!before)
      }
    })

    test('a pinned checkbox sits about 50px under the title', async ({ page }) => {
      test.setTimeout(90_000)
      await boot(page, 'light', false, '第一问', LONG_ANSWER)
      await page.locator('.action-row button[aria-label="分享"]').last().click()
      await expect(page.locator('article.turn.assistant').first().locator('input.share-box')).toBeVisible()
      await page.locator('.transcript').evaluate((node) => {
        const answer = node.querySelector('article.turn.assistant')
        if (!answer) return
        node.scrollTop += answer.getBoundingClientRect().top + 400
      })
      const gap = await page.evaluate(() => {
        const title = document.querySelector('.chat-title')!.getBoundingClientRect()
        const box = document.querySelector('article.turn.assistant input.share-box')!.getBoundingClientRect()
        const turn = document.querySelector('article.turn.assistant')!.getBoundingClientRect()
        return { gap: box.top - title.top, cbTop: box.top, titleTop: title.top, turnTop: turn.top }
      })
      expect(gap.turnTop, `answer scrolled above the viewport ${JSON.stringify(gap)}`).toBeLessThan(0)
      expect(gap.cbTop, `pinned checkbox stays on screen ${JSON.stringify(gap)}`).toBeGreaterThanOrEqual(0)
      expect(Math.abs(gap.gap - 50), `pinned checkbox is about 50px under the title ${JSON.stringify(gap)}`).toBeLessThanOrEqual(4)
    })
  })
}
