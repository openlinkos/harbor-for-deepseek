// Spec alignment for markdown chrome and SP-MD-424.
import { expect, test, type Page } from '@playwright/test'
import { boot } from './lib/fb1721-boot'

const TEXT = [
  '# 标题',
  '',
  '维持在**33°C**左右。',
  '',
  '> 引用一句',
  '',
  '---',
  '',
  '[例子](https://example.com/a)',
  '',
  '| 甲 | 乙 |',
  '| --- | --- |',
  '| 1 | 2 |',
  '',
  '行内 `code` 结束',
  '',
  '```js',
  'const n = 1',
  '```',
].join('\n')

const reply = () => {
  const ev: unknown[] = [{ type: 'message_start', message: { id: 'm', model: 'deepseek-flash' } }]
  ev.push(
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: TEXT } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null, title: '样式' }, usage: { input_tokens: 1, output_tokens: 1 } },
    { type: 'message_stop' },
  )
  return ev
}

const open = async (page: Page, theme: string) => {
  await boot(page, theme, { body: reply, freezeTransitions: false })
  await page.getByTestId('composer').fill('样式')
  await page.getByTestId('send').click()
  await page.getByTestId('assistant-text').first().waitFor()
  await expect(page.locator('.prose.ds-markdown strong').first()).toHaveText('33°C')
  return page.locator('.prose.ds-markdown').first()
}

const css = (page: Page, selector: string, props: string[]) =>
  page.locator(selector).first().evaluate((el, names) => {
    const style = getComputedStyle(el)
    return Object.fromEntries(names.map((name) => [name, style.getPropertyValue(name)]))
  }, props)

test('SP-MD-424 bold and markdown chrome light', async ({ page }) => {
  const root = await open(page, 'light')
  await expect(root.locator('strong')).toHaveText('33°C')
  await expect(root).not.toContainText('**')
  await expect(root.locator('h1')).toHaveCSS('font-size', '24px')
  await expect(root.locator('strong')).toHaveCSS('font-weight', '600')
  const quote = await css(page, '.prose.ds-markdown blockquote', ['border-left-width', 'border-left-color', 'padding-left', 'margin-top'])
  expect(quote['border-left-width']).toBe('2px')
  expect(quote['border-left-color']).toBe('rgb(173, 178, 184)')
  expect(quote['padding-left']).toBe('14px')
  expect(quote['margin-top']).toBe('16px')
  const rule = await css(page, '.prose.ds-markdown hr', ['height', 'margin-top', 'margin-bottom', 'display', 'background-color'])
  expect(rule.height).toBe('1px')
  expect(rule['margin-top']).toBe('32px')
  expect(rule['margin-bottom']).toBe('32px')
  expect(rule.display).toBe('block')
  expect(rule['background-color']).toBe('rgba(0, 0, 0, 0.1)')
  await expect(root.locator('a').first()).toHaveCSS('color', 'rgb(57, 100, 254)')
  await expect(root.locator('a').first()).toHaveCSS('text-decoration-line', 'none')
  const table = await css(page, '.prose.ds-markdown table', ['border-collapse'])
  expect(table['border-collapse']).toBe('collapse')
  const widths = await page.evaluate(() => {
    const table = document.querySelector('.prose.ds-markdown table') as HTMLElement
    const prose = document.querySelector('.prose') as HTMLElement
    return { table: table.getBoundingClientRect().width, prose: prose.getBoundingClientRect().width, specified: getComputedStyle(table).width }
  })
  expect(widths.table).toBeLessThan(widths.prose - 40)
  await expect(root.locator('th').first()).toHaveCSS('padding-top', '10px')
  await expect(root.locator('th').first()).toHaveCSS('padding-right', '16px')
  await expect(root.locator('code.inline-code')).toHaveCSS('padding-left', '5px')
  await expect(root.locator('code.inline-code')).toHaveCSS('padding-right', '5px')
  await expect(root.locator('.md-code-block')).toHaveCSS('margin-top', '16px')
  await expect(root.locator('.ds-markdown-code-copy-button')).toContainText('复制')
  await expect(root.locator('.markdown-table-wrapper')).toHaveCSS('overflow-x', 'auto')
})

test('SP-MD markdown chrome dark', async ({ page }) => {
  const root = await open(page, 'dark')
  const quote = await css(page, '.prose.ds-markdown blockquote', ['border-left-color'])
  expect(quote['border-left-color']).toBe('rgb(129, 133, 140)')
  await expect(root.locator('a').first()).toHaveCSS('color', 'rgb(103, 158, 254)')
  const rule = await css(page, '.prose.ds-markdown hr', ['background-color'])
  expect(rule['background-color']).toBe('rgba(255, 255, 255, 0.12)')
  await expect(root).toHaveCSS('color', 'rgb(249, 250, 251)')
})
