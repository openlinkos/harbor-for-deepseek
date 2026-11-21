import { expect, test } from '@playwright/test'
import { saveShot } from './lib/parity-shots'

test('reload shows the shell skeleton before the app attaches', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('deepapi-boot-hold', '1'))
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  const skeleton = page.getByTestId('boot-skeleton')
  await expect(skeleton).toBeVisible()
  await expect(page.getByTestId('composer')).toHaveCount(0)
  const bar = skeleton.locator('.boot-title-bar')
  await expect(bar).toBeVisible()
  await expect(bar).toHaveCSS('background-color', 'rgba(0, 0, 0, 0.04)')
  const box = await bar.boundingBox()
  expect(box && box.width).toBeGreaterThan(40)
  expect(box && box.height).toBeGreaterThan(8)
  await saveShot(page, 'refresh-mid-02-right-after-reload-skeleton-loading.png')
  await page.evaluate(() => window.dispatchEvent(new Event('deepapi-boot-release')))
  await expect(page.getByTestId('landing-send')).toBeVisible()
  await expect(skeleton).toHaveCount(0)
})
