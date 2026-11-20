import { expect, test, type Page, type Route } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const shots = join(process.cwd(), 'test-results/fixed-model')
mkdirSync(shots, { recursive: true })

const answer = [
  { type: 'message_start', message: { id: 'req-fixed', model: 'deepseek-flash', usage: { input_tokens: 12, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 0, service_tier: 'standard' } } },
  { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '8' } },
  { type: 'content_block_stop', index: 0 },
  { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { input_tokens: 12, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 4, service_tier: 'standard' } },
  { type: 'message_stop' },
]

const sse = (events: unknown[]) => `${events.map((event) => `event: ${(event as { type: string }).type}\ndata: ${JSON.stringify(event)}\n\n`).join('')}: keep-alive\n\n`

const fulfill = async (route: Route) => {
  const url = route.request().url()
  if (!url.startsWith('https://api.deepseek.com')) {
    await route.abort()
    return
  }
  if (url.endsWith('/user/balance')) {
    await route.fulfill({
      json: { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '1.00', granted_balance: '0.00', topped_up_balance: '1.00' }] },
    })
    return
  }
  if (url.endsWith('/models')) {
    await route.fulfill({ json: { data: [{ id: 'deepseek-flash' }, { id: 'deepseek-v4-pro' }] } })
    return
  }
  if (url.includes('/messages')) {
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: sse(answer),
    })
    return
  }
  await route.fulfill({ status: 404, json: { error: { message: 'not mocked' } } })
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
  await page.getByTestId('user-menu').click()
  await page.getByTestId('settings-open').click()
  await expect(page.getByTestId('settings-dialog')).toBeVisible()
}

const ZH_TABS = ['通用设置', '账号管理', '数据管理', '服务协议'] as const
const EN_TABS = ['General', 'Account', 'Data', 'Terms'] as const
const ZH_FORBIDDEN = /模型|思考强度|推理强度/
const EN_FORBIDDEN = /模型|思考强度|推理强度|\bModel\b|\bEffort\b|reasoning strength/i

const visibleSettingsText = (page: Page) =>
  page.getByTestId('settings-dialog').evaluate((node) => (node as HTMLElement).innerText)

const assertTabsClean = async (page: Page, tabs: readonly string[], forbidden: RegExp) => {
  for (const tab of tabs) {
    await page.getByRole('button', { name: tab, exact: true }).click()
    const text = await visibleSettingsText(page)
    expect(text, tab).not.toMatch(forbidden)
    await expect(page.getByTestId('model-select')).toHaveCount(0)
    await expect(page.getByTestId('effort-select')).toHaveCount(0)
  }
}

const GENERAL_LABELS = ['语言', '界面包', '安全审核', '打开网页', '上传文件过期（天）']

const assertOfficialRows = async (page: Page) => {
  const rows = page.locator('.settings-general .settings-line')
  await expect(rows).toHaveCount(GENERAL_LABELS.length)
  for (const [index, label] of GENERAL_LABELS.entries()) {
    const row = rows.nth(index)
    await expect(row.locator('> span').first()).toHaveText(label)
    const box = await row.evaluate((node) => {
      const style = getComputedStyle(node)
      return {
        display: style.display,
        height: style.height,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        lineHeight: style.lineHeight,
        justifyContent: style.justifyContent,
        alignItems: style.alignItems,
        boxShadow: style.boxShadow,
      }
    })
    expect(box.display, label).toBe('flex')
    expect(box.height, label).toBe('60px')
    expect(box.fontSize, label).toBe('14px')
    expect(box.fontWeight, label).toBe('400')
    expect(box.lineHeight, label).toBe('22px')
    expect(box.justifyContent, label).toBe('space-between')
    expect(box.alignItems, label).toBe('center')
    if (index === 0) expect(box.boxShadow, label).toBe('none')
    else expect(box.boxShadow, label).toContain('inset')
  }
}

