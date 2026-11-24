// SP-GL-017, 021, 033, 042, 086, 145, 147, 229–236.
// Body uses the quote-cjk-patch / Inter stack. The 14px link icon is not this region.
import { expect, test } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { boot } from './lib/fb1721-boot'

const readVars = () => {
  const names = new Set<string>()
  const walk = (rules: CSSRuleList) => {
    for (const rule of rules) {
      const style = (rule as CSSStyleRule).style
      if (style) {
        for (let i = 0; i < style.length; i += 1) {
          const name = style.item(i)
          if (name.startsWith('--')) names.add(name)
        }
      }
      const nested = (rule as CSSGroupingRule).cssRules
      if (nested) walk(nested)
    }
  }
  for (const sheet of document.styleSheets) {
    try {
      walk(sheet.cssRules)
    } catch {
      // Cross-origin sheets are not part of the app bundle.
    }
  }
  const body = getComputedStyle(document.body)
  const root = getComputedStyle(document.documentElement)
  const pick = (style: CSSStyleDeclaration) => {
    const out: Record<string, string> = {}
    for (const name of names) out[name] = style.getPropertyValue(name).trim()
    return out
  }
  let face = false
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if (rule.cssText.includes('quote-cjk-patch') && rule.cssText.includes('PingFangSC-Regular')) face = true
      }
    } catch {
      // ignore
    }
  }
  return {
    fontFamily: body.fontFamily,
    fontToken: body.getPropertyValue('--dsw-font-family').trim(),
    fontSize: body.fontSize,
    lineHeight: body.lineHeight,
    overflow: body.overflow,
    color: body.color,
    appHeight: body.getPropertyValue('--app-height').trim(),
    innerHeight: `${window.innerHeight}px`,
    maxWidth: body.getPropertyValue('--message-list-max-width').trim(),
    pad: body.getPropertyValue('--message-list-padding-horizontal').trim(),
    blue500: body.getPropertyValue('--dsw-static-blue-500').trim(),
    slot: getComputedStyle(document.querySelector('.sidebar') ?? document.body).getPropertyValue('--sider-top-slot-height').trim(),
    classes: document.body.className,
    darkAttr: document.body.hasAttribute('data-ds-dark-theme'),
    face,
    body: {
      fontFamily: body.fontFamily,
      fontSize: body.fontSize,
      lineHeight: body.lineHeight,
      overflow: body.overflow,
      color: body.color,
      margin: body.margin,
      backgroundColor: body.backgroundColor,
      wordBreak: body.wordBreak,
      fontFeatureSettings: body.fontFeatureSettings,
      webkitFontSmoothing: body.getPropertyValue('-webkit-font-smoothing'),
      tap: body.getPropertyValue('-webkit-tap-highlight-color'),
      textSizeAdjust: body.getPropertyValue('-webkit-text-size-adjust'),
    },
    light: pick(body),
    root: pick(root),
  }
}

test('quote-cjk-patch stack and body tokens', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 820 })
  await boot(page, 'light', { freezeTransitions: false })
  const wide = await page.evaluate(readVars)
  expect(wide.fontFamily.toLowerCase()).toContain('quote-cjk-patch')
  expect(wide.fontFamily).toContain('Inter')
  expect(wide.fontToken.toLowerCase()).toContain('quote-cjk-patch')
  expect(wide.fontToken).toContain('Inter')
  expect(wide.fontSize).toBe('14px')
  expect(wide.lineHeight).toBe('normal')
  expect(wide.overflow).toBe('hidden')
  expect(wide.color).toBe('rgb(128, 0, 128)')
  expect(wide.appHeight).toBe(wide.innerHeight)
  expect(wide.maxWidth).toBe('840px')
  expect(wide.pad).toBe('44px')
  expect(wide.blue500.replace(/\s/g, '').toLowerCase()).toMatch(/^(#3b82f6|rgb\(59,130,246\))$/)
  expect(wide.classes).toContain('light')
  expect(wide.classes).toContain('zh_CN')
  expect(wide.darkAttr).toBe(false)
  expect(wide.face).toBe(true)
  expect(wide.slot).toBe('40px')

  await page.setViewportSize({ width: 800, height: 820 })
  const narrow = await page.evaluate(() => ({
    maxWidth: getComputedStyle(document.body).getPropertyValue('--message-list-max-width').trim(),
    pad: getComputedStyle(document.body).getPropertyValue('--message-list-padding-horizontal').trim(),
  }))
  expect(narrow.maxWidth).toBe('712px')
  expect(narrow.pad).toBe('36px')

  await page.evaluate(() => document.body.setAttribute('data-ds-dark-theme', ''))
  const darkMask = await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--dsw-alias-bg-mask-1').trim())
  expect(darkMask.replace(/\s/g, '').replace(/\.50?\b/, '.5')).toMatch(/rgba\(0,0,0,\.?5\)/)
  const darkVars = await page.evaluate(readVars)
  if (process.env.LEDGER_DUMP) {
    writeFileSync(process.env.LEDGER_DUMP, JSON.stringify({ light: wide.light, root: wide.root, dark: darkVars.light, body: wide.body, narrow }))
  }
})
