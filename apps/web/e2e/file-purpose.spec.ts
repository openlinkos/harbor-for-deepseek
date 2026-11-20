import { expect, test, type Page, type Route } from '@playwright/test'

const fulfill = async (route: Route) => {
  const url = route.request().url()
  if (!url.startsWith('https://api.deepseek.com')) {
    await route.abort()
    return
  }
  if (url.endsWith('/user/balance')) {
    await route.fulfill({
      json: { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '317.22', granted_balance: '0.00', topped_up_balance: '317.22' }] },
    })
    return
  }
  if (url.endsWith('/files') && route.request().method() === 'POST') {
    await route.fulfill({
      json: { id: 'file-api-00000000-0000-4000-8000-000000000001', object: 'file', bytes: 12, created_at: 1794936646, filename: 'probe.pdf', purpose: 'rich_layout_recognition', expires_at: 1794940246 },
    })
    return
  }
  await route.fulfill({ status: 404, json: { error: { message: 'not mocked' } } })
}

const seedLegacyPurpose = async (page: Page) => {
  await page.addInitScript(() => {
    localStorage.setItem('deepapi-theme', 'light')
    localStorage.setItem('deepapi-document-purpose', 'text_recognition')
    localStorage.setItem('deepapi-settings', JSON.stringify({ documentPurpose: 'text_recognition' }))
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('deepapi', 2)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains('conversations')) db.createObjectStore('conversations', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('messages')) {
          const messages = db.createObjectStore('messages', { keyPath: 'id' })
          messages.createIndex('byConversation', 'conversationId')
        }
        if (!db.objectStoreNames.contains('tombstones')) db.createObjectStore('tombstones', { keyPath: 'key' })
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv')
      }
      request.onerror = () => reject(request.error ?? new Error('indexedDB open failed'))
      request.onsuccess = () => {
        const db = request.result
        const tx = db.transaction('kv', 'readwrite')
        tx.objectStore('kv').put(
          {
            locale: 'zh',
            safetyLevel: 'high',
            fileExpireDays: 9,
            documentPurpose: 'text_recognition',
            acknowledgedKeyRisk: false,
            deviceId: 'legacy-device',
          },
          'settings',
        )
        tx.oncomplete = () => {
          db.close()
          resolve()
        }
        tx.onerror = () => reject(tx.error ?? new Error('settings write failed'))
      }
    })
  })
}

const ready = async (page: Page) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.route('https://api.deepseek.com/**', fulfill)
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()
}

const openSettings = async (page: Page) => {
  const menu = page.getByTestId('menu')
  if (await menu.isVisible()) await menu.click()
  await page.getByTestId('user-menu').click()
  await page.getByTestId('settings-open').click()
  await expect(page.getByTestId('settings-dialog')).toBeVisible()
}

const tabs = {
  zh: ['通用设置', '账号管理', '数据管理', '服务协议'],
  en: ['General', 'Account', 'Data', 'Terms'],
} as const

const assertNoPurposeRow = async (page: Page, locale: 'zh' | 'en') => {
  const dialog = page.getByTestId('settings-dialog')
  await expect(dialog).not.toContainText('PDF / Office 解析')
  await expect(dialog).not.toContainText('PDF / Office parsing')
  await expect(dialog).not.toContainText('版面解析')
  await expect(dialog).not.toContainText('文本识别')
  await expect(page.getByTestId('purpose-select')).toHaveCount(0)
  for (const name of tabs[locale]) {
    await page.getByRole('button', { name, exact: true }).click()
    await expect(dialog).not.toContainText('PDF / Office 解析')
    await expect(dialog).not.toContainText('PDF / Office parsing')
    await expect(page.getByTestId('purpose-select')).toHaveCount(0)
  }
  await page.getByRole('button', { name: tabs[locale][0], exact: true }).click()
  await expect(dialog).not.toContainText('上传文件过期')
  await expect(dialog).not.toContainText('Uploaded files expire')
  await expect(page.getByTestId('file-expiry')).toHaveCount(0)
  if (locale === 'zh') {
    const labels = await page.locator('.settings-general .settings-line > span:first-child').allTextContents()
    expect(labels.map((label) => label.trim()).filter(Boolean)).toEqual(['语言', '界面包', '安全审核', '打开网页'])
  }
  const blanks = await page.locator('.settings-general').evaluate((node) => {
    const lines = [...node.querySelectorAll(':scope > .settings-line')]
    return lines.filter((line) => line.textContent?.trim() === '').length
  })
  expect(blanks).toBe(0)
}

