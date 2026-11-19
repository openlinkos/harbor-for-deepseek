import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildCaptureScripts } from './build.ts'
import { setTimeout as sleep } from 'node:timers/promises'
import { diffMatch, loadAllowlistFile, renderReport, type DiffReport } from './diff.ts'
import { matchCaptures, type Capture } from './match.ts'
import { selfCheck } from './selfcheck.ts'

const require = createRequire(new URL('../../apps/web/package.json', import.meta.url))
const playwright = require('@playwright/test') as {
  chromium: { launch: (options?: { headless?: boolean }) => Promise<Browser> }
}

type Browser = { newContext: (options: Record<string, unknown>) => Promise<Context>; close: () => Promise<void> }
type Context = { newPage: () => Promise<Page>; close: () => Promise<void> }
type Page = {
  setDefaultTimeout: (ms: number) => void
  route: (pattern: string, handler: (route: Route) => Promise<void>) => Promise<void>
  goto: (url: string) => Promise<unknown>
  getByTestId: (id: string) => Locator
  getByRole: (role: string, options?: Record<string, unknown>) => Locator
  getByText: (text: string) => Locator
  locator: (selector: string) => Locator
  keyboard: { press: (key: string) => Promise<void> }
  evaluate: (fn: (...args: never[]) => unknown, arg?: unknown) => Promise<unknown>
  addScriptTag: (options: { content: string }) => Promise<unknown>
  waitForTimeout: (ms: number) => Promise<void>
  close: () => Promise<void>
  emulateMedia: (options: { reducedMotion: 'reduce' | 'no-preference' }) => Promise<void>
}
type Locator = {
  click: (options?: { timeout?: number }) => Promise<void>
  fill: (value: string) => Promise<void>
  check: () => Promise<void>
  waitFor: (options?: { timeout?: number }) => Promise<void>
  setInputFiles: (file: { name: string; mimeType: string; buffer: Buffer }) => Promise<void>
  evaluate: (fn: (node: Element) => void) => Promise<void>
  first: () => Locator
}
type Route = { request: () => { url: () => string; method: () => string }; fulfill: (options: Record<string, unknown>) => Promise<void> }

const root = join(import.meta.dirname, '../..')
const outDir = join(root, 'docs/parity/style')
const oursDir = join(outDir, 'ours')
const officialDir = process.env.STYLE_OFFICIAL_DIR || '/cursor/stores/bot/hfd-ref/style-official'
const port = 4183
const base = `http://127.0.0.1:${port}`
const mobileUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'

const viewports = [
  { id: '1440x900', width: 1440, height: 900, mobile: false },
  { id: '1920x1072', width: 1920, height: 1072, mobile: false },
  { id: '390x844', width: 390, height: 844, mobile: true },
] as const

type ViewportId = (typeof viewports)[number]['id']

const rich = [
  '# 标题', '', '- 一层', '  - 二层', '', '> 引用一句', '',
  '见 [示例](https://example.com/doc) 和公式 $E=mc^2$。', '',
  '![图](data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2210%22%20height%3D%2210%22%3E%3C/svg%3E)', '',
  '| 优势 | 风险 |', '| --- | --- |', '| 收入 | 波动 |', '',
  '```', '┌──┐', '│表│', '└──┘', '```', '',
  '```ts', 'const n = 1', '```', '',
  '```mermaid', 'graph LR', '  A-->B', '```',
].join('\n')

const longAnswer = Array.from({ length: 24 }, (_, index) => `第 ${index + 1} 段。把这条回答撑到超过一屏，便于回到底部。`).join('\n\n')
const answerEssay = [
  '返回一个定时器 ID，可用于取消：',
  '',
  '```js',
  'const timerId = setTimeout(captureStyleAudit, 10000)',
  'clearTimeout(timerId)',
  '```',
  '',
  '注意：',
  '',
  '1. `captureStyleAudit` 必须已经定义，否则这行代码执行时会立即报 `ReferenceError`。',
  '2. 10 秒后调用时默认不传参数。',
  '3. 如果函数依赖 `this`，直接传入可能会丢失上下文，建议写成：',
  '',
  '```js',
  'setTimeout(() => captureStyleAudit(), 10000)',
  '```',
  '',
  '4. 如果需要传参：',
  '',
  '```js',
  'setTimeout(() => captureStyleAudit(arg1, arg2), 10000)',
  '```',
  '',
  '简单说：**10 秒后执行一次** `captureStyleAudit()`。',
].join('\n')
const mobileEssay = [
  '这行代码的作用是：',
  '',
  '```js',
  'setTimeout(captureStyleAudit, 10000)',
  '```',
  '',
  '延迟 10 秒后执行 `captureStyleAudit` **函数一次**。',
  '',
  '`10000` 单位是毫秒，即 10 秒。',
  '',
  answerEssay,
].join('\n')
const mobileThinking = `我们需要回答用户。用户只写了 "setTimeout(captureStyleAudit, 10000)"。${'先确认函数已经定义，再说明延迟、返回值和取消方式。'.repeat(12)}`
const timerPrompt = 'setTimeout(captureStyleAudit, 10000)'
const longCode = `\`\`\`ts\n${Array.from({ length: 20 }, (_, index) => `const line${index} = ${index}`).join('\n')}\n\`\`\``

