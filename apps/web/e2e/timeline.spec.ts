import { expect, test, type Page, type Route } from '@playwright/test'
import { inflateSync } from 'node:zlib'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const shots = '/opt/cursor/artifacts'
mkdirSync(shots, { recursive: true })

const sse = (events: unknown[]) =>
  events.map((event) => `event: ${(event as { type: string }).type}\ndata: ${JSON.stringify(event)}\n\n`).join('')

const timeline = [
  { type: 'message_start', message: { id: 'req-timeline', model: 'deepseek-flash' } },
  { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '先核对行距。', signature: 'sig' } },
  {
    type: 'content_block_start',
    index: 1,
    content_block: {
      type: 'web_search_tool_result',
      tool_use_id: 'tool-timeline',
      kind: 'search',
      content: [
        {
          type: 'web_search_result',
          title: '天气',
          url: 'https://example.com/weather',
          snippet: '晴',
          site_name: 'Example',
          site_icon: null,
          page_age: '2026-11-18',
        },
        {
          type: 'web_search_result',
          title: '空气',
          url: 'https://example.com/air',
          snippet: '良',
          site_name: 'Air',
          site_icon: null,
          page_age: '2026-11-18',
        },
      ],
    },
  },
  { type: 'content_block_start', index: 2, content_block: { type: 'thinking', thinking: '再整理来源。', signature: 'sig' } },
  { type: 'content_block_start', index: 3, content_block: { type: 'text', text: '行距对照。' } },
  {
    type: 'message_delta',
    delta: { stop_reason: 'end_turn', stop_sequence: null, title: '时间线' },
    usage: { input_tokens: 12, output_tokens: 8, service_tier: 'standard' },
  },
  { type: 'message_stop' },
]

const install = async (page: Page) => {
  await page.route('https://api.deepseek.com/**', async (route: Route) => {
    const url = route.request().url()
    if (url.endsWith('/user/balance')) {
      await route.fulfill({
        json: { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '1.00', granted_balance: '0', topped_up_balance: '1.00' }] },
      })
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
    await route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse(timeline) })
  })
}

const openTimeline = async (page: Page) => {
  await install(page)
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()
  await page.getByTestId('composer').fill('核对时间线')
  await page.getByTestId('send').click()
  await expect(page.getByTestId('assistant-text')).toContainText('行距对照')
  await expect(page.getByTestId('thinking')).toContainText('先核对行距')
}

/** Whitespace between glyph rows, the same ink gap a 1920 screenshot comparison uses. */
const inkGaps = (png: Buffer, x0: number, x1: number, y0: number, y1: number) => {
  let offset = 8
  let width = 0
  let height = 0
  let color = 6
  const parts: Buffer[] = []
  while (offset < png.length) {
    const length = png.readUInt32BE(offset)
    const type = png.toString('ascii', offset + 4, offset + 8)
    const data = png.subarray(offset + 8, offset + 8 + length)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      color = data[9]
    } else if (type === 'IDAT') parts.push(Buffer.from(data))
    else if (type === 'IEND') break
    offset += 12 + length
  }
  const bpp = color === 2 ? 3 : 4
  const raw = inflateSync(Buffer.concat(parts))
  const stride = width * bpp
  const rows = Buffer.alloc(height * stride)
  let cursor = 0
  const paeth = (a: number, b: number, c: number) => {
    const p = a + b - c
    const pa = Math.abs(p - a)
    const pb = Math.abs(p - b)
    const pc = Math.abs(p - c)
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
  }
  for (let y = 0; y < height; y += 1) {
    const filter = raw[cursor]
    cursor += 1
    const prev = y === 0 ? null : rows.subarray((y - 1) * stride, y * stride)
    const dest = rows.subarray(y * stride, (y + 1) * stride)
    for (let x = 0; x < stride; x += 1) {
      const left = x >= bpp ? dest[x - bpp] : 0
      const up = prev ? prev[x] : 0
      const upLeft = prev && x >= bpp ? prev[x - bpp] : 0
      const value = raw[cursor]
      cursor += 1
      const predictor = filter === 1 ? left : filter === 2 ? up : filter === 3 ? Math.floor((left + up) / 2) : filter === 4 ? paeth(left, up, upLeft) : 0
      dest[x] = (value + predictor) & 255
    }
  }
  const dark = (x: number, y: number) => {
    const i = (y * width + x) * bpp
    return (rows[i] + rows[i + 1] + rows[i + 2]) / 3 < 210
  }
  const bands: Array<[number, number]> = []
  for (let y = y0; y < y1; y += 1) {
    let count = 0
    for (let x = x0; x < x1; x += 1) if (dark(x, y)) count += 1
    if (count <= 6) continue
    const last = bands.at(-1)
    if (last && y <= last[1] + 1) last[1] = y
    else bands.push([y, y])
  }
  const kept = bands.filter(([start, end]) => end - start + 1 >= 8)
  return kept.slice(1).map(([start], index) => start - kept[index][1] - 1)
}