test('settings omit PDF / Office parsing in both languages at 1440 and 390', async ({ page }) => {
  const pageerrors: string[] = []
  page.on('pageerror', (error) => pageerrors.push(String(error)))
  await seedLegacyPurpose(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await ready(page)
  await openSettings(page)
  await page.getByRole('button', { name: '浅色' }).click()
  await expect(page.locator('body')).not.toHaveAttribute('data-ds-dark-theme')
  await assertNoPurposeRow(page, 'zh')
  await page.locator('.settings-main').evaluate((node) => {
    node.scrollTop = node.scrollHeight
  })
  await page.screenshot({ path: '/tmp/harbor-settings-1440-light.png' })
  await page.getByTestId('language-trigger').click()
  await page.getByRole('option', { name: 'English' }).click()
  await assertNoPurposeRow(page, 'en')
  await page.getByTestId('language-trigger').click()
  await page.getByRole('option', { name: '简体中文' }).click()
  await page.getByTestId('settings-dialog').getByRole('button', { name: '关闭' }).click()
  await expect(page.getByTestId('settings-dialog')).toBeHidden()

  await page.setViewportSize({ width: 390, height: 844 })
  await openSettings(page)
  await page.getByRole('button', { name: '浅色' }).click()
  await assertNoPurposeRow(page, 'zh')
  await page.locator('.settings-main').evaluate((node) => {
    node.scrollTop = node.scrollHeight
  })
  await page.screenshot({ path: '/tmp/harbor-settings-390-light.png' })
  await page.getByTestId('language-trigger').click()
  await page.getByRole('option', { name: 'English' }).click()
  await assertNoPurposeRow(page, 'en')
  expect(pageerrors).toEqual([])
})

test('a legacy text_recognition preference still uploads pdf as rich layout', async ({ page }) => {
  const pageerrors: string[] = []
  page.on('pageerror', (error) => pageerrors.push(String(error)))
  const uploads: string[] = []
  await seedLegacyPurpose(page)
  await page.emulateMedia({ colorScheme: 'light' })
  await page.route('https://api.deepseek.com/**', async (route) => {
    if (route.request().method() === 'POST' && route.request().url().endsWith('/files')) {
      uploads.push(route.request().postData() ?? route.request().postDataBuffer()?.toString('utf8') ?? '')
    }
    await fulfill(route)
  })
  await page.goto('/')
  expect(pageerrors).toEqual([])
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()

  const files = [
    { name: 'probe.pdf', mimeType: 'application/pdf', purpose: 'rich_layout_recognition' },
    { name: 'memo.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', purpose: 'rich_layout_recognition' },
    { name: 'slides.pptx', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', purpose: 'rich_layout_recognition' },
    { name: 'photo.png', mimeType: 'image/png', purpose: 'user_data' },
    { name: 'notes.txt', mimeType: 'text/plain', purpose: 'user_data' },
  ]
  for (const file of files) {
    await page.getByTestId('file-input').setInputFiles({ name: file.name, mimeType: file.mimeType, buffer: Buffer.from(`payload ${file.name}`) })
    await expect(page.locator('.drafts')).toContainText(file.name)
  }
  expect(uploads).toHaveLength(files.length)
  for (const [index, file] of files.entries()) {
    const body = uploads[index] ?? ''
    expect(body).toContain(`filename="${file.name}"`)
    expect(body).toContain('name="purpose"')
    expect(body).toContain(file.purpose)
    expect(body).not.toContain('text_recognition')
    expect(body).not.toContain('expires_after')
  }
  expect(pageerrors).toEqual([])
})
