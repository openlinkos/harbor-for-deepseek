// Attaching works while 智能搜索 is on (the fresh-load default). Official blocks it only when the
// remote model config sets file_feature.conflict_with_search === true; the official capture with both
// toggles on shows the paperclip enabled (docs/parity/compare/home-light.png). PR #73 review, 11/26.
import { expect, test, type Page, type Route } from '@playwright/test'

type Body = { thinking?: { type?: string }; tools?: Array<{ type?: string }>; messages?: Array<{ content: unknown }> }

const sse = (events: unknown[]) => events.map((event) => `event: ${(event as { type: string }).type}\ndata: ${JSON.stringify(event)}\n\n`).join('')
const plain = () => [
  { type: 'message_start', message: { id: 'req-attach', model: 'deepseek-flash' } },
  { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '收到文件' } },
  { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null, title: '带文件搜索' }, usage: { input_tokens: 1, output_tokens: 1 } },
  { type: 'message_stop' },
]
const hasSearch = (body: Body) => (body.tools ?? []).some((tool) => tool.type === 'deepseek_web_search')
const FILE_ID = 'file-api-00000000-0000-4000-8000-0000000000a1'

const install = async (page: Page, bodies: Body[], uploads: string[]) => {
  await page.route('https://api.deepseek.com/**', async (route: Route) => {
    const url = route.request().url()
    if (url.endsWith('/user/balance')) return route.fulfill({ json: { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '1.00', granted_balance: '0.00', topped_up_balance: '1.00' }] } })
    if (url.endsWith('/models')) return route.fulfill({ json: { data: [{ id: 'deepseek-flash' }] } })
    if (url.endsWith('/files') && route.request().method() === 'POST') {
      uploads.push(url)
      return route.fulfill({ json: { id: FILE_ID, object: 'file', bytes: 12, created_at: 1, filename: 'note.txt', purpose: 'user_data', expires_at: null } })
    }
    if (url.includes('/messages')) {
      bodies.push(route.request().postDataJSON() as Body)
      return route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: sse(plain()) })
    }
    return route.fulfill({ status: 404, json: {} })
  })
}

const unlock = async (page: Page) => {
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()
}

const attachButton = (page: Page) => page.locator('.tool-right').getByRole('button', { name: '添加文件', exact: true })
const note = { name: 'note.txt', mimeType: 'text/plain', buffer: Buffer.from('hello harbor') }

test('fresh load with search on: the paperclip opens the picker and the file attaches', async ({ page }) => {
  const bodies: Body[] = []
  const uploads: string[] = []
  await install(page, bodies, uploads)
  await unlock(page)
  await expect(page.getByTestId('toggle-search')).toHaveAttribute('aria-pressed', 'true')
  await page.mouse.move(0, 0)
  await expect(attachButton(page)).toBeEnabled()
  await expect(attachButton(page)).toHaveCSS('color', 'rgb(15, 17, 21)')
  const chooser = page.waitForEvent('filechooser', { timeout: 5_000 })
  await attachButton(page).click()
  await (await chooser).setFiles(note)
  await expect(page.locator('.drafts')).toContainText('note.txt')
  await expect(page.getByText('联网搜索不支持上传文件')).toHaveCount(0)
  expect(uploads).toHaveLength(1)
  await expect(page.getByTestId('toggle-search')).toHaveAttribute('aria-pressed', 'true')
})

test('with a file attached the search toggle stays usable, and the request carries the file and web search', async ({ page }) => {
  const bodies: Body[] = []
  await install(page, bodies, [])
  await unlock(page)
  await page.getByTestId('file-input').setInputFiles(note)
  await expect(page.locator('.drafts')).toContainText('note.txt')
  const search = page.getByTestId('toggle-search')
  await expect(search).not.toHaveAttribute('aria-disabled', 'true')
  await search.click()
  await expect(search).toHaveAttribute('aria-pressed', 'false')
  await search.click()
  await expect(search).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('请先删除文件再开启联网搜索')).toHaveCount(0)
  await page.getByTestId('composer').fill('文件里写了什么？顺便搜一下')
  await page.getByTestId('send').click()
  await expect(page.getByTestId('assistant-text')).toContainText('收到文件')
  expect(bodies).toHaveLength(1)
  expect(hasSearch(bodies[0])).toBe(true)
  expect(bodies[0].thinking?.type).toBe('enabled')
  expect(JSON.stringify(bodies[0].messages?.at(-1)?.content)).toContain(FILE_ID)
})

test('turning search on after attaching keeps the file and sends both', async ({ page }) => {
  const bodies: Body[] = []
  await install(page, bodies, [])
  await unlock(page)
  await page.getByTestId('toggle-search').click()
  await page.getByTestId('file-input').setInputFiles(note)
  await expect(page.locator('.drafts')).toContainText('note.txt')
  await page.getByTestId('toggle-search').click()
  await expect(page.getByTestId('toggle-search')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.drafts')).toContainText('note.txt')
  await page.getByTestId('composer').fill('再发一次')
  await page.getByTestId('send').click()
  await expect(page.getByTestId('assistant-text')).toContainText('收到文件')
  expect(hasSearch(bodies[0])).toBe(true)
  expect(JSON.stringify(bodies[0].messages?.at(-1)?.content)).toContain(FILE_ID)
})
