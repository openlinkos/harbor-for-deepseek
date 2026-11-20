import { expect, test, type Page, type Route } from '@playwright/test'

const sse = (text: string) => {
  const events = [
    { type: 'message_start', message: { id: 'req', model: 'deepseek-flash' } },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { input_tokens: 1, output_tokens: 1 } },
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
    await route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse('好') })
  })
}

const ready = async (page: Page, theme: 'light' | 'dark' = 'light') => {
  await page.addInitScript((choice) => localStorage.setItem('deepapi-theme', choice), theme)
  await install(page)
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()
  if ((page.viewportSize()?.width ?? 0) < 768) {
    await page.getByTestId('menu').click()
    await expect(page.locator('.sidebar')).toBeVisible()
  }
  await expect(page.getByTestId('user-menu')).toBeVisible()
}

const menu = (page: Page) => page.locator('.user-menu')
const bar = (page: Page) => page.getByTestId('user-menu')

const focusRow = async (page: Page) => {
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  }))
  await bar(page).focus()
}

const closeMenu = async (page: Page) => {
  if (await menu(page).isVisible()) {
    await page.keyboard.press('Escape')
  }
  await expect(menu(page)).toBeHidden()
}

const blankPoint = async (page: Page) => {
  const box = await bar(page).boundingBox()
  const label = await page.locator('.user-label').boundingBox()
  const more = await page.locator('.user-more').boundingBox()
  if (!box || !label || !more) throw new Error('user row is not measurable')
  return {
    x: label.x + label.width + (more.x - (label.x + label.width)) / 2,
    y: box.y + box.height / 2,
  }
}

const settledIcons = async (page: Page) => {
  const icons = page.locator('.user-menu [role="menuitem"] svg')
  await expect.poll(async () => Math.round((await icons.first().boundingBox())?.width ?? 0)).toBe(16)
  return iconStats(page)
}

const iconStats = async (page: Page) => page.locator('.user-menu [role="menuitem"] svg').evaluateAll((nodes) => Promise.all(nodes.map(async (node) => {
  const svg = node as SVGSVGElement
  const box = svg.getBoundingClientRect()
  const markup = svg.outerHTML
  const color = getComputedStyle(svg).color
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.querySelectorAll('path').forEach((path) => path.setAttribute('fill', color))
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }))
  const opaque = await new Promise<number>((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 16
      canvas.height = 16
      const context = canvas.getContext('2d')
      if (!context) {
        reject(new Error('no canvas'))
        return
      }
      context.drawImage(image, 0, 0, 16, 16)
      const data = context.getImageData(0, 0, 16, 16).data
      let count = 0
      for (let index = 3; index < data.length; index += 4) {
        if (data[index] > 200) count += 1
      }
      URL.revokeObjectURL(url)
      resolve(count)
    }
    image.onerror = () => reject(new Error('icon did not paint'))
    image.src = url
  })
  return { x: box.x, width: box.width, height: box.height, svgs: svg.querySelectorAll('svg').length, markup, opaque }
})))

const viewports = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
] as const

