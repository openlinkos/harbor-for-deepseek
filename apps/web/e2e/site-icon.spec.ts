import { expect, test, type Locator, type Page, type Route } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const shots = '/opt/cursor/artifacts'
mkdirSync(shots, { recursive: true })

/** 16×16 solid PNGs. object-fit: cover turns each into a circle in the favicon slot. */
const PNG = {
  red: 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR4nGO4o6FBEmIY1TCqYfhqAAAyBCwQhvh37QAAAABJRU5ErkJggg==',
  green: 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR4nGOQW+BGEmIY1TCqYfhqAAASYgQQT6MgfQAAAABJRU5ErkJggg==',
  blue: 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR4nGPQiLpEEmIY1TCqYfhqAAAXiFQQBOMlbQAAAABJRU5ErkJggg==',
  orange: 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR4nGN41iNCEmIY1TCqYfhqAAAoGoYQRv80BQAAAABJRU5ErkJggg==',
  purple: 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR4nGOo0NhCEmIY1TCqYfhqAACFiFQQFfKcqAAAAABJRU5ErkJggg==',
} as const

type Swatch = keyof typeof PNG

type MockSource = {
  host: string
  site: string
  title: string
  icon: string | null
  swatch?: Swatch
}

const iconUrl = (host: string) => `https://cdn.deepseek.com/site-icons/${host}`

const source = (host: string, site: string, title: string, icon: string | null, swatch?: Swatch): MockSource => ({
  host,
  site,
  title,
  icon,
  swatch,
})

const sse = (results: MockSource[]) => {
  const events = [
    { type: 'message_start', message: { id: 'req-icons', model: 'deepseek-flash' } },
    { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '先看来源图标。', signature: 'sig' } },
    {
      type: 'content_block_start',
      index: 1,
      content_block: {
        type: 'web_search_tool_result',
        tool_use_id: 'tool-icons',
        kind: 'search',
        content: results.map((item) => ({
          type: 'web_search_result',
          title: item.title,
          url: `https://${item.host}/page`,
          snippet: `${item.site} 摘要`,
          site_name: item.site,
          site_icon: item.icon,
          page_age: '2026-11-18',
        })),
      },
    },
    { type: 'content_block_start', index: 2, content_block: { type: 'text', text: '来源已经列在下面。' } },
    {
      type: 'message_delta',
      delta: { stop_reason: 'end_turn', stop_sequence: null, title: '来源图标' },
      usage: { input_tokens: 12, output_tokens: 8, service_tier: 'standard' },
    },
    { type: 'message_stop' },
  ]
  return events.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join('')
}

const install = async (page: Page, results: MockSource[]) => {
  await page.route('https://cdn.deepseek.com/site-icons/**', async (route) => {
    const host = decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop() || '')
    const match = results.find((item) => item.host === host)
    if (!match?.swatch) {
      await route.fulfill({ status: 404, body: 'missing' })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: Buffer.from(PNG[match.swatch], 'base64'),
    })
  })
  await page.route('https://api.deepseek.com/**', async (route: Route) => {
    const url = route.request().url()
    if (url.endsWith('/user/balance')) {
      await route.fulfill({
        json: { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '1.00', granted_balance: '0', topped_up_balance: '1.00' }] },
      })
      return
    }
    if (url.endsWith('/models')) {
      await route.fulfill({ json: { data: [{ id: 'deepseek-flash' }, { id: 'deepseek-v4-pro' }] } })
      return
    }
    if (!url.includes('/messages')) {
      await route.fulfill({ status: 404, json: { error: { message: 'not mocked' } } })
      return
    }
    await route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse(results) })
  })
}

const unlock = async (page: Page) => {
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()
  await page.getByTestId('composer').fill('查一下来源图标')
  await page.getByTestId('send').click()
  await expect(page.getByTestId('assistant-text')).toContainText('来源已经列在下面')
}

const circle = (radius: string, size: number) => {
  if (radius === '50%') return true
  return Math.abs(Number.parseFloat(radius) - size / 2) <= 0.6
}

