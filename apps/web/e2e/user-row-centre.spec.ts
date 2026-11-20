import { expect, test, type Page, type Route } from '@playwright/test'

// Official P4 numbers from checks/fb1344 .fb1344-ref/report.md (侧栏用户行)
// and official-fb1344.json cells: weight 500, light rgb(129, 133, 140), dark rgb(173, 178, 184).
// Row border box 44px and avatar 32px are the official sizes already on the row; the miss was the offset.
const OFFICIAL = {
  rowHeight: 44,
  avatar: 32,
  weight: '500',
  color: {
    light: 'rgb(129, 133, 140)',
    dark: 'rgb(173, 178, 184)',
  },
} as const

const fulfill = async (route: Route) => {
  const url = route.request().url()
  if (url.endsWith('/user/balance')) {
    await route.fulfill({ json: { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '1', granted_balance: '0', topped_up_balance: '1' }] } })
    return
  }
  if (url.endsWith('/models')) {
    await route.fulfill({ json: { data: [{ id: 'deepseek-flash' }] } })
    return
  }
  await route.fulfill({ status: 404, json: {} })
}

const ready = async (page: Page, theme: 'light' | 'dark') => {
  await page.addInitScript((choice) => localStorage.setItem('deepapi-theme', choice), theme)
  await page.route('https://api.deepseek.com/**', fulfill)
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()
  if ((page.viewportSize()?.width ?? 1440) < 768) {
    await page.getByTestId('menu').click()
    await expect(page.locator('.sidebar')).toBeVisible()
  }
  await expect(page.getByTestId('user-menu')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
}

const measure = (page: Page) => page.evaluate(() => {
  const r1 = (value: number) => Math.round(value * 10) / 10
  const box = (el: Element) => {
    const rect = el.getBoundingClientRect()
    return { x: rect.x, y: rect.y, w: rect.width, h: rect.height }
  }
  const textBox = (el: Element) => {
    const range = document.createRange()
    range.selectNodeContents(el)
    const rects = [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0)
    const x = Math.min(...rects.map((rect) => rect.left))
    const y = Math.min(...rects.map((rect) => rect.top))
    const right = Math.max(...rects.map((rect) => rect.right))
    const bottom = Math.max(...rects.map((rect) => rect.bottom))
    return { x, y, w: right - x, h: bottom - y }
  }
  const off = (outer: { x: number; y: number; w: number; h: number }, inner: { x: number; y: number; w: number; h: number }) => ({
    dx: r1(inner.x + inner.w / 2 - (outer.x + outer.w / 2)),
    dy: r1(inner.y + inner.h / 2 - (outer.y + outer.h / 2)),
  })
  const row = document.querySelector('.user-bar')
  if (!row) throw new Error('user row missing')
  const avatar = row.querySelector('.avatar')
  const name = row.querySelector('.user-label')
  const more = row.querySelector('.user-more svg')
  if (!avatar || !name || !more) throw new Error('user row parts missing')
  const rowBox = box(row)
  const avatarBox = box(avatar)
  const style = getComputedStyle(avatar)
  return {
    rowH: r1(rowBox.h),
    avatarW: r1(avatarBox.w),
    avatarH: r1(avatarBox.h),
    weight: style.fontWeight,
    color: style.color,
    avatarDy: off(rowBox, avatarBox).dy,
    nameDy: off(rowBox, textBox(name)).dy,
    moreDy: off(rowBox, box(more)).dy,
    glyphDx: off(avatarBox, textBox(avatar)).dx,
    glyphDy: off(avatarBox, textBox(avatar)).dy,
  }
})

for (const theme of ['light', 'dark'] as const) {
  for (const [width, height] of [[1440, 900], [390, 844]] as const) {
    test.describe(`user row ${theme} ${width}`, () => {
      test.use({ viewport: { width, height }, colorScheme: theme, bypassCSP: true })

      test('avatar, name, and more sit on the row centre', async ({ page }) => {
        await ready(page, theme)
        const row = await measure(page)
        expect(Math.abs(row.rowH - OFFICIAL.rowHeight), 'row height').toBeLessThanOrEqual(0.5)
        expect(row.avatarW, 'avatar width').toBe(OFFICIAL.avatar)
        expect(row.avatarH, 'avatar height').toBe(OFFICIAL.avatar)
        expect(row.weight, 'avatar font-weight').toBe(OFFICIAL.weight)
        expect(row.color, 'avatar color').toBe(OFFICIAL.color[theme])
        expect(Math.abs(row.avatarDy), `avatar dy ${row.avatarDy}`).toBeLessThanOrEqual(1)
        expect(Math.abs(row.nameDy), `name dy ${row.nameDy}`).toBeLessThanOrEqual(1)
        expect(Math.abs(row.moreDy), `more dy ${row.moreDy}`).toBeLessThanOrEqual(1)
        expect(Math.abs(row.glyphDx), `glyph dx ${row.glyphDx}`).toBeLessThanOrEqual(1)
        expect(Math.abs(row.glyphDy), `glyph dy ${row.glyphDy}`).toBeLessThanOrEqual(1)
      })
    })
  }
}