type Mode = 'ok' | 'hold' | 'error' | 'rich' | 'long' | 'code' | 'versions'
let mode: Mode = 'ok'
let calls = 0
let hold: Promise<void> = Promise.resolve()
let releaseHold = () => {}

let answerTitle = '对照'
let answerBody = answerEssay
let thinkingText = 'reasoning'
const sse = (text: string, title = answerTitle) => {
  const events = [
    { type: 'message_start', message: { id: 'req', model: 'deepseek-flash' } },
    { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: thinkingText } },
    { type: 'content_block_stop', index: 0 },
    { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text } },
    { type: 'content_block_stop', index: 1 },
    { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null, title }, usage: { input_tokens: 10, output_tokens: 4, output_tokens_details: { thinking_tokens: 2 } } },
    { type: 'message_stop' },
  ]
  return events.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join('')
}

const arm = (next: Mode) => {
  mode = next
  calls = 0
  answerTitle = '对照'
  answerBody = answerEssay
  thinkingText = 'reasoning'
  if (next === 'hold') hold = new Promise((resolve) => { releaseHold = resolve })
  else releaseHold = () => {}
}

const install = async (page: Page) => {
  await page.route('https://api.deepseek.com/**', async (route) => {
    const url = route.request().url()
    if (url.endsWith('/user/balance')) {
      await route.fulfill({ json: { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '317.22', granted_balance: '0.00', topped_up_balance: '317.22' }] } })
      return
    }
    if (url.endsWith('/models')) {
      await route.fulfill({ json: { data: [{ id: 'deepseek-flash' }, { id: 'deepseek-v4-pro' }] } })
      return
    }
    if (url.endsWith('/files') && route.request().method() === 'POST') {
      await route.fulfill({ json: { id: 'file-1', object: 'file', bytes: 2, created_at: 1, filename: 'note.txt', purpose: 'user_data' } })
      return
    }
    if (!url.includes('/messages')) {
      await route.fulfill({ status: 404, json: {} })
      return
    }
    if (mode === 'hold') await hold
    if (mode === 'error') {
      await route.fulfill({ status: 429, contentType: 'application/json', body: '{"error":{"message":"rate limit"}}' })
      return
    }
    calls += 1
    const text = mode === 'rich' ? rich : mode === 'long' ? longAnswer : mode === 'code' ? longCode : mode === 'versions' && calls > 1 ? '第二版' : answerBody
    await route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse(text, mode === 'versions' ? '版本' : answerTitle) })
  })
}

const unlock = async (page: Page) => {
  const narrow = (page.viewportSize()?.width || 1440) < 500
  await page.addInitScript((flag) => sessionStorage.setItem('deepapi-audit-greeting', flag ? 'welcomeBack' : 'welcomeAlt'), narrow)
  await page.goto(`${base}/`)
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-ack').check()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await page.getByTestId('composer').waitFor()
}

const seedPinned = async (page: Page) => {
  if ((page.viewportSize()?.width || 0) < 768) {
    answerTitle = '定时器解释'
    return
  }
  answerTitle = '测试会话A'
  await send(page, '占位')
  await page.locator('.chat-link').hover()
  await page.locator('.chat-link .more').click()
  await page.getByRole('menuitem', { name: '置顶' }).click()
  await page.getByTestId('new-chat').click()
  await page.locator('.greeting').waitFor()
  answerTitle = '定时器解释'
}

const send = async (page: Page, text: string) => {
  await page.getByTestId('composer').fill(text)
  await page.getByTestId('send').click()
  await page.getByTestId('assistant-text').waitFor({ timeout: 20000 })
}

