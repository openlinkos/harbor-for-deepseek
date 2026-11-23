// Language and safety use the settings select skin. The read-link control is the switch.
// Theme cards stay on the settings-2 geometry. Hint color stays tertiary.
import { expect, test, type Page, type Route } from '@playwright/test'

const install = async (page: Page) => {
  await page.route('https://api.deepseek.com/**', async (route: Route) => {
    const url = route.request().url()
    if (url.endsWith('/user/balance')) return route.fulfill({ json: { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '1', granted_balance: '0', topped_up_balance: '1' }] } })
    if (url.endsWith('/models')) return route.fulfill({ json: { data: [{ id: 'deepseek-flash' }] } })
    return route.fulfill({ status: 404, json: {} })
  })
}

const openSettings = async (page: Page) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await install(page)
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await page.getByTestId('user-menu').click()
  await page.getByTestId('settings-open').click()
  await expect(page.getByTestId('settings-dialog')).toBeVisible()
}

test('settings select, menu, and switch match the settings skin', async ({ page }) => {
  await openSettings(page)
  const trigger = page.getByTestId('language-trigger')
  const label = page.locator('.settings-line', { has: trigger }).locator('> span').first()
  await expect(label).toHaveCSS('color', 'rgb(97, 102, 107)')
  await expect(label).toHaveCSS('font-size', '14px')
  await expect(label).toHaveCSS('line-height', '22px')
  await expect(trigger).toHaveCSS('display', 'flex')
  await expect(trigger).toHaveCSS('height', '36px')
  await expect(trigger).toHaveCSS('min-width', '90px')
  await expect(trigger).toHaveCSS('padding', '0px 28px 0px 10px')
  await expect(trigger).toHaveCSS('border-radius', '18px')
  await expect(trigger).toHaveCSS('font-size', '14px')
  await expect(trigger).toHaveCSS('line-height', '22px')
  await expect(trigger).toHaveCSS('color', 'rgb(15, 17, 21)')
  await expect(trigger).toHaveCSS('background-color', 'rgb(241, 243, 245)')
  await expect(trigger).toHaveCSS('cursor', 'pointer')
  await expect(trigger).toHaveCSS('box-shadow', 'none')
  await trigger.hover()
  await expect(trigger).toHaveCSS('background-color', 'rgba(38, 49, 72, 0.14)')
  const arrow = await trigger.locator('svg').evaluate((el) => {
    const style = getComputedStyle(el)
    return { right: style.right, width: style.width, height: style.height, color: style.color, top: style.top, transform: style.transform }
  })
  expect(arrow).toEqual({ right: '14px', width: '14px', height: '14px', color: 'rgb(97, 102, 107)', top: '18px', transform: 'matrix(1, 0, 0, 1, 0, -7)' })

  await trigger.click()
  await expect(trigger).toHaveCSS('color', 'rgb(129, 133, 140)')
  const menu = page.getByTestId('language-trigger-menu')
  await expect(menu).toHaveCSS('padding', '4px')
  await expect(menu).toHaveCSS('border-radius', '12px')
  await expect(menu).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(menu).toHaveCSS('border-top-color', 'rgba(0, 0, 0, 0)')
  await expect(menu).toHaveCSS('min-width', '200px')
  await expect(menu).toHaveCSS('max-width', '280px')
  await expect(menu).toHaveCSS('width', '200px')
  const option = menu.getByRole('option', { name: 'English' })
  const selected = menu.getByRole('option', { selected: true })
  await expect(option).toHaveCSS('height', '40px')
  await expect(option).toHaveCSS('padding', '8px 10px')
  await expect(option).toHaveCSS('border-radius', '10px')
  await expect(option).toHaveCSS('font-size', '14px')
  await expect(option).toHaveCSS('line-height', '24px')
  await expect(option).toHaveCSS('color', 'rgb(15, 17, 21)')
  await expect(selected).toHaveCSS('color', 'rgb(15, 17, 21)')
  await expect(selected).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await option.hover()
  await expect(option).toHaveCSS('background-color', 'rgba(38, 49, 72, 0.06)')
  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
  const safety = page.getByTestId('safety-select')
  await safety.click()
  await expect(page.getByTestId('safety-select-menu')).toHaveCSS('min-width', '124px')
  await expect(page.getByTestId('safety-select-menu')).toHaveCSS('max-width', '280px')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('safety-select-menu')).toBeHidden()

  const sw = page.getByTestId('toggle-read')
  await expect(sw).toHaveCSS('width', '40px')
  await expect(sw).toHaveCSS('height', '24px')
  await expect(sw).toHaveCSS('border-radius', '4096px')
  await expect(sw).toHaveCSS('background-color', 'rgb(173, 178, 184)')
  await expect(sw).toHaveCSS('cursor', 'pointer')
  const knob = await sw.locator('.knob').evaluate((el) => {
    const style = getComputedStyle(el)
    return { top: style.top, left: style.left, width: style.width, height: style.height, background: style.backgroundColor, transform: style.transform }
  })
  expect(knob).toEqual({ top: '12px', left: '3px', width: '18px', height: '18px', background: 'rgb(255, 255, 255)', transform: 'matrix(1, 0, 0, 1, 0, -9)' })
  // focus() on an already-focused button does not enter :focus-visible.
  // The ring transitions, so the used box-shadow is read after it settles.
  await sw.evaluate((el) => {
    const node = el as HTMLElement
    node.blur()
    node.focus({ focusVisible: true })
  })
  await expect.poll(async () => sw.evaluate((el) => {
    const node = el as HTMLElement
    return `${node.matches(':focus-visible')} ${getComputedStyle(node, '::after').boxShadow}`
  })).toContain('true rgb(57, 100, 254)')
  await sw.click()
  await expect(sw).toHaveCSS('background-color', 'rgb(57, 100, 254)')
  await expect(sw.locator('.knob')).toHaveCSS('left', '19px')

  await page.getByRole('button', { name: '深色' }).click()
  await expect(page.locator('body')).toHaveAttribute('data-ds-dark-theme', '')
  await expect(trigger).toHaveCSS('background-color', 'rgb(67, 69, 74)')
  await expect(trigger).toHaveCSS('color', 'rgb(249, 250, 251)')
  await trigger.hover()
  await expect(trigger).toHaveCSS('background-color', 'rgba(255, 255, 255, 0.24)')
  const darkArrow = await trigger.locator('svg').evaluate((el) => getComputedStyle(el).color)
  expect(darkArrow).toBe('rgb(207, 211, 214)')
  await sw.click()
  await expect(sw).toHaveCSS('background-color', 'rgb(129, 133, 140)')
  await sw.click()
  await expect(sw).toHaveCSS('background-color', 'rgb(86, 134, 254)')
  await trigger.click()
  const darkMenu = page.getByTestId('language-trigger-menu')
  await expect(darkMenu).toHaveCSS('background-color', 'rgb(53, 54, 56)')
  await expect(darkMenu).toHaveCSS('border-top-color', 'rgba(255, 255, 255, 0.06)')
  const darkOption = darkMenu.getByRole('option', { name: 'English' })
  await expect(darkOption).toHaveCSS('color', 'rgb(249, 250, 251)')
  await darkOption.hover()
  await expect(darkOption).toHaveCSS('background-color', 'rgba(255, 255, 255, 0.08)')

  await page.getByTestId('settings-nav-data').click()
  const hint = page.locator('.settings-line.stack', { hasText: '导出所有历史对话' }).locator('.settings-copy .hint')
  await expect(hint).toHaveCSS('color', 'rgb(207, 211, 214)')
  await expect(hint).toHaveCSS('min-height', '22px')
  await expect(hint).toHaveCSS('padding-top', '2px')
  await page.evaluate(() => document.body.removeAttribute('data-ds-dark-theme'))
  await expect(hint).toHaveCSS('color', 'rgb(97, 102, 107)')
})
