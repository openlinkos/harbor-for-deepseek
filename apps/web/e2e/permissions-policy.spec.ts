// Voice input against the production response headers.
//
// The other speech specs stub navigator.mediaDevices.getUserMedia and run on
// `vite preview`, which sends no security headers, so a Permissions-Policy that
// blocks the microphone (microphone=()) passed every test while production
// rejected the call before any prompt ("无法使用麦克风" on the first click).
//
// Here the built dist is served with the exact headers from dist/_headers (the
// postbuild step asserts it equals apps/web/public/_headers, and
// scripts/check-permissions-policy.mjs asserts nginx, Caddy and the server ship the
// same Permissions-Policy). getUserMedia is the real one, fed by Chromium's fake
// capture device.
//
// - Not pre-granted, full headless Chromium (channel 'chromium'): the browser opens
//   a real permission prompt and getUserMedia stays pending. Under microphone=() it
//   rejects at once with NotAllowedError and the toast appears instead.
// - The fake UI flag stands in for the user pressing 允许; grantPermissions for a
//   site already allowed. A blocked policy rejects in both cases.
// - A site the user blocked (CDP Browser.setPermission denied) gets the settings toast.
// The headless shell Playwright uses by default has no prompt support
// (NotSupportedError), so the prompt cases launch the full Chromium build.
import { readFileSync, statSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test, type Browser, type BrowserContext, type Page, type Route } from '@playwright/test'

const dist = fileURLToPath(new URL('../dist/', import.meta.url))

/** Headers for `/*` from a Cloudflare Pages style _headers file. */
const productionHeaders = () => {
  const text = readFileSync(join(dist, '_headers'), 'utf8')
  const headers: Record<string, string> = {}
  let inBlock = false
  for (const line of text.split('\n')) {
    if (/^\S/.test(line)) {
      inBlock = line.trim() === '/*'
      continue
    }
    const match = /^\s+([A-Za-z-]+):\s*(.+)$/.exec(line)
    if (inBlock && match) headers[match[1]] = match[2].trim()
  }
  return headers
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain',
}

let server: Server
let origin = ''
let headers: Record<string, string> = {}

test.beforeAll(async () => {
  headers = productionHeaders()
  server = createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '')
    let file = join(dist, path)
    try {
      if (statSync(file).isDirectory()) file = join(file, 'index.html')
      statSync(file)
    } catch {
      file = join(dist, 'index.html')
    }
    res.writeHead(200, { ...headers, 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-cache' })
    res.end(readFileSync(file))
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

test.afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

const unlock = async (page: Page) => {
  const asr: string[] = []
  await page.route('https://api.deepseek.com/**', async (route: Route) => {
    const url = route.request().url()
    if (url.includes('/v1/tools/asr')) {
      asr.push(url)
      await route.fulfill({ json: { text: '转写结果' } })
      return
    }
    if (url.endsWith('/user/balance')) {
      await route.fulfill({ json: { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '1.00', granted_balance: '0', topped_up_balance: '1.00' }] } })
      return
    }
    if (url.endsWith('/models')) {
      await route.fulfill({ json: { data: [{ id: 'deepseek-flash' }] } })
      return
    }
    await route.fulfill({ status: 404, json: { error: { message: 'not mocked' } } })
  })
  const response = await page.goto(`${origin}/`)
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()
  return { response, asr }
}

const policyState = (page: Page) =>
  page.evaluate(async () => {
    const doc = document as Document & { featurePolicy?: { allowsFeature(name: string): boolean } }
    const status = await navigator.permissions.query({ name: 'microphone' as PermissionName })
    return { allowsMicrophone: doc.featurePolicy?.allowsFeature('microphone') ?? null, permission: status.state }
  })

const expectRecording = async (page: Page) => {
  await page.getByTestId('voice-input').click()
  // Either outcome ends the wait. A blocked policy lands on the toast: NotAllowedError -> 无法使用麦克风.
  await expect(page.locator('[data-testid="speech-notice"], [data-testid="voice-input"][aria-label="结束录音并转写"]').first()).toBeVisible()
  const notice = await page.getByTestId('speech-notice').allTextContents()
  expect(notice, `toast instead of recording: ${notice.join(' / ')}`).toEqual([])
  await expect(page.getByTestId('voice-input')).toHaveAttribute('aria-label', '结束录音并转写')
  await expect(page.getByTestId('voice-timer')).toHaveText(/录音中 \d+s/)
}

/** Counts real getUserMedia calls and how they settle, without changing them. */
const watchGetUserMedia = (page: Page) =>
  page.addInitScript(() => {
    const devices = navigator.mediaDevices
    const real = devices.getUserMedia.bind(devices)
    const mark = window as unknown as { __gum: { calls: number; settled: string | null } }
    mark.__gum = { calls: 0, settled: null }
    devices.getUserMedia = (constraints) => {
      mark.__gum.calls += 1
      return real(constraints).then(
        (stream) => {
          mark.__gum.settled = 'stream'
          return stream
        },
        (error: DOMException) => {
          mark.__gum.settled = error.name
          throw error
        },
      )
    }
  })

const gum = (page: Page) => page.evaluate(() => (window as unknown as { __gum: { calls: number; settled: string | null } }).__gum)

type Launcher = { chromium: { launch(options: object): Promise<Browser> } }

/**
 * Full headless Chromium with a fake capture device. Without `acceptPrompt` the
 * permission prompt is real and stays open; with it, Chromium's fake UI presses 允许.
 */
const launch = (playwright: Launcher, acceptPrompt = false) =>
  playwright.chromium.launch({
    channel: 'chromium',
    ignoreDefaultArgs: ['--mute-audio'],
    args: ['--use-fake-device-for-media-stream', ...(acceptPrompt ? ['--use-fake-ui-for-media-stream'] : [])],
  })

const newPage = async (browser: Browser) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 820 }, timezoneId: 'Asia/Shanghai' })
  return { context, page: await context.newPage() }
}