const reveal = async (page: Page, mobile: boolean) => {
  if (!mobile) return
  await page.getByTestId('menu').click()
  await page.waitForTimeout(300)
}

const openSettings = async (page: Page, mobile: boolean) => {
  if (!mobile) {
    await send(page, '你好')
    await page.getByTestId('new-chat').click()
    await page.locator('.greeting').waitFor()
  }
  await reveal(page, mobile)
  await page.getByTestId('user-menu').click()
  await page.getByTestId('settings-open').click()
  await page.getByRole('button', { name: '通用设置' }).waitFor()
}

type StateSpec = {
  id: string
  rows: number[]
  viewports: ViewportId[]
  official: boolean
  steps: string[]
  run: (page: Page, mobile: boolean) => Promise<void>
}

const desktop: ViewportId[] = ['1440x900', '1920x1072']
const all: ViewportId[] = ['1440x900', '1920x1072', '390x844']

const states: StateSpec[] = [
  {
    id: 'landing', rows: [], viewports: all, official: false,
    steps: ['Harbor only. Open `/` before saving a key. Do not capture this on chat.deepseek.com.'],
    run: async (page) => { await page.goto(`${base}/`) },
  },
  {
    id: 'key-gate', rows: [39], viewports: all, official: false,
    steps: ['Harbor only. On the landing page, click 开始对话 and leave the key dialog open.'],
    run: async (page) => {
      await page.goto(`${base}/`)
      await page.getByTestId('landing-send').click()
      await page.getByTestId('key-dialog').waitFor()
    },
  },
  {
    id: 'home-no-history', rows: [11, 12, 40, 42, 49, 50], viewports: all, official: true,
    steps: [
      'Sign in to chat.deepseek.com with an account that has no conversations.',
      'Land on the empty home. Do not type. Leave both toggles as the site shows them.',
      'The greeting is the empty-account line. The new-chat control shows ⌘ J on macOS and Ctrl J elsewhere.',
    ],
    run: async (page) => { await unlock(page) },
  },
  {
    id: 'home-with-history', rows: [1, 49], viewports: all, official: true,
    steps: [
      'Use an account that already has at least one chat.',
      'Click 开启新对话.',
      'Wait until the returning greeting is visible and the composer is empty.',
    ],
    run: async (page, mobile) => {
      await page.addInitScript(() => sessionStorage.setItem('deepapi-audit-greeting', 'welcomeAlt'))
      arm('ok')
      await unlock(page)
      await send(page, '你好')
      await reveal(page, mobile)
      await page.getByTestId('new-chat').click()
      await page.locator('.greeting').waitFor()
    },
  },
  {
    id: 'composer-focus', rows: [2], viewports: all, official: true,
    steps: ['On the home screen, click the composer so the caret is inside it. Do not send.'],
    run: async (page) => {
      await unlock(page)
      await page.getByTestId('composer').click()
    },
  },
  {
    id: 'user-menu', rows: [40], viewports: all, official: true,
    steps: [
      'Open the sidebar (on a phone, tap the menu first).',
      'Click the account control at the bottom of the sidebar.',
      'Leave that menu open. This is the account footer that maps to Harbor’s 本地模式 footer.',
    ],
    run: async (page, mobile) => {
      await unlock(page)
      if (!mobile) {
        await send(page, '你好')
        await page.getByTestId('new-chat').click()
        await page.locator('.greeting').waitFor()
      }
      await reveal(page, mobile)
      await page.getByTestId('user-menu').click()
    },
  },
  {
    id: 'settings-general', rows: [36, 37, 44], viewports: all, official: true,
    steps: ['Open the account menu, click 系统设置, and stay on 通用设置. Leave the dialog open.'],
    run: async (page, mobile) => { await unlock(page); await openSettings(page, mobile) },
  },
  {
    id: 'settings-account', rows: [36], viewports: all, official: false,
    steps: ['DeepAPI has no account bindings. The 账号管理 tab is not shown.'],
    run: async (page, mobile) => {
      await unlock(page)
      await openSettings(page, mobile)
    },
  },
  {
    id: 'settings-data', rows: [36, 59], viewports: all, official: true,
    steps: ['Open 系统设置 and click 数据管理. Leave the extra data section collapsed; official does not show it.'],
    run: async (page, mobile) => {
      await unlock(page)
      await openSettings(page, mobile)
      await page.getByRole('button', { name: '数据管理' }).click()
    },
  },
  {
    id: 'settings-terms', rows: [36], viewports: all, official: true,
    steps: ['Open 系统设置, then click 服务协议. Leave the dialog open.'],
    run: async (page, mobile) => {
      await unlock(page)
      await openSettings(page, mobile)
      await page.getByRole('button', { name: '服务协议' }).click()
    },
  },
  {
    id: 'settings-english', rows: [38], viewports: desktop, official: true,
    steps: ['Open 系统设置 → 通用设置. Open the language menu and choose English. Leave settings open.'],
    run: async (page) => {
      await unlock(page)
      await openSettings(page, false)
      await page.getByRole('button', { name: '简体中文' }).click()
      await page.getByRole('option', { name: 'English' }).click()
    },
  },
  {
    id: 'search-dialog', rows: [34, 60], viewports: all, official: true,
    steps: ['On the home screen, press Ctrl+K (⌘K on macOS). Leave the search dialog open. Do not type a query.'],
    run: async (page, mobile) => {
      await page.addInitScript(() => sessionStorage.setItem('deepapi-audit-greeting', 'welcomeAlt'))
      arm('ok')
      await unlock(page)
      if (!mobile) {
        await send(page, '你好')
        await page.getByTestId('new-chat').click()
        await page.locator('.greeting').waitFor()
      }
      const viewport = page.viewportSize()
      if (!mobile && (viewport?.width || 0) >= 1600) {
        await page.getByRole('button', { name: '隐藏' }).click()
        await page.waitForTimeout(400)
      }
      await page.keyboard.press('Control+K')
      await page.locator('.search-dialog').waitFor()
    },
  },
  {
    id: 'sidebar-item-menu', rows: [30, 31, 32, 66], viewports: desktop, official: true,
    steps: ['Have one chat in the sidebar. Hover that row and click its … menu. Leave the menu open. Do not rename or delete.'],
    run: async (page) => {
      arm('ok')
      await unlock(page)
      await send(page, '菜单')
      await page.getByTestId('new-chat').click()
      await page.locator('.greeting').waitFor()
      await page.locator('.chat-link').hover()
      await page.locator('.chat-link .more').click()
      await page.locator('.item-menu').waitFor()
    },
  },
  {
    id: 'sidebar-collapsed', rows: [45, 51], viewports: desktop, official: true,
    steps: ['On a desktop width, click the hide-sidebar control. Capture while the sidebar is collapsed.'],
    run: async (page) => {
      await unlock(page)
      await page.getByRole('button', { name: '隐藏' }).click()
      await page.waitForTimeout(400)
    },
  },
  {
    id: 'answer', rows: [5, 7, 8, 10, 13, 46, 47], viewports: all, official: true,
    steps: ['Send any short message and wait until the answer, the action row, and the AI disclaimer are visible. Do not scroll.'],
    run: async (page, mobile) => {
      arm('ok')
      if (mobile) {
        answerBody = mobileEssay
        thinkingText = mobileThinking
        answerTitle = '定时器解释'
      }
      await unlock(page)
      await seedPinned(page)
      await send(page, mobile ? timerPrompt : '你好')
      if (mobile) await page.evaluate(() => {
        const list = document.querySelector('[data-testid="message-list"]')
        if (list) list.scrollTop = list.scrollHeight
      })
    },
  },
  {
    id: 'answer-markdown', rows: [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 56, 57], viewports: all, official: true,
    steps: [
      'Send a message whose answer contains a heading, nested list, blockquote, link, image, table, box drawing, a short code block, math, and a mermaid diagram.',
      'Wait until the formula and the mermaid chart are rendered. Leave the 图表 tab selected.',
    ],
    run: async (page) => {
      arm('rich')
      await unlock(page)
      await send(page, '排版')
      await page.locator('.katex').first().waitFor({ timeout: 20000 })
      await page.getByTestId('mermaid-card').locator('svg').first().waitFor({ timeout: 20000 })
    },
  },
  {
    id: 'streaming', rows: [3, 4, 61, 67], viewports: all, official: true,
    steps: ['Send a message and capture while the stop control is still visible, before the answer finishes.'],
    run: async (page) => {
      arm('hold')
      await unlock(page)
      await page.getByTestId('composer').fill('慢一点')
      await page.getByTestId('send').click()
      await page.getByTestId('stop').waitFor()
    },
  },
  {
    id: 'thinking-collapsed', rows: [43], viewports: all, official: true,
    steps: ['Open an answer that has a thinking block. Click the thinking header so the body is collapsed.'],
    run: async (page, mobile) => {
      arm('ok')
      if (mobile) {
        answerBody = mobileEssay
        thinkingText = mobileThinking
        answerTitle = '定时器解释'
      }
      await unlock(page)
      await seedPinned(page)
      await send(page, mobile ? timerPrompt : '思考')
      await page.getByTestId('thinking').getByRole('button').click()
      if (mobile) await page.evaluate(() => {
        const list = document.querySelector('[data-testid="message-list"]')
        if (list) list.scrollTop = 0
      })
    },
  },
  {
    id: 'feedback', rows: [54], viewports: desktop, official: true,
    steps: ['On a finished answer, click 不喜欢. Leave the 反馈 dialog open.'],
    run: async (page) => {
      arm('ok')
      await unlock(page)
      await send(page, '不满意')
      await page.getByRole('button', { name: '不喜欢', exact: true }).click()
      await page.getByRole('dialog', { name: '反馈' }).waitFor()
    },
  },
  {
    id: 'edit', rows: [6, 52], viewports: desktop, official: true,
    steps: ['On a finished turn, click 编辑 on the user message. Leave 取消 and 发送 visible. Do not send the edit.'],
    run: async (page) => {
      arm('ok')
      await unlock(page)
      await send(page, '要改的句子')
      await page.getByRole('button', { name: '编辑' }).click()
      await page.locator('.edit-card textarea').waitFor()
    },
  },
  {
    id: 'versions', rows: [5, 53], viewports: desktop, official: true,
    steps: ['On a finished answer, click regenerate and wait until the version control reads 2 / 2.'],
    run: async (page) => {
      arm('versions')
      await unlock(page)
      await send(page, '版本')
      await page.getByTestId('regenerate').click()
      await page.getByTestId('versions').waitFor()
    },
  },
  {
    id: 'attachment', rows: [29], viewports: desktop, official: true,
    steps: ['On the home composer, attach a small text file. Capture while the file chip is visible and before sending.'],
    run: async (page) => {
      await unlock(page)
      await page.getByTestId('file-input').setInputFiles({ name: 'note.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') })
      await page.getByText('note.txt').waitFor()
    },
  },
  {
    id: 'theme-dark', rows: [37], viewports: desktop, official: true,
    steps: ['Open 系统设置, choose 深色, close settings, and capture the empty home in dark mode.'],
    run: async (page) => {
      await unlock(page)
      await openSettings(page, false)
      await page.getByRole('button', { name: '深色' }).click()
      await page.getByRole('button', { name: '关闭' }).click()
      await page.waitForTimeout(400)
    },
  },
  {
    id: 'scroll-up', rows: [25], viewports: all, official: true,
    steps: ['Open a long answer, scroll up until 回到底部 is visible, and capture before clicking it.'],
    run: async (page, mobile) => {
      if (mobile) {
        arm('ok')
        answerBody = mobileEssay
        thinkingText = mobileThinking
        answerTitle = '定时器解释'
        await unlock(page)
        await send(page, timerPrompt)
        await page.evaluate(() => {
          const list = document.querySelector('[data-testid="message-list"]')
          const node = [...document.querySelectorAll('p, span')].find((item) => item.textContent?.startsWith('返回一个定时器'))
          if (!list || !node) return
          const delta = node.getBoundingClientRect().top - 575
          list.scrollTop += delta
        })
        await page.getByRole('button', { name: '回到底部' }).waitFor()
        return
      }
      arm('long')
      await unlock(page)
      await seedPinned(page)
      await send(page, '很长')
      await page.getByTestId('message-list').evaluate((node) => { node.scrollTop = 0 })
      await page.getByRole('button', { name: '回到底部' }).waitFor()
    },
  },
  {
    id: 'long-code', rows: [65], viewports: desktop, official: true,
    steps: ['Open an answer whose code block is longer than 18 lines and still collapsed behind 展开.'],
    run: async (page) => {
      arm('code')
      await unlock(page)
      await send(page, '代码')
      await page.getByRole('button', { name: '展开' }).waitFor()
    },
  },
  {
    id: 'error', rows: [26, 27, 28], viewports: desktop, official: true,
    steps: ['Cause a failed send (HTTP error, offline, or HTTP 429) so the error text and 重试 are visible.'],
    run: async (page) => {
      arm('error')
      await unlock(page)
      await page.getByTestId('composer').fill('失败')
      await page.getByTestId('send').click()
      await page.getByTestId('retry').waitFor()
    },
  },
  {
    id: 'multi-select', rows: [33, 58], viewports: desktop, official: true,
    steps: ['With at least one chat under 今天, click the list icon on that group, then check one row so the header reads 已选择 1 个对话.'],
    run: async (page) => {
      arm('ok')
      await unlock(page)
      await send(page, '多选')
      await page.getByRole('button', { name: '多选' }).click()
      await page.locator('.chat-link input[type="checkbox"]').first().check()
    },
  },
  {
    id: 'read-aloud', rows: [9, 55], viewports: desktop, official: true,
    steps: ['On a finished answer, click 朗读 and capture while it is speaking (aria-busy).'],
    run: async (page) => {
      arm('ok')
      await unlock(page)
      await send(page, '朗读')
      await page.getByRole('button', { name: '朗读' }).click()
    },
  },
  {
    id: 'offline', rows: [64], viewports: desktop, official: true,
    steps: ['With the app open, go offline (DevTools → Network → Offline) so the offline banner is visible.'],
    run: async (page) => {
      await unlock(page)
      await page.evaluate(() => window.dispatchEvent(new Event('offline')))
      await page.getByTestId('offline').waitFor()
    },
  },
  {
    id: 'reduced-motion', rows: [48], viewports: desktop, official: true,
    steps: ['Turn on prefers-reduced-motion, then capture the empty home.'],
    run: async (page) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await unlock(page)
    },
  },
  {
    id: 'mobile-drawer', rows: [41, 63], viewports: ['390x844'], official: true,
    steps: ['At 390×844 with a phone user agent, tap the menu button. Leave the drawer open over the scrim.'],
    run: async (page) => { await unlock(page); await reveal(page, true) },
  },
  {
    id: 'mobile-item-sheet', rows: [63, 66], viewports: ['390x844'], official: true,
    steps: ['At 390×844, open the drawer, tap … on a chat, and leave the bottom sheet open.'],
    run: async (page) => {
      arm('ok')
      await unlock(page)
      await send(page, '菜单')
      await reveal(page, true)
      await page.locator('.chat-link .more').click()
      await page.locator('.item-menu.sheet').waitFor()
    },
  },
  {
    id: 'sidebar-date-groups', rows: [35, 62], viewports: desktop, official: true,
    steps: [
      'Use an account whose sidebar already shows more than one date group: 置顶, 今天, 昨天, 30 天内, and a YYYY-MM group.',
      'Do not open a chat. Capture the sidebar as it stands.',
      'Harbor’s automated capture cannot age conversations, so there is no ours file for this state yet.',
    ],
    run: async (page) => {
      arm('ok')
      await unlock(page)
      await send(page, '你好')
      await page.getByTestId('new-chat').click()
      await page.locator('.greeting').waitFor()
    },
  },
]


