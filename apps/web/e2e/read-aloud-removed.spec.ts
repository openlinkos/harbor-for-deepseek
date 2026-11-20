import { expect, test, type Page, type Route } from '@playwright/test'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const shots = existsSync('/opt/cursor/artifacts')
  ? '/opt/cursor/artifacts/read-aloud'
  : join(process.cwd(), '../../tmp/read-aloud-shots')
mkdirSync(shots, { recursive: true })

const READ_ALOUD = /朗读|音色|贝壳|白浪|海星|暗潮|Read aloud|Read-aloud|speechSynthesis|SpeechSynthesis/

const sse = (events: unknown[]) =>
  `${events.map((event) => `event: ${(event as { type: string }).type}\ndata: ${JSON.stringify(event)}\n\n`).join('')}: keep-alive\n\n`

const answer = [
  { type: 'message_start', message: { id: 'req', model: 'deepseek-flash' } },
  { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '去掉朗读之后的回答。' } },
  { type: 'content_block_stop', index: 0 },
  { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null, title: '朗读已删除' }, usage: { input_tokens: 4, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 4, service_tier: 'standard' } },
  { type: 'message_stop' },
]

const fulfill = async (route: Route) => {
  const url = route.request().url()
  if (url.endsWith('/user/balance')) {
    await route.fulfill({ json: { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '1.00', granted_balance: '0', topped_up_balance: '1.00' }] } })
    return
  }
  if (url.endsWith('/models')) {
    await route.fulfill({ json: { data: [{ id: 'deepseek-flash' }] } })
    return
  }
  if (!url.includes('/messages')) {
    await route.fulfill({ status: 404, json: { error: { message: 'not mocked' } } })
    return
  }
  await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: sse(answer) })
}

const unlock = async (page: Page) => {
  await page.route('https://api.deepseek.com/**', fulfill)
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()
}

const openSettings = async (page: Page) => {
  if ((page.viewportSize()?.width ?? 1280) < 768) {
    const open = await page.locator('.shell').evaluate((node) => node.classList.contains('nav-open'))
    if (!open) {
      await page.getByTestId('menu').click()
      await expect(page.locator('.sidebar')).toBeVisible()
    }
  }
  await page.getByTestId('user-menu').click()
  await page.getByTestId('settings-open').click()
  await expect(page.getByTestId('settings-dialog')).toBeVisible()
}

const closeSettings = async (page: Page) => {
  await page.getByTestId('settings-dialog').getByRole('button', { name: '关闭' }).click()
  await expect(page.getByTestId('settings-dialog')).toBeHidden()
}

const generalRows = async (page: Page) => page.locator('.settings-general .settings-line').evaluateAll((nodes) => nodes.map((node) => {
  const style = getComputedStyle(node)
  const rowBox = node.getBoundingClientRect()
  const buttons = [...node.querySelectorAll('button')].map((button) => button.getBoundingClientRect()).filter((box) => box.height > 0)
  const content = buttons.length ? Math.max(...buttons.map((box) => box.bottom)) - Math.min(...buttons.map((box) => box.top)) : 0
  return {
    label: node.querySelector('span')?.textContent ?? '',
    height: style.height,
    paddingTop: style.paddingTop,
    paddingBottom: style.paddingBottom,
    borderTopWidth: style.borderTopWidth,
    boxShadow: style.boxShadow,
    buttonsInside: buttons.every((box) => box.top >= rowBox.top - 0.5 && box.bottom <= rowBox.bottom + 0.5),
    contentHeight: content + 24,
  }
}))

test('served app bundle has no speechSynthesis', async ({ page }) => {
  await page.goto('/')
  const html = await page.content()
  const queued = new Set<string>()
  for (const match of html.matchAll(/(?:src|href)="([^"]+\.js)"/g)) {
    queued.add(new URL(match[1], page.url()).href)
  }
  const seen = new Set<string>()
  let blob = html
  while (queued.size > 0) {
    const url = queued.values().next().value as string
    queued.delete(url)
    if (seen.has(url)) continue
    seen.add(url)
    const response = await page.request.get(url)
    expect(response.ok(), url).toBeTruthy()
    const text = await response.text()
    blob += `\n${text}`
    for (const match of text.matchAll(/["']((?:\.\/|\/)[^"']+\.js)["']/g)) {
      queued.add(new URL(match[1], url).href)
    }
  }
  expect(seen.size).toBeGreaterThan(0)
  expect(blob.includes('系统设置'), 'the served bundle should include the app copy').toBe(true)
  expect(blob.includes('speechSynthesis'), 'served javascript still references speechSynthesis').toBe(false)
  expect(blob.includes('SpeechSynthesisUtterance'), 'served javascript still references SpeechSynthesisUtterance').toBe(false)
})