const withBrowser = async (playwright: Launcher, acceptPrompt: boolean, body: (page: Page, context: BrowserContext) => Promise<void>) => {
  const browser = await launch(playwright, acceptPrompt)
  try {
    const { context, page } = await newPage(browser)
    await body(page, context)
  } finally {
    await browser.close()
  }
}

test('not pre-granted: voice input opens the browser permission prompt, no toast', async ({ playwright }) => {
  const browser = await launch(playwright)
  try {
    const { page } = await newPage(browser)
    await watchGetUserMedia(page)
    const { response } = await unlock(page)
    const sent = response?.headers()['permissions-policy'] ?? ''
    expect(sent, 'the test server must send the production Permissions-Policy').toBe(headers['Permissions-Policy'])
    // Soft, so a blocked policy also reports what the click does.
    expect.soft(sent).toMatch(/(?:^|,\s*)microphone=\(self\)(?:,|$)/)
    expect.soft(sent).toMatch(/(?:^|,\s*)camera=\(\)(?:,|$)/)
    expect.soft(sent).toMatch(/(?:^|,\s*)geolocation=\(\)(?:,|$)/)
    // Under microphone=() this reads { allowsMicrophone: false, permission: 'denied' }.
    expect.soft(await policyState(page)).toEqual({ allowsMicrophone: true, permission: 'prompt' })
    await page.getByTestId('voice-input').click()
    await expect.poll(async () => (await gum(page)).calls).toBe(1)
    // The prompt is open: the call stays pending and no toast appears.
    await page.waitForTimeout(2000)
    const notice = await page.getByTestId('speech-notice').allTextContents()
    expect.soft(notice, `toast instead of a prompt: ${notice.join(' / ')}`).toEqual([])
    expect(await gum(page)).toEqual({ calls: 1, settled: null })
  } finally {
    await browser.close()
  }
})

test('pressing 允许 on the prompt records under the production headers', async ({ playwright }) => {
  await withBrowser(playwright, true, async (page) => {
    await unlock(page)
    // The fake UI reports the permission as granted; only the policy decides here.
    expect.soft((await policyState(page)).allowsMicrophone).toBe(true)
    await expectRecording(page)
  })
})

test('a pre-granted microphone records under the production headers', async ({ playwright }) => {
  await withBrowser(playwright, false, async (page, context) => {
    await context.grantPermissions(['microphone'], { origin })
    await unlock(page)
    expect.soft(await policyState(page)).toEqual({ allowsMicrophone: true, permission: 'granted' })
    // Under microphone=() the grant does not help: NotAllowedError, then the toast.
    await expectRecording(page)
  })
})

test('camera and geolocation stay blocked by the policy', async ({ playwright }) => {
  await withBrowser(playwright, true, async (page) => {
    await unlock(page)
    const state = await page.evaluate(async () => {
      const doc = document as Document & { featurePolicy?: { allowsFeature(name: string): boolean } }
      const camera = await navigator.permissions.query({ name: 'camera' as PermissionName })
      const geolocation = await navigator.permissions.query({ name: 'geolocation' })
      const video = await navigator.mediaDevices.getUserMedia({ video: true }).then(
        (stream) => {
          stream.getTracks().forEach((track) => track.stop())
          return 'opened'
        },
        (error: DOMException) => error.name,
      )
      return {
        camera: [doc.featurePolicy?.allowsFeature('camera'), camera.state, video],
        geolocation: [doc.featurePolicy?.allowsFeature('geolocation'), geolocation.state],
      }
    })
    expect(state).toEqual({ camera: [false, 'denied', 'NotAllowedError'], geolocation: [false, 'denied'] })
  })
})

test('a site the user blocked shows the settings notice and uploads nothing', async ({ playwright }) => {
  const browser = await launch(playwright)
  try {
    const { context, page } = await newPage(browser)
    await watchGetUserMedia(page)
    const { asr } = await unlock(page)
    const cdp = await context.newCDPSession(page)
    const { targetInfo } = (await cdp.send('Target.getTargetInfo')) as { targetInfo: { browserContextId?: string } }
    await cdp.send('Browser.setPermission', { permission: { name: 'microphone' }, setting: 'denied', origin, browserContextId: targetInfo.browserContextId })
    expect.soft(await policyState(page)).toEqual({ allowsMicrophone: true, permission: 'denied' })
    await page.getByTestId('voice-input').click()
    await expect(page.getByTestId('speech-notice')).toHaveText('无法使用麦克风，请在浏览器设置中允许访问')
    expect(await gum(page)).toEqual({ calls: 1, settled: 'NotAllowedError' })
    await expect(page.getByTestId('voice-input')).toHaveAttribute('aria-label', '语音输入')
    expect(asr).toHaveLength(0)
  } finally {
    await browser.close()
  }
})
