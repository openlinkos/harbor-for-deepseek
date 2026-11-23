// 全站 tooltip、菜单、弹层、下拉必须真正画在屏幕上。
// content-visibility: auto 会裁掉非最后一条回合里溢出的绝对定位层。
// getBoundingClientRect 看不出来，所以用 elementFromPoint 和页面截图的墨迹。
import { expect, test, type Locator, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inflateSync } from 'node:zlib'
const SSE = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'lib/fb1344-sse.js'), 'utf8')

const sse = (events: unknown[]) => events.map((event) => `event: ${(event as { type: string }).type}\ndata: ${JSON.stringify(event)}\n\n`).join('')
const reply = (text: string) => sse([
  { type: 'message_start', message: { id: 'r-' + text.length, model: 'deepseek-flash' } },
  { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } },
  { type: 'content_block_stop', index: 0 },
  { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null, title: text }, usage: { input_tokens: 1, output_tokens: 1 } },
  { type: 'message_stop' },
])

const boot = async (page: Page, theme: string) => {
  await page.addInitScript((value) => localStorage.setItem('deepapi-theme', value), theme)
  let n = 0
  await page.route('https://api.deepseek.com/**', async (route) => {
    const url = route.request().url()
    if (url.endsWith('/user/balance')) return route.fulfill({ json: { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '1', granted_balance: '0', topped_up_balance: '1' }] } })
    if (url.endsWith('/models')) return route.fulfill({ json: { data: [{ id: 'deepseek-flash' }] } })
    if (!url.includes('/messages')) return route.fulfill({ status: 404, json: {} })
    n += 1
    return route.fulfill({ status: 200, contentType: 'text/event-stream', body: reply(n === 1 ? '第一条回答。' : '第二条回答。') })
  })
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()
  await page.addStyleTag({ content: '*{transition-duration:0s!important;transition-delay:0s!important;animation-duration:0s!important}' })
  await page.getByTestId('composer').fill('第一条问题')
  await page.getByTestId('send').click()
  await expect(page.getByTestId('assistant-text').first()).toContainText('第一条回答')
  await page.getByTestId('composer').fill('第二条问题')
  await page.getByTestId('send').click()
  await expect(page.getByTestId('assistant-text').last()).toContainText('第二条回答')
}

const drawer = async (page: Page) => {
  if ((page.viewportSize()?.width ?? 1440) < 768 && !(await page.locator('.nav-open').count())) {
    await page.getByTestId('menu').click()
    await expect(page.locator('.nav-open')).toBeVisible()
  }
}

type Rgb = [number, number, number]

const parseRgb = (value: string): Rgb => {
  const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : [0, 0, 0]
}

const decodePng = (buf: Buffer) => {
  let offset = 8
  let width = 0
  let height = 0
  let colorType = 6
  const parts: Buffer[] = []
  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset)
    const type = buf.toString('ascii', offset + 4, offset + 8)
    const data = buf.subarray(offset + 8, offset + 8 + length)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      colorType = data[9]
    } else if (type === 'IDAT') parts.push(Buffer.from(data))
    else if (type === 'IEND') break
    offset += 12 + length
  }
  const bpp = colorType === 6 ? 4 : 3
  const raw = inflateSync(Buffer.concat(parts))
  const stride = width * bpp
  const pixels = Buffer.alloc(height * stride)
  let index = 0
  for (let y = 0; y < height; y += 1) {
    const filter = raw[index]
    index += 1
    const row = y * stride
    for (let x = 0; x < stride; x += 1) {
      const value = raw[index]
      index += 1
      const left = x >= bpp ? pixels[row + x - bpp] : 0
      const up = y > 0 ? pixels[row - stride + x] : 0
      const upLeft = x >= bpp && y > 0 ? pixels[row - stride + x - bpp] : 0
      let painted = value
      if (filter === 1) painted = (value + left) & 255
      else if (filter === 2) painted = (value + up) & 255
      else if (filter === 3) painted = (value + Math.floor((left + up) / 2)) & 255
      else if (filter === 4) {
        const pa = Math.abs(up - upLeft)
        const pb = Math.abs(left - upLeft)
        const pc = Math.abs(left + up - 2 * upLeft)
        const nearest = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft
        painted = (value + nearest) & 255
      }
      pixels[row + x] = painted
    }
  }
  return { width, height, bpp, pixels }
}

const near = (pixel: Rgb, color: Rgb) => Math.abs(pixel[0] - color[0]) + Math.abs(pixel[1] - color[1]) + Math.abs(pixel[2] - color[2]) <= 140