test('settings tabs have no read-aloud copy and keep official row rhythm', async ({ page }) => {
  test.setTimeout(90_000)
  await unlock(page)
  const viewports = [
    { width: 1440, height: 900, name: '1440' },
    { width: 390, height: 844, name: '390' },
  ]
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    for (const theme of ['浅色', '深色'] as const) {
      await openSettings(page)
      await page.getByRole('button', { name: '通用设置' }).click()
      await page.getByRole('button', { name: theme }).click()
      await expect(page.getByRole('button', { name: theme })).toHaveClass(/on/)
      const rows = await generalRows(page)
      const labels = rows.map((row) => row.label)
      expect(labels).toEqual([
        '语言',
        '界面包',
        '安全审核',
        '打开网页',
      ])
      expect(labels).not.toContain('模型')
      expect(labels).not.toContain('思考强度')
      for (const [index, row] of rows.entries()) {
        if (row.label === '界面包') {
          expect(row.buttonsInside, row.label).toBe(true)
          expect(Math.abs(Number.parseFloat(row.height) - row.contentHeight), row.label).toBeLessThanOrEqual(1)
          expect(Number.parseFloat(row.height), row.label).toBeGreaterThan(60)
        } else expect(row.height).toBe('60px')
        expect(row.paddingTop).toBe('12px')
        expect(row.paddingBottom).toBe('12px')
        expect(row.borderTopWidth).toBe('0px')
        const divider = theme === '深色'
          ? 'rgba(255, 255, 255, 0.06) 0px 1px 0px 0px inset'
          : 'rgba(0, 0, 0, 0.1) 0px 1px 0px 0px inset'
        expect(row.boxShadow).toBe(index === 0 ? 'none' : divider)
      }
      await expect(page.getByTestId('file-expiry')).toHaveCount(0)
      await page.locator('.settings-main').evaluate((node) => { node.scrollTop = 0 })
      await page.locator('.settings-shell').screenshot({ path: join(shots, `settings-${theme === '浅色' ? 'light' : 'dark'}-${viewport.name}.png`) })
      for (const tab of ['通用设置', '账号管理', '数据管理', '服务协议']) {
        await page.getByRole('button', { name: tab }).click()
        const text = await page.getByTestId('settings-dialog').innerText()
        expect(text, `${viewport.name} ${theme} ${tab}`).not.toMatch(READ_ALOUD)
      }
      const hidden = await page.getByTestId('settings-dialog').evaluate((node) => node.textContent ?? '')
      expect(hidden).not.toMatch(READ_ALOUD)
      await page.getByRole('button', { name: '通用设置' }).click()
      await page.getByTestId('language-trigger').click()
      await page.getByRole('option', { name: 'English', exact: true }).click()
      await expect(page.getByRole('button', { name: 'General' })).toBeVisible()
      for (const tab of ['General', 'Account', 'Data', 'Terms']) {
        await page.getByRole('button', { name: tab, exact: true }).click()
        const text = await page.getByTestId('settings-dialog').innerText()
        expect(text, `${viewport.name} ${theme} en ${tab}`).not.toMatch(READ_ALOUD)
      }
      await page.getByRole('button', { name: 'General', exact: true }).click()
      await page.getByTestId('language-trigger').click()
      await page.getByRole('option', { name: '简体中文', exact: true }).click()
      await expect(page.getByRole('button', { name: '通用设置' })).toBeVisible()
      await closeSettings(page)
    }
  }
})