test('settings tabs do not offer a model or reasoning effort', async ({ page }) => {
  await unlock(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await openSettings(page)
  await assertTabsClean(page, ZH_TABS, ZH_FORBIDDEN)
  await page.getByRole('button', { name: '通用设置', exact: true }).click()
  await assertOfficialRows(page)

  await page.getByTestId('language-trigger').click()
  await page.getByRole('option', { name: 'English', exact: true }).click()
  await expect(page.getByRole('button', { name: 'General', exact: true })).toBeVisible()
  await assertTabsClean(page, EN_TABS, EN_FORBIDDEN)
  await page.getByRole('button', { name: 'General', exact: true }).click()
  await page.getByTestId('language-trigger').click()
  await page.getByRole('option', { name: '简体中文', exact: true }).click()
  await expect(page.getByRole('button', { name: '通用设置', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '通用设置', exact: true }).click()

  const dialog = page.getByTestId('settings-dialog')
  await dialog.screenshot({ path: join(shots, 'settings-general-1440-light.png') })
  for (const tab of ['账号管理', '数据管理', '服务协议'] as const) {
    await page.getByRole('button', { name: tab, exact: true }).click()
    expect(await visibleSettingsText(page)).not.toMatch(ZH_FORBIDDEN)
    await dialog.screenshot({ path: join(shots, `settings-${tab}-1440-light.png`) })
  }
  await page.getByRole('button', { name: '通用设置', exact: true }).click()
  await page.getByRole('button', { name: '深色', exact: true }).click()
  expect(await visibleSettingsText(page)).not.toMatch(ZH_FORBIDDEN)
  await assertOfficialRows(page)
  await dialog.screenshot({ path: join(shots, 'settings-general-1440-dark.png') })

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('button', { name: '通用设置', exact: true })).toBeVisible()
  expect(await visibleSettingsText(page)).not.toMatch(ZH_FORBIDDEN)
  await assertOfficialRows(page)
  await dialog.screenshot({ path: join(shots, 'settings-general-390-dark.png') })
  await page.getByRole('button', { name: '浅色', exact: true }).click()
  expect(await visibleSettingsText(page)).not.toMatch(ZH_FORBIDDEN)
  await assertOfficialRows(page)
  await dialog.screenshot({ path: join(shots, 'settings-general-390-light.png') })
  for (const tab of ['账号管理', '数据管理', '服务协议'] as const) {
    await page.getByRole('button', { name: tab, exact: true }).click()
    expect(await visibleSettingsText(page)).not.toMatch(ZH_FORBIDDEN)
    await dialog.screenshot({ path: join(shots, `settings-${tab}-390-light.png`) })
  }
})

test('an old saved model and effort are ignored when sending', async ({ page }) => {
  await page.addInitScript(async () => {
    localStorage.setItem('deepapi-legacy-prefs', JSON.stringify({ model: 'deepseek-v4-pro', effort: 'max', thinking: false }))
    localStorage.setItem('harbor-prefs', JSON.stringify({ model: 'deepseek-v4-pro', effort: 'low' }))
    const open = (name: string, upgrade: (db: IDBDatabase) => void) =>
      new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(name, 2)
        request.onupgradeneeded = () => upgrade(request.result)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
    const data = await open('deepapi', (db) => {
      if (!db.objectStoreNames.contains('conversations')) db.createObjectStore('conversations', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('messages')) {
        const messages = db.createObjectStore('messages', { keyPath: 'id' })
        messages.createIndex('byConversation', 'conversationId')
      }
      if (!db.objectStoreNames.contains('tombstones')) db.createObjectStore('tombstones', { keyPath: 'key' })
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv')
    })
    const now = new Date().toISOString()
    await new Promise<void>((resolve, reject) => {
      const tx = data.transaction('conversations', 'readwrite')
      tx.objectStore('conversations').put({
        id: 'old-chat',
        title: '旧对话',
        titleSource: 'user',
        model: 'deepseek-v4-pro',
        thinking: true,
        search: false,
        readLink: false,
        effort: 'max',
        pinned: false,
        archived: false,
        activeLeafId: null,
        createdAt: now,
        updatedAt: now,
        rev: 1,
        deletedAt: null,
      })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    data.close()
    const secrets = await open('deepapi-secrets', (db) => {
      if (!db.objectStoreNames.contains('secrets')) db.createObjectStore('secrets')
    })
    await new Promise<void>((resolve, reject) => {
      const tx = secrets.transaction('secrets', 'readwrite')
      tx.objectStore('secrets').put({ v: 1, enc: false, value: 'demo-local-key' }, 'api-key')
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    secrets.close()
  })
  await page.route('https://api.deepseek.com/**', fulfill)
  await page.goto('/')
  await expect(page.getByTestId('composer')).toBeVisible()
  await expect(page.getByTestId('sidebar')).toContainText('旧对话')
  await expect(page.getByTestId('key-dialog')).toHaveCount(0)
  await expect(page.getByTestId('toggle-thinking')).toHaveClass(/\bon\b/)
  const pending = page.waitForRequest((request) => request.url().includes('/messages') && request.method() === 'POST')
  await page.getByTestId('composer').fill('旧设置还能发吗')
  await page.getByTestId('send').click()
  const body = (await pending).postDataJSON() as {
    model: string
    output_config: { effort: string }
    thinking: { type: string }
  }
  expect(body.model).toBe('deepseek-flash')
  expect(body.output_config.effort).toBe('high')
  expect(body.thinking.type).toBe('enabled')
  await expect(page.getByTestId('assistant-text')).toContainText('8')
  await expect(page.locator('.form-error')).toHaveCount(0)
  await expect(page.getByTestId('retry')).toHaveCount(0)
})

test('the deep-thinking switch turns thinking on and off', async ({ page }) => {
  await unlock(page)
  await expect(page.getByTestId('toggle-thinking')).toHaveClass(/\bon\b/)
  const enabled = page.waitForRequest((request) => request.url().includes('/messages') && request.method() === 'POST')
  await page.getByTestId('composer').fill('开着思考')
  await page.getByTestId('send').click()
  const enabledBody = (await enabled).postDataJSON() as {
    model: string
    output_config: { effort: string }
    thinking: { type: string }
  }
  expect(enabledBody.thinking.type).toBe('enabled')
  expect(enabledBody.model).toBe('deepseek-flash')
  expect(enabledBody.output_config.effort).toBe('high')
  await expect(page.getByTestId('assistant-text')).toContainText('8')

  await page.getByTestId('toggle-thinking').click()
  await expect(page.getByTestId('toggle-thinking')).not.toHaveClass(/\bon\b/)
  const disabled = page.waitForRequest((request) => request.url().includes('/messages') && request.method() === 'POST')
  await page.getByTestId('composer').fill('关上思考')
  await page.getByTestId('send').click()
  const disabledBody = (await disabled).postDataJSON() as { thinking: { type: string } }
  expect(disabledBody.thinking.type).toBe('disabled')

  await page.getByTestId('toggle-thinking').click()
  await expect(page.getByTestId('toggle-thinking')).toHaveClass(/\bon\b/)
  const again = page.waitForRequest((request) => request.url().includes('/messages') && request.method() === 'POST')
  await page.getByTestId('composer').fill('再开思考')
  await page.getByTestId('send').click()
  const againBody = (await again).postDataJSON() as { thinking: { type: string } }
  expect(againBody.thinking.type).toBe('enabled')
  await expect(page.locator('.form-error')).toHaveCount(0)
  await expect(page.getByTestId('retry')).toHaveCount(0)
})