for (const viewport of viewports) {
  test.describe(`user menu ${viewport.width}`, () => {
    test.use({ viewport })

    test('avatar, name, and row blank each open the menu', async ({ page }) => {
      await ready(page)
      await page.locator('.user-bar .avatar').click()
      await expect(menu(page)).toBeVisible()
      await closeMenu(page)
      await page.locator('.user-label').click()
      await expect(menu(page)).toBeVisible()
      await closeMenu(page)
      const point = await blankPoint(page)
      await page.mouse.click(point.x, point.y)
      await expect(menu(page)).toBeVisible()
    })

    test('a click outside the menu closes it', async ({ page }) => {
      await ready(page)
      await page.locator('.user-label').click()
      await expect(menu(page)).toBeVisible()
      await page.locator('.brand-name').click()
      await expect(menu(page)).toBeHidden()
    })

    test('Tab moves focus away and closes the menu', async ({ page }) => {
      await ready(page)
      await focusRow(page)
      await page.keyboard.press('Enter')
      await expect(menu(page)).toBeVisible()
      await page.keyboard.press('Tab')
      await expect(menu(page)).toBeHidden()
    })

    test('Escape closes the menu', async ({ page }) => {
      await ready(page)
      await page.locator('.user-bar .avatar').click()
      await expect(menu(page)).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(menu(page)).toBeHidden()
    })

    test('choosing any menu item closes the menu', async ({ page }) => {
      await ready(page)
      await page.evaluate(() => {
        const opened: string[] = []
        window.open = (url?: string | URL) => {
          opened.push(String(url))
          ;(window as unknown as { __opened: string[] }).__opened = opened
          return null
        }
      })
      await page.locator('.user-label').click()
      await page.getByRole('menuitem', { name: '下载手机应用' }).click()
      await expect(menu(page)).toBeHidden()
      await expect.poll(() => page.evaluate(() => (window as unknown as { __opened?: string[] }).__opened ?? [])).toEqual(['https://github.com/openlinkos/deepapi/releases'])

      await page.locator('.user-label').click()
      await page.getByRole('menuitem', { name: '帮助与反馈' }).click()
      await expect(menu(page)).toBeHidden()
      await expect.poll(() => page.evaluate(() => (window as unknown as { __opened?: string[] }).__opened ?? [])).toEqual([
        'https://github.com/openlinkos/deepapi/releases',
        'https://github.com/openlinkos/deepapi/issues',
      ])

      await page.locator('.user-label').click()
      await page.getByTestId('settings-open').click()
      await expect(menu(page)).toBeHidden()
      await expect(page.getByTestId('settings-dialog')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('settings-dialog')).toBeHidden()
      await expect(menu(page)).toBeHidden()

      await page.locator('.user-label').click()
      await page.getByRole('menuitem', { name: '退出登录' }).click()
      await expect(menu(page)).toBeHidden()
      await expect(page.getByTestId('landing')).toBeVisible()
    })

    test('each menu item has one 16×16 icon and no solid block', async ({ page }) => {
      await ready(page)
      await page.locator('.user-bar .avatar').click()
      const items = page.locator('.user-menu [role="menuitem"]')
      await expect(items).toHaveCount(4)
      const stats = await settledIcons(page)
      expect(stats).toHaveLength(4)
      for (const icon of stats) {
        expect(icon.svgs).toBe(0)
        expect(Math.round(icon.width)).toBe(16)
        expect(Math.round(icon.height)).toBe(16)
        expect(Math.round(icon.x)).toBe(22)
        expect(icon.markup).not.toContain('cf-overlay')
        expect(icon.markup).not.toContain('cf-turnstile')
        expect(icon.markup).not.toMatch(/d="true"|d="false"/)
        expect(icon.opaque).toBeGreaterThan(8)
        expect(icon.opaque).toBeLessThan(200)
      }
    })

    test('Enter and Space on the row open the menu', async ({ page }) => {
      await ready(page)
      await focusRow(page)
      await page.keyboard.press('Enter')
      await expect(menu(page)).toBeVisible()
      await closeMenu(page)
      await focusRow(page)
      await page.keyboard.press('Space')
      await expect(menu(page)).toBeVisible()
    })
  })
}

for (const viewport of viewports) {
  test.describe(`user menu dark ${viewport.width}`, () => {
    test.use({ viewport, colorScheme: 'dark' })

    test('icons stay line drawings in the dark theme', async ({ page }) => {
      await ready(page, 'dark')
      await expect(page.locator('body')).toHaveAttribute('data-ds-dark-theme', '')
      await page.locator('.user-label').click()
      await expect(menu(page)).toBeVisible()
      const stats = await settledIcons(page)
      expect(stats).toHaveLength(4)
      for (const icon of stats) {
        expect(Math.round(icon.width)).toBe(16)
        expect(Math.round(icon.height)).toBe(16)
        expect(icon.opaque).toBeGreaterThan(8)
        expect(icon.opaque).toBeLessThan(200)
      }
    })
  })
}