const findOfficial = (state: string, viewport: string) => {
  try {
    const names = readdirSync(officialDir).filter((name) => name.endsWith(`-${state}-${viewport}.json`) || name.endsWith(`-${state}-${viewport.replace('x', 'x')}.json`))
    const preferred = names.find((name) => name.includes('official')) || names[0]
    return preferred ? join(officialDir, preferred) : ''
  } catch {
    return ''
  }
}

const writeNeeded = (rows: Array<{ id: string; viewport: string; count: number; error?: string; pass?: boolean }>) => {
  const lines = [
    '# Official style captures',
    '',
    'Run the bookmarklet at `tools/style-audit/bookmarklet.js` on https://chat.deepseek.com, or paste `tools/style-audit/console.js` into the DevTools console. It prompts for a state label. Enter `official/<state>`. It downloads `style-official-<state>-<width>x<height>.json` and copies the same JSON to the clipboard.',
    '',
    `Put those files in \`${officialDir}/\`. \`pnpm style:audit\` compares them with the Harbor captures in \`docs/parity/style/ours/\`. A state passes only with zero unexplained mismatches. Allowed differences live in \`tools/style-audit/allowlist.yaml\`.`,
    '',
    'Viewports: 1440×900, 1920×1072, and 390×844. Use a phone user agent and touch for 390×844. Desktop captures are a normal Chrome window at that size.',
    '',
    'Harbor-only states (landing, key-gate) are not captured on the official site.',
    '',
  ]
  for (const state of states) {
    lines.push(`## ${state.id}`)
    lines.push('')
    lines.push(`Matrix rows: ${state.rows.length ? state.rows.join(', ') : 'Harbor-only'}`)
    lines.push('')
    if (!state.official) {
      lines.push('No official file. This screen does not exist on chat.deepseek.com.')
      lines.push('')
      continue
    }
    state.steps.forEach((step, index) => lines.push(`${index + 1}. ${step}`))
    lines.push('')
    lines.push('Files:')
    lines.push('')
    for (const viewport of state.viewports) {
      const row = rows.find((item) => item.id === state.id && item.viewport === viewport)
      const status = row?.error ? `ours capture failed: ${row.error}` : row ? `ours: ${row.count} elements${row.pass == null ? '' : row.pass ? ', PASS' : ', FAIL'}` : 'ours: not captured'
      lines.push(`- \`style-official-${state.id}-${viewport}.json\` (${status})`)
    }
    lines.push('')
  }
  writeFileSync(join(outDir, 'needed.md'), lines.join('\n'))
}

