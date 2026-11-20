// Settings inline buttons and dialog buttons match chat.deepseek.com ds-button
// (main.dc093a796f.css .ds-button--m, plus official-fb1344 settingsButton).
// Discovers button, [role=button], and label:has(input[type=file]) on every settings page.
import { expect, test, type Page, type Route } from '@playwright/test'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const OFF = {
  h: 36,
  minW: 72,
  padX: '14px',
  padY: '0px',
  fontSize: '14px',
  lineHeight: '22px',
  radius: '4096px',
  weight: '400',
  primaryWeight: '500',
  border: { light: 'rgba(0, 0, 0, 0.1)', dark: 'rgba(255, 255, 255, 0.12)' },
  danger: { light: 'rgb(236, 19, 19)', dark: 'rgb(242, 90, 90)' },
  bg: 'rgba(0, 0, 0, 0)',
  primaryBg: { light: 'rgb(57, 100, 254)', dark: 'rgb(86, 134, 254)' },
  primaryText: 'rgb(255, 255, 255)',
}

const sse = (events: unknown[]) => events.map((event) => `event: ${(event as { type: string }).type}\ndata: ${JSON.stringify(event)}\n\n`).join('')
const reply = [
  { type: 'message_start', message: { id: 'req-btn', model: 'deepseek-flash' } },
  { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '按钮导出样本' } },
  { type: 'content_block_stop', index: 0 },
  { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null, title: '按钮样本' }, usage: { input_tokens: 1, output_tokens: 1 } },
  { type: 'message_stop' },
]

const install = async (page: Page) => {
  await page.route('https://api.deepseek.com/**', async (route: Route) => {
    const url = route.request().url()
    if (url.endsWith('/user/balance')) {
      await route.fulfill({ json: { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '1.00', granted_balance: '0.00', topped_up_balance: '1.00' }] } })
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
    await route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse(reply) })
  })
}

const boot = async (page: Page, theme: string) => {
  await install(page)
  await page.addInitScript((value) => localStorage.setItem('deepapi-theme', value), theme)
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()
}

const openSettings = async (page: Page, tab?: string) => {
  const narrow = (page.viewportSize()?.width ?? 1440) < 768
  if (narrow && (await page.locator('.nav-open').count()) === 0) {
    await page.getByTestId('menu').click()
    await page.waitForTimeout(300)
  }
  if ((await page.getByTestId('settings-dialog').count()) === 0 || !(await page.getByTestId('settings-dialog').isVisible())) {
    await page.getByTestId('user-menu').click()
    await page.getByTestId('settings-open').click()
  }
  await page.getByRole('button', { name: '通用设置' }).waitFor()
  if (tab) await page.getByRole('button', { name: tab }).click()
  await page.locator('.settings-shell').evaluate(async (node) => {
    await Promise.all(node.getAnimations().map((animation) => animation.finished))
  })
}

type Measured = {
  tag: string
  text: string
  row: string
  dialog: string | null
  w: number
  h: number
  right: number
  padL: string
  padR: string
  padT: string
  padB: string
  fontSize: string
  lineHeight: string
  fontWeight: string
  radius: string
  border: string
  borderWidth: string
  bg: string
  color: string
  dx: number | null
  dy: number | null
  variant: string
  lineRight: number | null
}