test('thinking timeline matches the official rhythm', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1072 })
  await openTimeline(page)
  for (const viewport of [
    { width: 1920, height: 1072, name: '1920' },
    { width: 1440, height: 900, name: '1440' },
    { width: 390, height: 844, name: '390' },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    if (viewport.width < 768) await expect(page.locator('.sidebar')).toBeHidden()
    await expect(page.getByTestId('thinking')).toContainText('先核对行距')
    const metrics = await page.evaluate(() => {
      const title = document.querySelector('.thinking button')
      const dot = getComputedStyle(document.querySelector('.timeline-dot')!, '::before')
      const line = getComputedStyle(document.querySelector('.timeline-search:not(.is-last) .timeline-line')!)
      const button = title ? getComputedStyle(title) : null
      const search = document.querySelector('.timeline-search')
      return {
        fontSize: button?.fontSize,
        lineHeight: button?.lineHeight,
        marginBottom: button?.marginBottom,
        marginLeft: button?.marginLeft,
        dotWidth: dot.width,
        dotHeight: dot.height,
        dotRadius: dot.borderRadius,
        dotColor: dot.backgroundColor,
        lineWidth: line.width,
        lineColor: line.backgroundColor,
        searchHeight: search ? getComputedStyle(search).height : '',
        dots: document.querySelectorAll('.timeline-dot').length,
        lines: [...document.querySelectorAll('.timeline-line')].filter((node) => getComputedStyle(node).display !== 'none').length,
      }
    })
    expect(metrics.fontSize, viewport.name).toBe('16px')
    expect(metrics.lineHeight, viewport.name).toBe('28px')
    expect(metrics.marginBottom, viewport.name).toBe('2px')
    expect(metrics.marginLeft, viewport.name).toBe(viewport.width < 768 ? '22px' : '0px')
    expect(metrics.dots, viewport.name).toBe(2)
    expect(metrics.lines, viewport.name).toBeGreaterThanOrEqual(2)
    expect(metrics.dotWidth, viewport.name).toBe('5px')
    expect(metrics.dotHeight, viewport.name).toBe('5px')
    expect(metrics.dotRadius, viewport.name).toBe('50%')
    expect(metrics.dotColor, viewport.name).not.toBe('rgba(0, 0, 0, 0)')
    expect(metrics.lineWidth, viewport.name).toBe('1px')
    expect(metrics.lineColor, viewport.name).not.toBe('rgba(0, 0, 0, 0)')
    expect(metrics.searchHeight, viewport.name).toBe('34px')
    const file = join(shots, `timeline-${viewport.name}.png`)
    const png = await page.screenshot({ path: file })
    if (viewport.width >= 768) {
      const area = await page.locator('.thinking').boundingBox()
      expect(area, viewport.name).not.toBeNull()
      const gaps = inkGaps(png, Math.floor(area!.x + 48), Math.floor(area!.x + Math.min(area!.width, 420)), Math.floor(area!.y), Math.ceil(area!.y + area!.height))
      expect(gaps.length, `${viewport.name} ${gaps.join(',')}`).toBeGreaterThanOrEqual(3)
      expect(Math.abs(gaps[0] - 21), `${viewport.name} title ink ${gaps.join(',')}`).toBeLessThanOrEqual(3)
      expect(Math.abs(gaps[1] - 24), `${viewport.name} step ink ${gaps.join(',')}`).toBeLessThanOrEqual(3)
      expect(Math.abs(gaps[2] - 24), `${viewport.name} step ink ${gaps.join(',')}`).toBeLessThanOrEqual(3)
    }
  }
})