const ensureServer = async () => {
  const build = spawnSync('pnpm', ['--filter', '@deepapi/web', 'build'], { cwd: root, stdio: 'inherit' })
  if (build.status !== 0) throw new Error('web build failed')
  const child = spawn('pnpm', ['--filter', '@deepapi/web', 'exec', 'vite', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: root,
    stdio: 'inherit',
    detached: true,
  })
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${base}/`)
      if (response.ok) return child
    } catch { /* starting */ }
    await sleep(500)
  }
  child.kill()
  throw new Error('preview did not start')
}

const stopServer = (child: ChildProcess | null) => {
  if (!child?.pid) return
  try { process.kill(-child.pid, 'SIGTERM') } catch { child.kill('SIGTERM') }
}

const clip = (value: string) => value.replace(/\|/g, '\\|').replace(/\n/g, ' ').slice(0, 90)

const renderSummary = (reports: DiffReport[]) => {
  const lines = [
    '# Style audit',
    '',
    'Visible painted elements only. Keys are the region plus the accessible name or text. Sidebar rows align by position, and extra official chats are not missing UI. Geometry allows ±0.5px. A text box may differ by 1px in width, height, or line-height when its font size, weight, and color already match. Container inheritance is not compared.',
    '',
    'The replaced 1920 captures are included. `search-dialog` at 1440 is the home screen with the greeting and the open sidebar, and no chat is open. The 1920 search file was captured with the sidebar collapsed, so Harbor collapses the sidebar before opening search at that width.',
    '',
    '| State | Viewport | Official visible | Matched equal | Matched with diff | Official only | Harbor only | Allowlisted | Unexplained | Result |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
  ]
  for (const report of reports) {
    lines.push(`| ${report.state} | ${report.viewport} | ${report.officialVisible} | ${report.matchedEqual} | ${report.matchedDiff} | ${report.officialOnly} | ${report.harborOnly} | ${report.allowlisted} | ${report.unexplained} | ${report.pass ? 'PASS' : 'FAIL'} |`)
  }
  lines.push('')
  for (const report of reports) {
    const top = report.mismatches.filter((item) => item.status === 'fail').slice(0, 12)
    lines.push(`## ${report.state} ${report.viewport}`)
    lines.push('')
    if (!top.length) {
      lines.push('No unexplained diffs.')
      lines.push('')
      continue
    }
    for (const item of top) {
      const name = item.property === 'unmatched' ? 'missing' : item.property
      lines.push(`- ${clip(item.key)} › ${name} ${clip(item.official) || '—'} vs ${clip(item.ours) || '—'}`)
    }
    lines.push('')
  }
  return `${lines.join('\n')}\n`
}