const measure = (page: Page, onlyDialog?: string) => page.evaluate((only) => {
  const r1 = (value: number) => Math.round(value * 10) / 10
  const visible = (el: Element | null) => {
    if (!el || !el.isConnected) return false
    const rect = el.getBoundingClientRect()
    if (rect.width < 0.5 || rect.height < 0.5) return false
    for (let node: Element | null = el; node && node.nodeType === 1; node = node.parentElement) {
      const style = getComputedStyle(node)
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false
    }
    return true
  }
  const textBox = (el: Element) => {
    const rects: DOMRect[] = []
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: (node) => (node.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) })
    let node = walker.nextNode()
    while (node) {
      if (node.parentElement && visible(node.parentElement)) {
        const range = document.createRange()
        range.selectNodeContents(node)
        for (const rect of range.getClientRects()) rects.push(rect)
      }
      node = walker.nextNode()
    }
    const live = rects.filter((rect) => rect.width > 0 && rect.height > 0)
    if (!live.length) return null
    const x = Math.min(...live.map((rect) => rect.left))
    const y = Math.min(...live.map((rect) => rect.top))
    const right = Math.max(...live.map((rect) => rect.right))
    const bottom = Math.max(...live.map((rect) => rect.bottom))
    return { x: r1(x), y: r1(y), w: r1(right - x), h: r1(bottom - y) }
  }
  const roots = [...document.querySelectorAll('[role=dialog]')].filter(visible)
  const found: Array<{
    tag: string
    text: string
    row: string
    dialog: string | null
    w: number
    h: number
    right: number
    padL: string
    padR: string
    padT: string
    padB: string
    fontSize: string
    lineHeight: string
    fontWeight: string
    radius: string
    border: string
    borderWidth: string
    bg: string
    color: string
    dx: number | null
    dy: number | null
    variant: string
    lineRight: number | null
  }> = []
  for (const root of roots) {
    const dialog = root.getAttribute('data-testid')
    if (only && dialog !== only) continue
    const nodes = [...root.querySelectorAll('button, [role=button], label:has(input[type=file])')]
    for (const el of nodes) {
      if (!(el instanceof HTMLElement) || !visible(el)) continue
      if (el.closest('nav, .settings-nav, .anchored-menu, .theme-cards')) continue
      if (el.matches('.switch, .settings-x, .chip, .icon-btn')) continue
      const text = el.textContent?.replace(/\s+/g, ' ').trim() ?? ''
      if (!text) continue
      const rect = el.getBoundingClientRect()
      const style = getComputedStyle(el)
      const glyphs = textBox(el)
      let border = style.borderTopColor
      let borderWidth = style.borderTopWidth
      if (!(parseFloat(borderWidth) > 0) || style.borderTopStyle === 'none') {
        for (const child of el.children) {
          const childStyle = getComputedStyle(child)
          if (childStyle.position === 'absolute' && parseFloat(childStyle.borderTopWidth) > 0 && childStyle.borderTopStyle !== 'none') {
            border = childStyle.borderTopColor
            borderWidth = childStyle.borderTopWidth
            break
          }
        }
      }
      let bg = style.backgroundColor
      if (/rgba\(\d+, \d+, \d+, 0\)/.test(bg)) {
        for (const child of el.children) {
          const name = typeof child.className === 'string' ? child.className : ''
          if (name.includes('background')) bg = getComputedStyle(child).backgroundColor
        }
      }
      const variant = el.classList.contains('ds-button--error')
        ? 'danger'
        : el.classList.contains('ds-button--primary')
          ? 'primary'
          : 'outlined'
      const rowEl = el.closest('.settings-line, .edit-actions')
      found.push({
        tag: el.tagName.toLowerCase(),
        text: text.slice(0, 24),
        row: (rowEl?.querySelector(':scope > span')?.textContent || rowEl?.className || '').toString().replace(/\s+/g, ' ').trim().slice(0, 24),
        dialog,
        w: r1(rect.width),
        h: r1(rect.height),
        right: r1(rect.right),
        padL: style.paddingLeft,
        padR: style.paddingRight,
        padT: style.paddingTop,
        padB: style.paddingBottom,
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
        fontWeight: style.fontWeight,
        radius: style.borderTopLeftRadius,
        border,
        borderWidth,
        bg,
        color: style.color,
        dx: glyphs ? r1(glyphs.x + glyphs.w / 2 - (rect.x + rect.width / 2)) : null,
        dy: glyphs ? r1(glyphs.y + glyphs.h / 2 - (rect.y + rect.height / 2)) : null,
        variant,
        lineRight: rowEl ? r1(rowEl.getBoundingClientRect().right) : null,
      })
    }
  }
  return found
}, onlyDialog)