test('thinking only, search only, and both expand and collapse', async ({ page }) => {
  let mode: 'think' | 'search' | 'both' = 'think'
  const think = (title: string, thought: string, text: string) => [
    { type: 'message_start', message: { id: 'req-mode', model: 'deepseek-flash' } },
    { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: thought, signature: 'sig' } },
    { type: 'content_block_start', index: 1, content_block: { type: 'text', text } },
    { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null, title }, usage: { input_tokens: 8, output_tokens: 4 } },
    { type: 'message_stop' },
  ]
  const search = [
    { type: 'message_start', message: { id: 'req-mode', model: 'deepseek-flash' } },
    { type: 'content_block_start', index: 0, content_block: { type: 'web_search_tool_result', tool_use_id: 'tool-mode', kind: 'search', content: [{ type: 'web_search_result', title: '人口', url: 'https://example.com/pop', snippet: '约 39 万', site_name: 'Example', site_icon: null, page_age: '2026-11-16' }] } },
    { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '约 39 万。' } },
    { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null, title: '只搜索' }, usage: { input_tokens: 8, output_tokens: 4 } },
    { type: 'message_stop' },
  ]
  const both = [
    { type: 'message_start', message: { id: 'req-mode', model: 'deepseek-flash' } },
    { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '两边都先想。', signature: 'sig' } },
    { type: 'content_block_start', index: 1, content_block: { type: 'web_search_tool_result', tool_use_id: 'tool-both', kind: 'search', content: [{ type: 'web_search_result', title: '天气', url: 'https://example.com/weather', snippet: '晴', site_name: 'Example', site_icon: null, page_age: '2026-11-18' }] } },
    { type: 'content_block_start', index: 2, content_block: { type: 'thinking', thinking: '两边再整理。', signature: 'sig' } },
    { type: 'content_block_start', index: 3, content_block: { type: 'text', text: '两边都开。' } },
    { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null, title: '两者都开' }, usage: { input_tokens: 8, output_tokens: 4 } },
    { type: 'message_stop' },
  ]
  await page.route('https://api.deepseek.com/**', async (route: Route) => {
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
    const events = mode === 'think' ? think('只思考', '只想这一步。', '只思考的回答。') : mode === 'search' ? search : both
    await route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse(events) })
  })
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()

  const turn = () => page.locator('.turn.assistant').last()
  const send = async (text: string) => {
    await page.getByTestId('composer').fill(text)
    await page.getByTestId('send').click()
    await expect(turn().getByTestId('assistant-text')).toBeVisible()
  }

  await page.getByTestId('toggle-search').click()
  mode = 'think'
  await send('只开思考')
  const thought = turn().getByTestId('thinking')
  await expect(thought).toContainText('已思考')
  await expect(thought).toContainText('只想这一步')
  await expect(thought.locator('.timeline-dot')).toHaveCount(1)
  await thought.getByTestId('thinking-toggle').click()
  await expect(thought.getByTestId('thinking-toggle')).toHaveAttribute('aria-expanded', 'false')
  await expect(thought.getByText('只想这一步。')).toBeHidden()
  await thought.getByTestId('thinking-toggle').click()
  await expect(thought.getByTestId('thinking-toggle')).toHaveAttribute('aria-expanded', 'true')
  await expect(thought.getByText('只想这一步。')).toBeVisible()

  await page.getByTestId('new-chat').click()
  await page.getByTestId('toggle-thinking').click()
  await page.getByTestId('toggle-search').click()
  mode = 'search'
  await send('只开搜索')
  await expect(turn().getByTestId('thinking')).toHaveCount(0)
  await expect(turn().getByText('已思考')).toHaveCount(0)
  await expect(turn().getByText('搜索到 1 个网页')).toBeVisible()

  await page.getByTestId('new-chat').click()
  await page.getByTestId('toggle-thinking').click()
  mode = 'both'
  await send('两者都开')
  const bothThought = turn().getByTestId('thinking')
  await expect(bothThought).toContainText('已思考')
  await expect(bothThought).toContainText('两边都先想')
  await expect(bothThought).toContainText('搜索到 1 个网页')
  await expect(bothThought.locator('.timeline-dot')).toHaveCount(2)
  await expect(bothThought.locator('.timeline-line').first()).toBeVisible()
  await bothThought.getByTestId('thinking-toggle').click()
  await expect(bothThought.getByText('两边都先想。')).toBeHidden()
  await expect(bothThought.getByText('搜索到 1 个网页')).toBeHidden()
  await bothThought.getByTestId('thinking-toggle').click()
  await expect(bothThought.getByText('两边都先想。')).toBeVisible()
  await expect(bothThought.getByText('搜索到 1 个网页')).toBeVisible()
  await expect(bothThought.locator('.timeline-dot')).toHaveCount(2)
})
