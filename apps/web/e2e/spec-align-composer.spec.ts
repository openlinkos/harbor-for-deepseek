// SP-CMP-296 per-chat draft text. SP-CMP-297 per-chat unsent attachment cards.
// Both stay in memory across New chat and chat switching, and are gone after reload.
import { expect, test, type Page, type Route } from '@playwright/test'

const sse = (events: unknown[]) => events.map((event) => `event: ${(event as { type: string }).type}\ndata: ${JSON.stringify(event)}\n\n`).join('')
const reply = () => [
  { type: 'message_start', message: { id: 'req-draft', model: 'deepseek-flash' } },
  { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '好的。' } },
  { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { input_tokens: 1, output_tokens: 1 } },
  { type: 'message_stop' },
]

const install = async (page: Page) => {
  await page.route('https://api.deepseek.com/**', async (route: Route) => {
    const url = route.request().url()
    if (url.endsWith('/user/balance')) return route.fulfill({ json: { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '1', granted_balance: '0', topped_up_balance: '1' }] } })
    if (url.endsWith('/models')) return route.fulfill({ json: { data: [{ id: 'deepseek-flash' }] } })
    if (url.endsWith('/files') && route.request().method() === 'POST') {
      return route.fulfill({ json: { id: 'file-api-00000000-0000-4000-8000-000000000009', object: 'file', bytes: 4, created_at: 1, filename: 'note.txt', purpose: 'user_data', expires_at: null } })
    }
    if (!url.includes('/messages')) return route.fulfill({ status: 404, json: {} })
    return route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse(reply()) })
  })
}

const seed = async (page: Page) => {
  await install(page)
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((ok, ko) => {
      const request = indexedDB.open('deepapi')
      request.onsuccess = () => ok(request.result)
      request.onerror = () => ko(request.error)
    })
    const tx = db.transaction(['conversations', 'messages'], 'readwrite')
    ;['草稿甲会话', '草稿乙会话'].forEach((title, index) => {
      const id = crypto.randomUUID()
      const mid = crypto.randomUUID()
      const when = new Date(Date.now() - index * 60_000).toISOString()
      tx.objectStore('conversations').put({ id, title, titleSource: 'user', model: 'deepseek-flash', thinking: true, search: true, readLink: false, effort: 'high', pinned: false, archived: false, activeLeafId: mid, createdAt: when, updatedAt: when, rev: 1, deletedAt: null })
      tx.objectStore('messages').put({ id: mid, conversationId: id, parentId: null, role: 'user', blocks: [{ type: 'text', text: '问题：' + title }], status: 'complete', usage: null, errorMessage: null, createdAt: when, updatedAt: when, rev: 1, deletedAt: null })
    })
    await new Promise((ok, ko) => { tx.oncomplete = () => ok(null); tx.onerror = () => ko(tx.error) })
    db.close()
  })
  await page.reload()
  await expect(page.getByTestId('composer')).toBeVisible()
}

const openChat = async (page: Page, title: string) => {
  await page.locator('a.chat-link', { hasText: title }).getByRole('button', { name: title }).click()
  await expect(page.getByTestId('message-list')).toContainText('问题：' + title)
}

test('SP-CMP-296 and SP-CMP-297 drafts stay per chat and disappear on reload', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await seed(page)
  await openChat(page, '草稿甲会话')
  await page.getByTestId('composer').fill('草稿甲')
  await page.getByTestId('file-input').setInputFiles({ name: 'note.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') })
  await expect(page.locator('.drafts')).toContainText('note.txt')

  await page.getByTestId('new-chat').click()
  await expect(page.locator('.greeting')).toBeVisible()
  await expect(page.getByTestId('composer')).toHaveValue('')
  await expect(page.locator('.drafts')).toHaveCount(0)

  await openChat(page, '草稿乙会话')
  await expect(page.getByTestId('composer')).toHaveValue('')
  await expect(page.locator('.drafts')).toHaveCount(0)
  await page.getByTestId('composer').fill('草稿乙')

  await openChat(page, '草稿甲会话')
  await expect(page.getByTestId('composer')).toHaveValue('草稿甲')
  await expect(page.locator('.drafts')).toContainText('note.txt')

  await openChat(page, '草稿乙会话')
  await expect(page.getByTestId('composer')).toHaveValue('草稿乙')
  await expect(page.locator('.drafts')).toHaveCount(0)

  await page.reload()
  await expect(page.getByTestId('composer')).toBeVisible()
  await openChat(page, '草稿甲会话')
  await expect(page.getByTestId('composer')).toHaveValue('')
  await expect(page.locator('.drafts')).toHaveCount(0)
})