const problems = (buttons: Measured[], theme: 'light' | 'dark', alignColumn: boolean) => {
  const bad: string[] = []
  const column = buttons.filter((button) => button.dialog !== 'confirm-dialog')
  const trailingRight = (button: Measured) => {
    const mates = column.filter((other) => other.row === button.row && other.dialog === button.dialog)
    return Math.max(...mates.map((other) => other.right))
  }
  const trails = [...new Set(column.map((button) => trailingRight(button)))]
  const columnRight = trails.length ? Math.max(...trails) : 0
  for (const button of buttons) {
    const where = `${button.dialog ?? 'settings'}/${button.row}/${button.tag}:${button.text}`
    const issues: string[] = []
    if (!button.tag.match(/^(button|a)$/) && button.tag !== 'label') issues.push(`tag=${button.tag}`)
    if (Math.abs(button.h - OFF.h) > 0.5) issues.push(`h=${button.h}`)
    if (button.w < OFF.minW - 0.5) issues.push(`w=${button.w}`)
    if (button.padL !== OFF.padX || button.padR !== OFF.padX) issues.push(`padX=${button.padL}/${button.padR}`)
    if (button.padT !== OFF.padY || button.padB !== OFF.padY) issues.push(`padY=${button.padT}/${button.padB}`)
    if (button.fontSize !== OFF.fontSize) issues.push(`font=${button.fontSize}`)
    if (button.lineHeight !== OFF.lineHeight) issues.push(`lh=${button.lineHeight}`)
    if (button.radius !== OFF.radius) issues.push(`radius=${button.radius}`)
    if (button.variant === 'primary') {
      if (button.fontWeight !== OFF.primaryWeight) issues.push(`weight=${button.fontWeight}`)
      if (button.bg !== OFF.primaryBg[theme]) issues.push(`bg=${button.bg}`)
      if (button.color !== OFF.primaryText) issues.push(`color=${button.color}`)
      if (button.borderWidth !== '0px') issues.push(`border=${button.borderWidth} ${button.border}`)
    } else {
      if (button.fontWeight !== OFF.weight) issues.push(`weight=${button.fontWeight}`)
      if (button.bg !== OFF.bg) issues.push(`bg=${button.bg}`)
      const border = button.variant === 'danger' ? OFF.danger[theme] : OFF.border[theme]
      if (button.border !== border) issues.push(`border=${button.border}`)
      if (button.borderWidth !== '1px') issues.push(`borderWidth=${button.borderWidth}`)
    }
    if (button.dx === null || Math.abs(button.dx) > 1 || button.dy === null || Math.abs(button.dy) > 1) issues.push(`textOff=${button.dx},${button.dy}`)
    const trailing = button.dialog !== 'confirm-dialog' && button.right === trailingRight(button)
    if (alignColumn && trailing && Math.abs(button.right - columnRight) > 1) issues.push(`right=${button.right}≠${columnRight}`)
    if (alignColumn && trailing && button.lineRight != null && Math.abs(button.right - button.lineRight) > 1) {
      issues.push(`right=${button.right}≠line ${button.lineRight}`)
    }
    if (issues.length) bad.push(`${where} ${issues.join(' ')}`)
  }
  return bad
}

const PAGES = [
  { tab: undefined, name: '通用设置', mark: '界面包', min: 2 },
  { tab: '账号管理', name: '账号管理', mark: '余额', min: 3 },
  { tab: '数据管理', name: '数据管理', mark: '导入 JSON', min: 7 },
  { tab: '服务协议', name: '服务协议', mark: 'DeepAPI 是一个独立的聊天客户端', min: 0 },
] as const

