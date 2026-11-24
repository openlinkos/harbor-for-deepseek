// Shell, desktop sidebar, phone drawer, and the breakpoint rules this pass aligned.
import { expect, test } from '@playwright/test'
import { boot } from './lib/fb1721-boot'

test('desktop shell fills the viewport and the sidebar stays a 261px column', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 820 })
  await boot(page, 'light', { freezeTransitions: false })
  const shell = page.locator('.shell')
  await expect(shell).toHaveCSS('position', 'absolute')
  await expect(shell).toHaveCSS('top', '0px')
  await expect(shell).toHaveCSS('right', '0px')
  await expect(shell).toHaveCSS('bottom', '0px')
  await expect(shell).toHaveCSS('left', '0px')
  await expect(shell).toHaveCSS('display', 'flex')
  const box = await page.evaluate(() => {
    const shellBox = document.querySelector('.shell')!.getBoundingClientRect()
    const sideBox = document.querySelector('.sidebar')!.getBoundingClientRect()
    const stage = getComputedStyle(document.querySelector('.stage')!)
    const root = getComputedStyle(document.documentElement)
    return {
      shellW: shellBox.width,
      shellH: shellBox.height,
      sideW: sideBox.width,
      sideH: sideBox.height,
      stageMin: stage.minWidth,
      ligatures: root.fontVariantLigatures,
    }
  })
  expect(box.shellW).toBe(1440)
  expect(box.shellH).toBe(820)
  expect(box.sideW).toBe(261)
  expect(Math.abs(box.sideH - box.shellH)).toBeLessThanOrEqual(1)
  expect(box.stageMin).toBe('384px')
  expect(box.ligatures).toBe('no-contextual')
  const side = page.locator('.sidebar')
  await expect(side).toHaveCSS('position', 'relative')
  // SP-GL-129 / SP-SB-570. Desktop in-flow sider is z-index 8.
  await expect(side).toHaveCSS('z-index', '8')
  await expect(side).toHaveCSS('max-width', '261px')
  await expect(side).toHaveCSS('min-width', '0px')
  const motion = await side.evaluate((node) => getComputedStyle(node).transitionDuration)
  expect(motion).toContain('0.3s')

  await page.getByRole('button', { name: '收起边栏' }).click()
  await expect(side).toHaveCSS('width', '0px')
  await expect(side).toHaveCSS('max-width', '0px')
  await expect(side).toHaveCSS('transform', 'none')
})

test('phone drawer, scrim, search card, and textarea floor', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await boot(page, 'light', { freezeTransitions: false })
  const side = page.locator('.sidebar')
  await expect(side).toBeHidden()
  await expect(side).toHaveCSS('z-index', '15')
  await expect(side).toHaveCSS('position', 'fixed')
  await page.getByTestId('menu').click()
  await expect(side).toBeVisible()
  await expect(side).toHaveCSS('z-index', '1002')
  const width = await side.evaluate((node) => Math.round(node.getBoundingClientRect().width))
  expect(width).toBe(261)
  const scrim = page.locator('.scrim')
  await expect(scrim).toHaveCSS('z-index', '1001')
  await expect(scrim).toHaveCSS('opacity', '1')
  await expect(scrim).toHaveCSS('background-color', 'rgba(0, 0, 0, 0.4)')
  await scrim.click({ position: { x: 320, y: 400 } })
  await expect(side).toBeHidden()

  await expect(page.locator('.composer textarea')).toHaveCSS('min-height', '42px')
  await page.keyboard.press('Control+k')
  const dialog = page.locator('.search-dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveCSS('width', '390px')
  await expect(dialog).toHaveCSS('height', '844px')
  await expect(dialog).toHaveCSS('border-radius', '0px')
  const rule = await dialog.evaluate((node) => getComputedStyle(node, '::before').borderBottomWidth)
  expect(rule).toBe('1px')
})