const insideRadius = (x: number, y: number, width: number, height: number, radius: number) => {
  const limit = Math.min(radius, width / 2, height / 2)
  const corner = (x < limit || x > width - limit) && (y < limit || y > height - limit)
  if (!corner) return true
  const cx = x < limit ? limit : width - limit
  const cy = y < limit ? limit : height - limit
  return (x - cx) ** 2 + (y - cy) ** 2 <= limit ** 2
}

const painted = async (page: Page, layer: Locator, name: string) => {
  const info = await layer.evaluate((node) => {
    const box = node.getBoundingClientRect()
    const style = getComputedStyle(node)
    const xs = [0.3, 0.5, 0.7].map((part) => box.left + box.width * part)
    const ys = [0.3, 0.5, 0.7].map((part) => box.top + box.height * part)
    const hits = xs.flatMap((x) => ys.map((y) => {
      const hit = document.elementFromPoint(x, y)
      return { x, y, ok: !!hit && (hit === node || node.contains(hit)), tag: hit ? hit.tagName.toLowerCase() + (typeof hit.className === 'string' ? '.' + hit.className.split(' ')[0] : '') : 'null' }
    }))
    return {
      box: { x: box.x, y: box.y, width: box.width, height: box.height },
      bg: style.backgroundColor,
      color: style.color,
      radius: Number.parseFloat(style.borderTopLeftRadius) || 0,
      colors: (() => {
        const found: string[] = []
        const add = (value: string) => {
          if (value && value !== 'rgba(0, 0, 0, 0)' && value !== 'transparent') found.push(value)
        }
        const walk = (el: Element) => {
          const computed = getComputedStyle(el)
          add(computed.backgroundColor)
          add(computed.color)
          add(computed.borderTopColor)
          for (const child of el.children) walk(child)
        }
        walk(node)
        return found
      })(),
      hits,
      page: getComputedStyle(document.body).backgroundColor,
    }
  })
  const missed = info.hits.filter((hit) => !hit.ok).map((hit) => `${hit.x.toFixed(0)},${hit.y.toFixed(0)}→${hit.tag}`)
  const view = page.viewportSize() ?? { width: 1440, height: 900 }
  const clip = {
    x: Math.max(0, info.box.x),
    y: Math.max(0, info.box.y),
    width: Math.min(info.box.width, view.width - Math.max(0, info.box.x)),
    height: Math.min(info.box.height, view.height - Math.max(0, info.box.y)),
  }
  const png = decodePng(await page.screenshot({ clip }))
  const palette = info.colors.map(parseRgb)
  const pageColor = parseRgb(info.page)
  const scaleX = png.width / clip.width
  const scaleY = png.height / clip.height
  const distance = (a: Rgb, b: Rgb) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])
  const blend = (pixel: Rgb) => palette.some((left) => palette.some((right) => left !== right && [0, 1, 2].every((channel) => {
    const low = Math.min(left[channel], right[channel]) - 8
    const high = Math.max(left[channel], right[channel]) + 8
    return pixel[channel] >= low && pixel[channel] <= high
  })))
  let ink = 0
  let total = 0
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const cssX = (x + 0.5) / scaleX
      const cssY = (y + 0.5) / scaleY
      if (cssX < 2 || cssY < 2 || cssX > clip.width - 2 || cssY > clip.height - 2) continue
      if (!insideRadius(cssX, cssY, clip.width, clip.height, info.radius)) continue
      total += 1
      const index = (y * png.width + x) * png.bpp
      const pixel: Rgb = [png.pixels[index], png.pixels[index + 1], png.pixels[index + 2]]
      const onLayer = palette.some((color) => near(pixel, color)) || (blend(pixel) && distance(pixel, pageColor) > 40)
      if (onLayer) ink += 1
    }
  }
  const ratio = total ? ink / total : 0
  const problems: string[] = []
  if (missed.length) problems.push(`elementFromPoint 未命中弹层 ${missed.join(' ')}`)
  if (ratio < 0.9) problems.push(`可见墨迹 ${(ratio * 100).toFixed(1)}% < 90%`)
  expect(problems, name).toEqual([])
}

const hoverTip = async (page: Page, button: Locator, text: string, name: string, force = false) => {
  if (!force) await button.scrollIntoViewIfNeeded()
  await button.hover({ force })
  const tips = page.locator('.ds-tooltip').filter({ hasText: text })
  await expect.poll(async () => tips.evaluateAll((nodes) => nodes.some((node) => getComputedStyle(node).opacity !== '0'))).toBe(true)
  const index = await tips.evaluateAll((nodes) => nodes.findIndex((node) => getComputedStyle(node).opacity !== '0'))
  await painted(page, tips.nth(index), name)
  await page.mouse.move(0, 0)
}