test('answer action row has the five official buttons at a 38px pitch', async ({ page }) => {
  test.setTimeout(90_000)
  await unlock(page)
  await page.getByTestId('composer').fill('请回答')
  await page.getByTestId('send').click()
  await expect(page.getByTestId('assistant-text')).toContainText('去掉朗读之后的回答。')
  const viewports = [
    { width: 1440, height: 900, name: '1440' },
    { width: 390, height: 844, name: '390' },
  ]
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    for (const theme of ['浅色', '深色'] as const) {
      await openSettings(page)
      await page.getByRole('button', { name: theme }).click()
      await closeSettings(page)
      const row = page.locator('.action-row')
      await row.scrollIntoViewIfNeeded()
      await expect(row.getByRole('button')).toHaveCount(5)
      await expect(row.getByRole('button', { name: '朗读' })).toHaveCount(0)
      await expect(row.getByRole('button', { name: 'Read aloud' })).toHaveCount(0)
      const labels = await row.locator(':scope > button').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label')))
      expect(labels).toEqual(['复制', '重新生成', '喜欢', '不喜欢', '分享'])
      const metrics = await row.evaluate((node) => {
        const buttons = [...node.querySelectorAll(':scope > button')].map((button) => {
          const box = button.getBoundingClientRect()
          return { x: box.x, y: box.y, w: box.width, h: box.height }
        })
        return { gap: getComputedStyle(node).gap, buttons }
      })
      expect(metrics.gap).toBe('10px')
      expect(metrics.buttons).toHaveLength(5)
      for (let index = 0; index < metrics.buttons.length; index += 1) {
        const button = metrics.buttons[index]
        expect(Math.round(button.w)).toBe(28)
        expect(Math.round(button.h)).toBe(28)
        if (index > 0) {
          const previous = metrics.buttons[index - 1]
          expect(Math.round(button.x - previous.x)).toBe(38)
          expect(Math.round(button.y)).toBe(Math.round(previous.y))
        }
      }
      if ((page.viewportSize()?.width ?? 1280) < 768) {
        const open = await page.locator('.shell').evaluate((node) => node.classList.contains('nav-open'))
        if (open) {
          await page.locator('.scrim').click({ position: { x: 300, y: 200 } })
          await expect(page.locator('.sidebar')).toBeHidden()
        }
      }
      await row.scrollIntoViewIfNeeded()
      await page.screenshot({ path: join(shots, `answer-${theme === '浅色' ? 'light' : 'dark'}-${viewport.name}.png`) })
      await row.screenshot({ path: join(shots, `action-row-${theme === '浅色' ? 'light' : 'dark'}-${viewport.name}.png`) })
    }
  }
})

test('legacy read-aloud localStorage does not throw', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.addInitScript(() => {
    localStorage.setItem('deepapi-voice', '海星')
    localStorage.setItem('harbor-voice', '贝壳')
    localStorage.setItem('deepapi-speak', '1')
    localStorage.setItem('harbor-speak', 'on')
    localStorage.setItem('deepapi-read-aloud', '{"enabled":true,"voice":"暗潮"}')
    localStorage.setItem('deepapi-voice-prefs', '{broken')
    localStorage.setItem('deepapi-profile', JSON.stringify({ nickname: '旧', initial: '旧', voice: '白浪', speak: true }))
    localStorage.setItem('deepapi-ui', JSON.stringify({
      format: 'deepapi-ui',
      schema: 1,
      name: 'legacy',
      scripts: 'forbidden',
      voice: '暗潮',
      readAloud: true,
    }))
  })
  await page.route('https://api.deepseek.com/**', fulfill)
  await page.goto('/')
  expect(pageErrors, pageErrors.join('\n')).toEqual([])
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()
  expect(pageErrors, pageErrors.join('\n')).toEqual([])
  await openSettings(page)
  for (const tab of ['通用设置', '账号管理', '数据管理', '服务协议']) {
    await page.getByRole('button', { name: tab }).click()
    await expect(page.getByTestId('settings-dialog')).toBeVisible()
  }
  await closeSettings(page)
  await page.getByTestId('composer').fill('旧偏好')
  await page.getByTestId('send').click()
  await expect(page.getByTestId('assistant-text')).toContainText('去掉朗读之后的回答。')
  await page.reload()
  await expect(page.getByTestId('composer')).toBeVisible()
  const stored = await page.evaluate(() => ({
    voice: localStorage.getItem('deepapi-voice'),
    legacy: localStorage.getItem('harbor-voice'),
    broken: localStorage.getItem('deepapi-voice-prefs'),
  }))
  expect(stored).toEqual({ voice: '海星', legacy: '贝壳', broken: '{broken' })
  expect(pageErrors).toEqual([])
})