const iconMetrics = async (img: Locator) =>
  img.evaluate((node) => {
    const style = getComputedStyle(node)
    const parent = node.parentElement
    const parentStyle = parent ? getComputedStyle(parent) : style
    const rect = node.getBoundingClientRect()
    const parentRect = parent ? parent.getBoundingClientRect() : rect
    return {
      width: rect.width,
      height: rect.height,
      parentWidth: parentRect.width,
      parentHeight: parentRect.height,
      radius: style.borderTopLeftRadius,
      parentRadius: parentStyle.borderTopLeftRadius,
      fit: style.objectFit,
      marginLeft: parentStyle.marginLeft,
      src: node.getAttribute('src'),
    }
  })

const expectOfficialIcon = async (img: Locator, src: string, size: number) => {
  await expect(img).toBeVisible()
  await expect(img).toHaveAttribute('src', src)
  const box = await iconMetrics(img)
  expect(box.src).toBe(src)
  expect(Math.round(box.width)).toBe(size)
  expect(Math.round(box.height)).toBe(size)
  expect(Math.round(box.parentWidth)).toBe(size)
  expect(Math.round(box.parentHeight)).toBe(size)
  expect(circle(box.radius, size)).toBe(true)
  expect(circle(box.parentRadius, size)).toBe(true)
  expect(box.fit).toBe('cover')
  return box
}

const STRIP = 16
const LIST = 18
const MARKS = 4

const withIcons: MockSource[] = [
  source('sohu.com', '搜狐', '搜狐天气', iconUrl('sohu.com'), 'red'),
  source('weather.com.cn', '天气网', '天气网预报', iconUrl('weather.com.cn'), 'green'),
  source('gmw.cn', '光明网', '光明降温', iconUrl('gmw.cn'), 'blue'),
  source('toutiao.com', '头条', '头条降温', iconUrl('toutiao.com'), 'orange'),
  source('nmc.cn', '气象台', '中央气象台', iconUrl('nmc.cn'), 'purple'),
]

test('mock site icons render on every shown source at 1440 and 390', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await install(page, withIcons)
  await unlock(page)

  const pill = page.getByTestId('search-results')
  const line = page.locator('.found-line .favicons')
  const shown = withIcons.slice(0, MARKS)
  await expect(pill).toContainText(`${withIcons.length} 个网页`)
  await expect(page.locator('.found-line')).toContainText(`搜索到 ${withIcons.length} 个网页`)

  const checkStrip = async (prefix: string) => {
    const strips = [
      { icons: pill.locator('.favicons'), shot: pill, name: `${prefix}-pill.png` },
      { icons: line, shot: page.locator('.found-line'), name: `${prefix}-timeline.png` },
    ]
    for (const strip of strips) {
      const imgs = strip.icons.locator('img')
      await expect(imgs).toHaveCount(shown.length)
      const margins: string[] = []
      for (let index = 0; index < shown.length; index += 1) {
        const box = await expectOfficialIcon(imgs.nth(index), shown[index]!.icon!, STRIP)
        margins.push(box.marginLeft)
      }
      expect(margins[0]).toBe('0px')
      expect(margins.slice(1).every((value) => value === '-4px')).toBe(true)
      const srcs = await imgs.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('src')))
      expect(srcs).toEqual(shown.map((item) => item.icon))
      expect(srcs).not.toContain(withIcons[MARKS]!.icon)
      await strip.shot.screenshot({ path: join(shots, strip.name) })
    }
  }

  await checkStrip('site-icons-1440')
  await pill.click()
  const panel = page.getByTestId('search-panel')
  await expect(panel).toBeVisible()
  await expect(panel).toHaveCSS('transform', 'none')
  await expect(panel.locator('.source-card')).toHaveCount(withIcons.length)
  const listImgs = panel.locator('.source-card img')
  await expect(listImgs).toHaveCount(withIcons.length)
  for (let index = 0; index < withIcons.length; index += 1) {
    const box = await expectOfficialIcon(listImgs.nth(index), withIcons[index]!.icon!, LIST)
    expect(box.marginLeft).toBe('0px')
  }
  await panel.screenshot({ path: join(shots, 'site-icons-1440-list.png') })
  await panel.getByRole('button', { name: '关闭' }).click()
  await expect(panel).toBeHidden()

  await page.setViewportSize({ width: 390, height: 844 })
  await checkStrip('site-icons-390')
  await pill.click()
  await expect(panel).toBeVisible()
  await expect(panel).toHaveCSS('transform', 'none')
  await expect(panel.locator('.source-card img')).toHaveCount(withIcons.length)
  for (let index = 0; index < withIcons.length; index += 1) {
    await expectOfficialIcon(panel.locator('.source-card img').nth(index), withIcons[index]!.icon!, LIST)
  }
  await panel.screenshot({ path: join(shots, 'site-icons-390-list.png') })
})

