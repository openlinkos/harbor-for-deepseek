import { expect, test, type Page, type Route } from '@playwright/test'

const SEMVER = /^\d+\.\d+\.\d+$/

const fulfill = async (route: Route) => {
  const url = route.request().url()
  if (url.endsWith('/user/balance')) {
    await route.fulfill({ json: { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '1.00', granted_balance: '0.00', topped_up_balance: '1.00' }] } })
    return
  }
  if (url.endsWith('/models')) {
    await route.fulfill({ json: { data: [{ id: 'deepseek-flash' }] } })
    return
  }
  await route.fulfill({ status: 404, json: { error: { message: 'not mocked' } } })
}

const boot = async (page: Page, theme: 'light' | 'dark') => {
  await page.route('https://api.deepseek.com/**', fulfill)
  await page.addInitScript((value) => localStorage.setItem('deepapi-theme', value), theme)
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()
}

const openTerms = async (page: Page) => {
  const narrow = (page.viewportSize()?.width ?? 1440) < 768
  if (narrow && (await page.locator('.nav-open').count()) === 0) {
    await page.getByTestId('menu').click()
    await page.waitForTimeout(300)
  }
  await page.getByTestId('user-menu').click()
  await page.getByTestId('settings-open').click()
  await page.getByRole('button', { name: '服务协议' }).click()
  await expect(page.locator('.settings-shell')).toHaveAttribute('data-tab', 'legal')
}

for (const theme of ['light', 'dark'] as const) {
  for (const [width, height] of [[1440, 900], [390, 844]] as const) {
    test(`服务协议 shows DeepAPI v<semver> matching /version.json (${theme} ${width})`, async ({ page }) => {
      await page.setViewportSize({ width, height })
      await boot(page, theme)
      await openTerms(page)
      const response = await page.request.get('/version.json')
      expect(response.ok()).toBe(true)
      expect(response.headers()['cache-control']).toBe('no-store')
      const body = (await response.json()) as { version: string; commit: string; builtAt: string }
      expect(body.version).toMatch(SEMVER)
      expect(body.commit).toMatch(/^(?:[0-9a-f]{40}|unknown)$/)
      expect(Number.isNaN(Date.parse(body.builtAt))).toBe(false)

      const label = page.getByTestId('product-version')
      await label.scrollIntoViewIfNeeded()
      await expect(label).toBeVisible()
      await expect(label).toHaveText(`DeepAPI v${body.version}`)
      const text = (await label.innerText()).trim()
      expect(text.startsWith('DeepAPI v')).toBe(true)
      expect(text.slice('DeepAPI v'.length)).toBe(body.version)
      expect(text).not.toContain(body.commit)

      const short = body.commit === 'unknown' ? 'unknown' : body.commit.slice(0, 7)
      await expect(label).toHaveAttribute('title', short)
      await expect(label).toHaveAttribute('data-commit', short)
      expect(text).not.toContain(short === 'unknown' ? 'unknown-sha' : short)

      const place = await label.evaluate((node) => {
        const legal = node.parentElement
        const last = legal?.lastElementChild === node
        const footer = legal?.querySelector('[data-testid="site-footer"]')
        const belowFooter = footer ? node.getBoundingClientRect().top >= footer.getBoundingClientRect().top : false
        const style = getComputedStyle(node)
        return {
          last,
          belowFooter,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          lineHeight: style.lineHeight,
          color: style.color,
        }
      })
      expect(place.last).toBe(true)
      expect(place.belowFooter).toBe(true)
      expect(place.fontSize).toBe('12px')
      expect(place.fontWeight).toBe('400')
      expect(place.lineHeight).toBe('18px')
      expect(place.color).toBe(theme === 'dark' ? 'rgb(173, 178, 184)' : 'rgb(129, 133, 140)')
      if (theme === 'dark') await expect(page.locator('body')).toHaveAttribute('data-ds-dark-theme', '')
      else await expect(page.locator('body')).not.toHaveAttribute('data-ds-dark-theme', '')
    })
  }
}