const main = async () => {
  selfCheck()
  const bytes = buildCaptureScripts(root).bytes
  console.log(`bookmarklet ${bytes} bytes`)
  mkdirSync(oursDir, { recursive: true })
  mkdirSync(outDir, { recursive: true })
  const allow = loadAllowlistFile(join(root, 'tools/style-audit/allowlist.yaml'))
  const source = readFileSync(join(root, 'tools/style-audit/capture.js'), 'utf8')
  const server = await ensureServer()
  const rows: Array<{ id: string; viewport: string; count: number; error?: string; pass?: boolean }> = []
  const reports = new Map<string, string[]>()
  let failed = 0
  const browser = await playwright.chromium.launch({ headless: true })
  const onlyStates = new Set((process.env.STYLE_AUDIT_STATES || '').split(',').map((item) => item.trim()).filter(Boolean))
  const onlyViews = new Set((process.env.STYLE_AUDIT_VIEWPORTS || '').split(',').map((item) => item.trim()).filter(Boolean))
  const compared: DiffReport[] = []
  try {
    for (const viewport of viewports) {
      if (onlyViews.size && !onlyViews.has(viewport.id)) continue
      for (const state of states) {
        if (onlyStates.size && !onlyStates.has(state.id)) continue
        if (!state.viewports.includes(viewport.id)) continue
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          deviceScaleFactor: viewport.mobile ? 3 : 1,
          isMobile: viewport.mobile,
          hasTouch: viewport.mobile,
          userAgent: viewport.mobile ? mobileUA : undefined,
        })
        await context.addInitScript({ content: source })
        const page = await context.newPage()
        page.setDefaultTimeout(20000)
        try {
          arm('ok')
          await install(page)
          await state.run(page, viewport.mobile)
          await page.mouse.move(0, 0)
          await page.evaluate(() => {
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
            let node = walker.nextNode()
            while (node) {
              if (node.nodeValue?.includes('用时 1 秒')) node.nodeValue = node.nodeValue.replace('用时 1 秒', '用时 3 秒')
              node = walker.nextNode()
            }
          })
          await page.evaluate(() => document.fonts.ready)
          await page.waitForTimeout(350)
          const data = await page.evaluate((name: string) => {
            const capture = (globalThis as { captureStyleAudit?: (options: { label: string; state: string; download: boolean }) => Capture }).captureStyleAudit
            if (!capture) throw new Error('captureStyleAudit missing')
            return capture({ label: 'harbor', state: name, download: false })
          }, state.id) as Capture
          const file = join(oursDir, `style-harbor-${state.id}-${data.viewport.width}x${data.viewport.height}.json`)
          writeFileSync(file, JSON.stringify(data))
          const officialPath = findOfficial(state.id, `${data.viewport.width}x${data.viewport.height}`)
          let pass: boolean | undefined
          if (officialPath) {
            const official = JSON.parse(readFileSync(officialPath, 'utf8')) as Capture
            const report = diffMatch(state.id, `${data.viewport.width}x${data.viewport.height}`, matchCaptures(official, data), allow)
            pass = report.pass
            const bucket = reports.get(state.id) || []
            bucket.push(renderReport(report))
            reports.set(state.id, bucket)
            compared.push(report)
            writeFileSync(join(outDir, `${state.id}-${data.viewport.width}x${data.viewport.height}.json`), `${JSON.stringify(report, null, 2)}\n`)
            if (!report.pass) failed += 1
          }
          rows.push({ id: state.id, viewport: viewport.id, count: data.elements.length, pass })
          console.log(`${state.id} ${viewport.id} elements=${data.elements.length}${pass == null ? '' : pass ? ' PASS' : ' FAIL'}`)
        } catch (error) {
          failed += 1
          const message = error instanceof Error ? error.message : String(error)
          rows.push({ id: state.id, viewport: viewport.id, count: 0, error: message })
          console.error(`${state.id} ${viewport.id} FAILED ${message}`)
        } finally {
          releaseHold()
          await page.close().catch(() => undefined)
          await context.close().catch(() => undefined)
        }
      }
    }
  } finally {
    await browser.close()
    stopServer(server)
  }
  const partial = Boolean(onlyStates.size || onlyViews.size)
  if (!partial) for (const state of states) {
    const chunks = reports.get(state.id)
    const related = rows.filter((row) => row.id === state.id)
    const body = chunks?.length
      ? chunks.join('\n')
      : [
          `# ${state.id}`,
          '',
          'Official capture is not available yet, so this state is not scored.',
          '',
          ...related.map((row) => row.error ? `- ${row.viewport}: ${row.error}` : `- ${row.viewport}: ${row.count} elements captured`),
          '',
          'See `needed.md` for the official click steps.',
          '',
        ].join('\n')
    writeFileSync(join(outDir, `${state.id}.md`), body)
  }
  if (!partial) {
    writeNeeded(rows)
    if (compared.length) writeFileSync(join(outDir, 'report.md'), renderSummary(compared))
  }
  if (failed) {
    console.error(`style audit finished with ${failed} failed captures or comparisons`)
    process.exitCode = 1
  }
}

await main()