test('a null site icon falls back to the site name initial', async ({ page }) => {
  const results = [
    source('sohu.com', '搜狐', '搜狐天气', iconUrl('sohu.com'), 'red'),
    source('example.com', 'Example', '没有图标', null),
    source('blank.example', '空白', '空字符串', ''),
  ]
  await page.setViewportSize({ width: 1440, height: 900 })
  await install(page, results)
  await unlock(page)

  const assertLetters = async () => {
    for (const strip of [page.getByTestId('search-results').locator('.favicons'), page.locator('.found-line .favicons')]) {
      await expect(strip.locator('img')).toHaveCount(1)
      await expect(strip.locator('img')).toHaveAttribute('src', iconUrl('sohu.com'))
      await expect(strip.locator('.favicon').nth(1)).toHaveText('E')
      await expect(strip.locator('.favicon').nth(1).locator('img')).toHaveCount(0)
      await expect(strip.locator('.favicon').nth(2)).toHaveText('空')
      await expect(strip.locator('.favicon').nth(2).locator('img')).toHaveCount(0)
    }
  }
  await assertLetters()
  await page.getByTestId('search-results').click()
  const panel = page.getByTestId('search-panel')
  await expect(panel).toHaveCSS('transform', 'none')
  await expect(panel.locator('.source-card img')).toHaveCount(1)
  await expect(panel.locator('.source-card').nth(1).locator('.favicon')).toHaveText('E')
  await expect(panel.locator('.source-card').nth(1).locator('img')).toHaveCount(0)
  await expect(panel.locator('.source-card').nth(2).locator('.favicon')).toHaveText('空')
  await panel.locator('.source-card').nth(1).screenshot({ path: join(shots, 'site-icons-null-letter.png') })

  await panel.getByRole('button', { name: '关闭' }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await assertLetters()
  await page.getByTestId('search-results').click()
  await expect(panel.locator('.source-card').nth(1).locator('.favicon')).toHaveText('E')
  await expect(panel.locator('.source-card img')).toHaveCount(1)
})

test('a site icon that fails to load falls back to the site name initial', async ({ page }) => {
  const broken = iconUrl('broken.example')
  const results = [
    source('sohu.com', '搜狐', '搜狐天气', iconUrl('sohu.com'), 'red'),
    source('broken.example', 'Broken', '图片打不开', broken),
  ]
  await page.setViewportSize({ width: 1440, height: 900 })
  await install(page, results)
  await unlock(page)

  const assertFallback = async () => {
    for (const strip of [page.getByTestId('search-results').locator('.favicons'), page.locator('.found-line .favicons')]) {
      await expect(strip.locator('img')).toHaveCount(1)
      await expect(strip.locator('img')).toHaveAttribute('src', iconUrl('sohu.com'))
      await expect(strip.locator('.favicon').nth(1)).toHaveText('B')
      await expect(strip.locator('.favicon').nth(1).locator('img')).toHaveCount(0)
    }
  }
  await assertFallback()
  await page.getByTestId('search-results').click()
  const panel = page.getByTestId('search-panel')
  await expect(panel).toHaveCSS('transform', 'none')
  await expect(panel.locator('.source-card img')).toHaveCount(1)
  await expect(panel.locator('.source-card').nth(1).locator('.favicon')).toHaveText('B')
  await expect(panel.locator('.source-card').nth(1).locator('img')).toHaveCount(0)
  await panel.locator('.source-card').nth(1).screenshot({ path: join(shots, 'site-icons-error-letter.png') })

  await panel.getByRole('button', { name: '关闭' }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await assertFallback()
  await page.getByTestId('search-results').click()
  await expect(panel.locator('.source-card').nth(1).locator('.favicon')).toHaveText('B')
  await expect(panel.locator('img')).toHaveCount(1)
})