for (const theme of ['light', 'dark'] as const) {
  for (const [width, height] of [[1440, 900], [390, 844]] as const) {
    test.describe(`overlay paint ${theme} ${width}`, () => {
      test.use({ viewport: { width, height }, colorScheme: theme, bypassCSP: true })

      test('non-last user and assistant tooltips stay painted', async ({ page }) => {
        await boot(page, theme)
        const user = page.locator('.turn.user').first()
        const assistant = page.locator('.turn.assistant').first()
        await expect(page.locator('.turn.user')).toHaveCount(2)
        await expect(page.locator('.turn.assistant')).toHaveCount(2)
        await hoverTip(page, user.locator('button[aria-label="复制"]'), '复制', '非最后一条用户回合 复制', true)
        await hoverTip(page, user.locator('button[aria-label="修改"]'), '修改', '非最后一条用户回合 修改', true)
        await hoverTip(page, assistant.locator('.action-row').getByRole('button', { name: '复制' }), '复制', '非最后一条回答回合 复制')
        await hoverTip(page, assistant.locator('.action-row').getByRole('button', { name: '分享' }), '分享', '非最后一条回答回合 分享')
      })

      test('menus, dialogs, and dropdowns stay painted', async ({ page }) => {
        await boot(page, theme)
        await page.locator('.turn.assistant').last().locator('.action-row').getByRole('button', { name: '不喜欢' }).click()
        await painted(page, page.locator('.modal-card.feedback'), '反馈弹层')
        await page.locator('.modal-card.feedback').getByRole('button', { name: '取消' }).click()
        await drawer(page)
        await page.getByTestId('user-menu').click()
        await painted(page, page.locator('.menu.user-menu'), '用户菜单')
        await page.keyboard.press('Escape')

        await page.locator('.chat-link').first().getByRole('button', { name: '菜单' }).click()
        await painted(page, page.getByTestId('chat-item-menu'), '会话菜单')
        await page.getByTestId('chat-item-menu').getByText('删除', { exact: true }).click()
        await painted(page, page.getByTestId('confirm-dialog').locator('.confirm-card'), '删除确认')
        await page.getByRole('button', { name: '取消' }).click()
        if (width < 768) await page.keyboard.press('Escape')

        await page.getByRole('button', { name: '搜索' }).first().click()
        await painted(page, page.locator('.search-dialog'), '搜索弹层')
        await page.locator('.search-dialog').getByRole('button', { name: '关闭' }).click()

        await drawer(page)
        await page.getByTestId('user-menu').click()
        await page.getByTestId('settings-open').click()
        await painted(page, page.getByTestId('settings-dialog').locator('.settings-shell'), '设置弹层')
        await page.getByTestId('language-trigger').click()
        await painted(page, page.getByTestId('language-trigger-menu'), '语言下拉')
        await page.keyboard.press('Escape')
        await page.getByTestId('safety-select').click()
        await painted(page, page.getByTestId('safety-select-menu'), '安全下拉')
        await page.keyboard.press('Escape')
        await page.getByTestId('settings-close').click()
        await expect(page.getByTestId('settings-dialog')).toBeHidden()
      })

      test('stop button tooltip is painted', async ({ page }) => {
        await page.addInitScript(SSE)
        await page.addInitScript((value) => localStorage.setItem('deepapi-theme', value), theme)
        await page.route('https://api.deepseek.com/**', async (route) => {
          const url = route.request().url()
          if (url.endsWith('/user/balance')) return route.fulfill({ json: { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '1', granted_balance: '0', topped_up_balance: '1' }] } })
          if (url.endsWith('/models')) return route.fulfill({ json: { data: [{ id: 'deepseek-flash' }] } })
          if (!url.includes('/messages')) return route.fulfill({ status: 404, json: {} })
          return route.fulfill({ status: 200, contentType: 'text/event-stream', body: '' })
        })
        await page.goto('/')
        await page.getByTestId('landing-send').click()
        await page.getByTestId('key-input').fill('demo-local-key')
        await page.getByTestId('key-save').click()
        await expect(page.getByTestId('composer')).toBeVisible()
        await page.addStyleTag({ content: '*{transition-duration:0s!important;transition-delay:0s!important}' })
        await page.getByTestId('composer').fill('停一下')
        await page.getByTestId('send').click()
        await page.waitForFunction(() => (window as unknown as { __sse: { count: () => number } }).__sse.count() > 0)
        await page.evaluate((events) => (window as unknown as { __sse: { push: (e: unknown[]) => void } }).__sse.push(events), [
          { type: 'message_start', message: { id: 'r', model: 'deepseek-flash' } },
          { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } },
          { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: '先想一句。' } },
        ])
        const stop = page.getByTestId('stop')
        await expect(stop).toHaveAttribute('data-tip', '停止生成')
        await hoverTip(page, stop, '停止生成', '停止生成 tooltip')
      })
    })
  }
}
