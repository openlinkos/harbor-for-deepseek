// Capture the 1920x1072 states that now have official references.
import { createRequire } from 'node:module'
const { chromium } = createRequire(new URL('../../node_modules/.pnpm/playwright@1.49.1/node_modules/playwright/package.json', import.meta.url))('playwright')
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const BASE = process.env.OURS || 'http://127.0.0.1:4183'
const CAP = readFileSync(new URL('./capture2.js', import.meta.url), 'utf8')
const OUT = process.env.OUT || '/tmp/caps-1920'
mkdirSync(OUT, { recursive: true })
const deskUA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const sse = (text, title) => [
  { type: 'message_start', message: { id: 'req', model: 'deepseek-flash' } },
  { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: '用户在问定时器。' } },
  { type: 'content_block_stop', index: 0 },
  { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
  { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text } },
  { type: 'content_block_stop', index: 1 },
  { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null, title }, usage: { input_tokens: 10, output_tokens: 4 } },
  { type: 'message_stop' },
].map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join('')

const WIDTH = Number(process.env.W || 1920)
const HEIGHT = Number(process.env.H || 1072)
const VP = `${WIDTH}x${HEIGHT}`
const browser = await chromium.launch()
const log = []
const runOne = async (id, theme, setup) => {
  const ctx = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    locale: 'zh-CN',
    bypassCSP: true,
    colorScheme: theme,
    userAgent: deskUA,
    deviceScaleFactor: 1,
  })
  if (theme === 'dark') {
    await ctx.addInitScript(() => localStorage.setItem('deepapi-theme', 'dark'))
  }
  const page = await ctx.newPage()
  page.setDefaultTimeout(12000)
  await page.route('https://api.deepseek.com/**', async (route) => {
    const url = route.request().url()
    if (url.endsWith('/user/balance')) return route.fulfill({ json: { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '317.22', granted_balance: '0.00', topped_up_balance: '317.22' }] } })
    if (url.endsWith('/models')) return route.fulfill({ json: { data: [{ id: 'deepseek-flash' }] } })
    if (!url.includes('/messages')) return route.fulfill({ status: 404, json: {} })
    return route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse('你好，有什么我能帮你的吗？', '初次问候') })
  })
  try {
    await setup(page)
    await page.mouse.move(8, 8)
    await page.waitForTimeout(400)
    await page.addScriptTag({ content: CAP })
    const data = await page.evaluate((state) => globalThis.captureStyleAudit({ label: 'ours', state, download: false }), id)
    writeFileSync(`${OUT}/ours-${id}-${theme}-${VP}.json`, JSON.stringify(data))
    log.push(`${id} ${theme} ok els=${data.elements.length}`)
  } catch (error) {
    log.push(`${id} ${theme} FAIL ${String(error.message).split('\n')[0].slice(0, 180)}`)
  }
  await ctx.close()
}

const unlock = async (page) => {
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await page.getByTestId('composer').waitFor()
}
const send = async (page, text) => {
  await page.getByTestId('composer').fill(text)
  await page.getByTestId('send').click()
  await page.getByTestId('assistant-text').last().waitFor({ timeout: 20000 })
  await page.waitForTimeout(300)
}
const withHistory = async (page) => {
  await unlock(page)
  await send(page, '你好呀')
  await page.getByTestId('new-chat').click()
  await page.waitForTimeout(200)
}
const onAnswer = async (page) => {
  await unlock(page)
  await send(page, '你好呀')
}
const openSettings = async (page, tab) => {
  await onAnswer(page)
  await page.getByTestId('user-menu').click()
  await page.getByTestId('settings-open').click()
  await page.getByRole('button', { name: '通用设置' }).waitFor()
  if (tab) await page.getByRole('button', { name: tab }).click()
  await page.waitForTimeout(200)
}

const themes = new Set((process.env.THEMES || 'light,dark').split(','))
if (themes.has('light')) await runOne('multi-select', 'light', async (page) => {
  await unlock(page)
  await send(page, '你好')
  await page.getByTestId('new-chat').click()
  await send(page, '你好呀')
  await page.getByRole('button', { name: '多选' }).first().click()
})
if (themes.has('dark')) await runOne('multi-select', 'dark', async (page) => {
  await unlock(page)
  await send(page, '你好')
  await page.getByTestId('new-chat').click()
  await send(page, '你好呀')
  await page.getByRole('button', { name: '多选' }).first().click()
})
await runOne('multi-select-checked', 'light', async (page) => {
  await unlock(page)
  await send(page, '你好')
  await page.getByTestId('new-chat').click()
  await send(page, '你好呀')
  await page.getByRole('button', { name: '多选' }).first().click()
  await page.getByRole('checkbox').first().click()
})
if (themes.has('dark')) {
  await runOne('home-with-history', 'dark', async (page) => { await withHistory(page) })
  await runOne('answer', 'dark', async (page) => { await unlock(page); await send(page, '你好呀') })
  await runOne('user-menu', 'dark', async (page) => { await onAnswer(page); await page.getByTestId('user-menu').click() })
  await runOne('settings-general', 'dark', async (page) => { await openSettings(page) })
  await runOne('settings-account', 'dark', async (page) => { await openSettings(page, '账号管理') })
}
if (themes.has('light')) {
  await runOne('home-with-history', 'light', async (page) => { await withHistory(page) })
  await runOne('answer', 'light', async (page) => { await unlock(page); await send(page, '你好呀') })
  await runOne('user-menu', 'light', async (page) => { await withHistory(page); await page.getByTestId('user-menu').click() })
  await runOne('settings-general', 'light', async (page) => {
    await withHistory(page)
    await page.getByTestId('user-menu').click()
    await page.getByTestId('settings-open').click()
    await page.getByRole('button', { name: '通用设置' }).waitFor()
  })
  await runOne('settings-account', 'light', async (page) => {
    await withHistory(page)
    await page.getByTestId('user-menu').click()
    await page.getByTestId('settings-open').click()
    await page.getByRole('button', { name: '账号管理' }).click()
  })
}
await browser.close()
console.log(log.join('\n'))
