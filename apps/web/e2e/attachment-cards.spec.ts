import { expect, test, type Page, type Route } from '@playwright/test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { saveShot } from './lib/parity-shots'

const sse = (text: string) => {
  const events = [
    { type: 'message_start', message: { id: 'req', model: 'deepseek-flash' } },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { input_tokens: 8, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 4, service_tier: 'standard' } },
    { type: 'message_stop' },
  ]
  return `${events.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join('')}: keep-alive\n\n`
}

let releaseUpload = () => {}
let uploadGate = Promise.resolve()
let releaseStream = () => {}
let streamGate = Promise.resolve()
const purposes: string[] = []

const armUpload = () => {
  uploadGate = new Promise<void>((resolve) => {
    releaseUpload = resolve
  })
}

const armStream = () => {
  streamGate = new Promise<void>((resolve) => {
    releaseStream = resolve
  })
}

const fulfill = async (route: Route) => {
  const url = route.request().url()
  const method = route.request().method()
  if (url.endsWith('/user/balance')) {
    await route.fulfill({ json: { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '1.00', granted_balance: '0.00', topped_up_balance: '1.00' }] } })
    return
  }
  if (url.endsWith('/models')) {
    await route.fulfill({ json: { data: [{ id: 'deepseek-flash' }] } })
    return
  }
  if (url.endsWith('/files') && method === 'POST') {
    const body = route.request().postDataBuffer()?.toString('utf8') ?? ''
    purposes.push(body)
    await uploadGate
    await route.fulfill({
      json: {
        id: `file-api-${randomUUID()}`,
        object: 'file',
        bytes: 0,
        created_at: 1794936646,
        filename: 'upload',
        purpose: body.includes('rich_layout_recognition') ? 'rich_layout_recognition' : 'user_data',
        expires_at: null,
      },
    })
    return
  }
  if (url.includes('/messages')) {
    await streamGate
    await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: sse('这两个附件是一组测试文件。') })
    return
  }
  await route.fulfill({ status: 404, json: {} })
}

const unlock = async (page: Page) => {
  purposes.length = 0
  uploadGate = Promise.resolve()
  streamGate = Promise.resolve()
  await page.route('https://api.deepseek.com/**', fulfill)
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()
}

test.use({ viewport: { width: 1920, height: 1072 } })

test('attachment cards show uploading then the official size, and the sent message reuses the card', async ({ page }) => {
  await unlock(page)
  await page.getByTestId('toggle-search').click()
  const samples = mkdtempSync(join(tmpdir(), 'attach-'))
  writeFileSync(join(samples, 'zhuheng-test.pdf'), Buffer.alloc(1383))
  writeFileSync(join(samples, 'zhuheng-test.txt'), Buffer.alloc(65))
  armUpload()
  await page.getByTestId('file-input').setInputFiles(join(samples, 'zhuheng-test.pdf'))
  const uploading = page.getByTestId('file-card-meta').filter({ hasText: '上传中...' })
  await expect(uploading).toBeVisible()
  await expect(page.getByTestId('file-card-spinner')).toBeVisible()
  releaseUpload()
  await expect(page.getByTestId('file-card-meta')).toHaveText('PDF 1.35KB')

  armUpload()
  await page.getByTestId('file-input').setInputFiles(join(samples, 'zhuheng-test.txt'))
  await expect(page.getByTestId('file-card-meta').filter({ hasText: '上传中...' })).toBeVisible()
  await expect(page.getByTestId('file-card-meta').first()).toHaveText('PDF 1.35KB')
  await saveShot(page, 'attachments-uploading-txt.png')
  releaseUpload()
  await expect(page.getByTestId('file-card-meta').nth(1)).toHaveText('TXT 65B')
  await expect(page.getByTestId('file-card').first()).toHaveCSS('width', '240px')
  await expect(page.getByTestId('file-card').first()).toHaveCSS('min-height', '64px')
  await expect(page.getByTestId('file-card').first()).toHaveCSS('border-radius', '16px')
  const pdfBody = purposes.find((body) => body.includes('zhuheng-test.pdf')) ?? ''
  const txtBody = purposes.find((body) => body.includes('zhuheng-test.txt')) ?? ''
  expect(pdfBody).toContain('rich_layout_recognition')
  expect(pdfBody).not.toContain('expires_after')
  expect(txtBody).toContain('user_data')

  await page.getByTestId('composer').fill('总结这两个附件')
  await page.mouse.move(8, 8)
  const pdfCard = page.getByTestId('file-card').first()
  const remove = pdfCard.getByRole('button', { name: '移除' })
  await expect(remove).toHaveCSS('opacity', '0')
  await pdfCard.hover()
  await expect(remove).toHaveCSS('opacity', '1')
  await page.mouse.move(8, 8)
  await expect(remove).toHaveCSS('opacity', '0')
  await saveShot(page, 'attachments-01-composer-txt-uploading.png')

  armStream()
  await page.getByTestId('send').click()
  const sent = page.getByTestId('message-files')
  await expect(sent).toContainText('PDF 1.35KB')
  await expect(sent).toContainText('TXT 65B')
  await expect(sent.getByRole('button', { name: '移除' })).toHaveCount(0)
  await expect(page.getByTestId('reply-dots')).toBeVisible()
  await expect(page.locator('.drafts')).toHaveCount(0)
  await saveShot(page, 'attachments-02-composer-cards-before-send.png')
  releaseStream()
  await expect(page.getByTestId('assistant-text')).toContainText('这两个附件是一组测试文件。')
  await expect(sent).toContainText('zhuheng-test.pdf')
  // changes/r22b-assertion-rulings.md ruling 3: the bubble after files keeps the official 10px margin-top (.fbb737a4._8271fc3).
  await expect(page.locator('.turn.user .bubble.has-files').last()).toHaveCSS('margin-top', '10px')
  await saveShot(page, 'attachments-03-sent-user-message-cards-waiting-dots.png')
  await saveShot(page, 'attachments-04-answer-summary.png')
})
