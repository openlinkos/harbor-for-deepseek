import { expect, test, type ElementHandle, type Page, type Route } from '@playwright/test'

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
    await route.fulfill({ status: 404, json: {} })
  })
}

const boot = async (page: Page, width: number) => {
  await install(page)
  // Registered before the app's popstate listeners, so it can see the menu the overlay pop then closes.
  await page.addInitScript(() => {
    window.addEventListener('popstate', () => {
      const flag = (window as Window & { __armSettingsGrab?: boolean }).__armSettingsGrab
      if (!flag) return
      ;(window as Window & { __armSettingsGrab?: boolean }).__armSettingsGrab = false
      ;(window as Window & { __settingsGrab?: { item: Element | null; bar: Element | null } }).__settingsGrab = {
        item: document.querySelector('[data-testid="settings-open"]'),
        bar: document.querySelector('[data-testid="user-menu"]'),
      }
    }, true)
  })
  await page.setViewportSize({ width, height: width < 768 ? 844 : 820 })
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()
  if (width < 768) {
    await page.getByTestId('menu').click()
    await expect(page.getByTestId('user-menu')).toBeVisible()
  }
}

const openSettings = async (page: Page) => {
  await page.getByTestId('user-menu').click()
  await page.getByTestId('settings-open').click()
  await expect(page.getByTestId('settings-dialog')).toBeVisible()
}

// Click 关闭, then open the user menu in the same turn the dialog leaves the document
// (inside the 100ms closing animation and the overlay history.back window). The handle
// is taken while that turn still has the menu open. Waiting afterwards is the assertion.
const reopenDuringClose = async (page: Page, closeSelector: string) => {
  const bag = await page.evaluateHandle((selector) => new Promise<{ item: Element | null; bar: Element | null }>((resolve) => {
    const host = window as Window & {
      __armSettingsGrab?: boolean
      __settingsGrab?: { item: Element | null; bar: Element | null } | null
    }
    host.__settingsGrab = null
    host.__armSettingsGrab = true
    const obs = new MutationObserver(() => {
      if (document.querySelector('[data-testid="settings-dialog"]')) return
      obs.disconnect()
      const bar = document.querySelector('[data-testid="user-menu"]')
      if (bar instanceof HTMLElement) {
        bar.focus()
        bar.click()
      }
    })
    obs.observe(document.body, { childList: true, subtree: true })
    const close = document.querySelector(selector)
    if (!(close instanceof HTMLElement)) {
      resolve({ item: null, bar: document.querySelector('[data-testid="user-menu"]') })
      return
    }
    close.click()
    let frames = 0
    const wait = () => {
      if (host.__settingsGrab) {
        resolve(host.__settingsGrab)
        return
      }
      if (frames++ > 180) {
        resolve({ item: null, bar: document.querySelector('[data-testid="user-menu"]') })
        return
      }
      requestAnimationFrame(wait)
    }
    wait()
  }), closeSelector)
  const item = await bag.evaluateHandle((value) => value.item)
  const bar = await bag.evaluateHandle((value) => value.bar)
  await bag.dispose()
  // Let the overlay pop and the close frame run. This wait is what the assertion measures.
  await page.evaluate(() => new Promise<void>((resolve) => {
    const tick = () => {
      const state = history.state
      const pending = !!state && typeof state === 'object' && (state as { deepapiOverlay?: number }).deepapiOverlay != null
      if (pending) {
        requestAnimationFrame(tick)
        return
      }
      requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    }
    tick()
  }))
  return { item, bar }
}

const expectMenuHeld = async (page: Page, item: ElementHandle<Node>, bar: ElementHandle<Node>) => {
  expect(await item.evaluate((node) => node instanceof Element)).toBe(true)
  expect(await item.evaluate((node) => node instanceof Element && node.isConnected)).toBe(true)
  await expect(page.getByTestId('user-menu')).toHaveAttribute('aria-expanded', 'true')
  const fresh = await page.getByTestId('settings-open').elementHandle()
  expect(fresh).not.toBeNull()
  expect(await item.evaluate((node, other) => other instanceof Element && node === other, fresh)).toBe(true)
  expect(await page.getByTestId('user-menu').evaluate((node, previous) => previous instanceof Element && node === previous, bar)).toBe(true)
  await (item as ElementHandle<Element>).click()
  await expect(page.getByTestId('settings-dialog')).toBeVisible()
}

const closeSelectors = [
  { name: 'settings-close', selector: '[data-testid="settings-close"]' },
  { name: 'dialog 关闭', selector: '[data-testid="settings-dialog"] button[aria-label="关闭"]' },
] as const

for (const width of [1280, 390]) {
  for (const close of closeSelectors) {
    test(`settings ${close.name} close keeps the user menu at ${width}`, async ({ page }) => {
      await boot(page, width)
      await openSettings(page)
      const { item, bar } = await reopenDuringClose(page, close.selector)
      await expectMenuHeld(page, item, bar)
    })
  }

  test(`Back closes the user menu at ${width}`, async ({ page }) => {
    await boot(page, width)
    await page.evaluate(() => history.pushState({ userMenu: 1 }, '', location.href))
    await page.getByTestId('user-menu').click()
    await expect(page.locator('.menu.user-menu')).toBeVisible()
    await page.evaluate(() => history.back())
    await expect(page.locator('.menu.user-menu')).toHaveCount(0)
    await expect(page.getByTestId('user-menu')).toHaveAttribute('aria-expanded', 'false')
  })

  test(`clicking outside closes the user menu at ${width}`, async ({ page }) => {
    await boot(page, width)
    await page.getByTestId('user-menu').click()
    await expect(page.locator('.menu.user-menu')).toBeVisible()
    await page.locator('.side-scroll').click({ position: { x: 16, y: 16 } })
    await expect(page.locator('.menu.user-menu')).toHaveCount(0)
  })

  test(`blur to another control closes the user menu at ${width}`, async ({ page }) => {
    await boot(page, width)
    await page.getByTestId('user-menu').click()
    await expect(page.locator('.menu.user-menu')).toBeVisible()
    await page.getByTestId('composer').focus()
    await expect(page.locator('.menu.user-menu')).toHaveCount(0)
  })
}