for (const theme of ['light', 'dark'] as const) {
  for (const [width, height] of [[1440, 900], [390, 844]] as const) {
    test.describe(`settings buttons ${theme} ${width}`, () => {
      test.use({ viewport: { width, height }, colorScheme: theme })
      test('every settings and dialog button matches the official ds-button', async ({ page }) => {
        await boot(page, theme)
        for (const item of PAGES) {
          await openSettings(page, item.tab)
          await expect(page.getByTestId('settings-dialog')).toContainText(item.mark)
          const buttons = await measure(page)
          if (item.min === 0) expect(buttons, item.name).toEqual([])
          else expect(buttons.length, `${item.name} discovered ${buttons.length}`).toBeGreaterThanOrEqual(item.min)
          const labels = buttons.filter((button) => button.tag === 'label')
          const bad = problems(buttons, theme, true)
          expect(bad, [`${item.name} labels=${labels.length}`, ...bad].join('\n')).toEqual([])
          if (item.name === '数据管理') {
            const wrapped = await page.locator('[data-testid=settings-dialog] label:has(input[type=file])').count()
            expect(wrapped).toBe(0)
            const files = page.locator('[data-testid=settings-dialog] input[type=file]')
            expect(await files.count()).toBeGreaterThanOrEqual(3)
            const count = await files.count()
            for (let index = 0; index < count; index += 1) {
              const paired = await files.nth(index).evaluate((input) => input.parentElement?.querySelector('button.ds-button') != null)
              expect(paired).toBe(true)
            }
          }
        }
        await openSettings(page, '数据管理')
        await page.locator('.settings-line', { hasText: '删除所有对话' }).getByRole('button', { name: '删除' }).click()
        await page.getByTestId('confirm-dialog').waitFor()
        await page.getByTestId('confirm-dialog').evaluate(async (node) => {
          await Promise.all(node.getAnimations().map((animation) => animation.finished))
        })
        const dialogButtons = await measure(page, 'confirm-dialog')
        expect(dialogButtons.map((button) => button.text)).toEqual(['取消', '删除'])
        const bad = problems(dialogButtons, theme, false)
        expect(bad, bad.join('\n')).toEqual([])
        const rowRight = dialogButtons[0]?.lineRight ?? 0
        const trailing = Math.max(...dialogButtons.map((button) => button.right))
        expect(Math.abs(trailing - rowRight)).toBeLessThanOrEqual(1)
        await page.getByRole('button', { name: '取消' }).click()
        await expect(page.getByTestId('confirm-dialog')).toBeHidden()
      })
    })
  }
}

test('import and export still round-trip through the settings buttons', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await boot(page, 'light')
  await page.getByTestId('composer').fill('按钮导出样本')
  await page.getByTestId('send').click()
  await expect(page.getByTestId('assistant-text')).toContainText('按钮导出样本')
  await openSettings(page, '数据管理')

  const [jsonDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-json').click(),
  ])
  const exported = join(process.cwd(), 'test-results/settings-export.json')
  mkdirSync(dirname(exported), { recursive: true })
  await jsonDownload.saveAs(exported)
  const raw = readFileSync(exported, 'utf8')
  expect(raw).toContain('按钮导出样本')
  expect(raw).toContain('"format": "deepapi"')
  expect(raw).not.toContain('demo-local-key')

  const jsonRow = page.locator('.settings-line', { hasText: '导入 JSON' })
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    jsonRow.getByRole('button', { name: '导入' }).click(),
  ])
  await chooser.setFiles(exported)
  await expect(page.getByTestId('import-toast')).toContainText('跳过')

  await page.getByTestId('import-as-copy').click()
  await page.getByTestId('import-json').setInputFiles(exported)
  await expect(page.getByTestId('import-toast')).toContainText('已导入')
  await page.getByTestId('import-toast').getByRole('button', { name: '关闭' }).click()
  await expect(page.getByTestId('import-toast')).toBeHidden()

  const [zipDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-zip').click(),
  ])
  expect(zipDownload.suggestedFilename()).toMatch(/\.zip$/)
  const zipRow = page.locator('.settings-line', { hasText: '导入 v3 ZIP' })
  const [zipChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    zipRow.getByRole('button', { name: '导入' }).click(),
  ])
  const zipPath = join(process.cwd(), 'test-results/settings-export.zip')
  await zipDownload.saveAs(zipPath)
  await zipChooser.setFiles(zipPath)
  await expect(page.getByTestId('import-toast')).toContainText('已导入')
})
