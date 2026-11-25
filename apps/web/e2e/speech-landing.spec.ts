import { readFileSync } from 'node:fs'
import { expect, test, type Page, type Route } from '@playwright/test'
import { observeRecorderSamples, waitForRecorderSamples } from './lib/recording-readiness'

test.use({ ignoreHTTPSErrors: true })

const SSE = readFileSync(new URL('./lib/fb1344-sse.js', import.meta.url), 'utf8')

const sse = (text: string, title: string) => {
  const events = [
    { type: 'message_start', message: { id: 'req', model: 'deepseek-flash' } },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null, title }, usage: { input_tokens: 4, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 4, service_tier: 'standard' } },
    { type: 'message_stop' },
  ]
  return `${events.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join('')}: keep-alive\n\n`
}

const pcm = () => Buffer.alloc(4800)

const installMedia = async (page: Page) => {
  await observeRecorderSamples(page)
  await page.addInitScript(() => {
    const makeStream = () => {
      const context = new AudioContext()
      const oscillator = context.createOscillator()
      const destination = context.createMediaStreamDestination()
      oscillator.frequency.value = 440
      oscillator.connect(destination)
      // A context whose only output is a media-stream destination sometimes
      // stops rendering in headless Chrome, so the recorder gets no buffers.
      oscillator.connect(context.destination)
      oscillator.start()
      void context.resume()
      return destination.stream
    }
    navigator.mediaDevices.getUserMedia = async () => makeStream()
  })
}

/** Records the tracks getUserMedia returned. Does not wrap stop or change the stream. */
const recordReturnedTracks = async (page: Page) => {
  await page.addInitScript(() => {
    const devices = navigator.mediaDevices
    const wrapped = devices.getUserMedia.bind(devices)
    devices.getUserMedia = async (constraints) => {
      const stream = await wrapped(constraints)
      const mark = window as unknown as { __gumTracks?: MediaStreamTrack[] }
      const tracks = mark.__gumTracks ?? []
      mark.__gumTracks = tracks
      for (const track of stream.getTracks()) tracks.push(track)
      return stream
    }
  })
}

const unlock = async (page: Page) => {
  let releaseAsr: (() => void) | null = null
  const asrGate = new Promise<void>((resolve) => { releaseAsr = resolve })
  const seen: { url: string; body: string; bytes: Buffer }[] = []
  const failed: string[] = []
  page.on('request', (request) => {
    if (request.method() !== 'POST') return
    seen.push({ url: request.url(), body: request.postData() ?? '', bytes: request.postDataBuffer() ?? Buffer.alloc(0) })
  })
  page.on('requestfailed', (request) => {
    failed.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`)
  })
  await page.route('https://api.deepseek.com/**', async (route: Route) => {
    const url = route.request().url()
    if (url.includes('/v1/tools/asr')) {
      await asrGate
      try {
        await route.fulfill({ json: { text: '转写结果' } })
      } catch {
        /* The page aborted the upload. */
      }
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
    if (!url.includes('/messages')) {
      await route.fulfill({ status: 404, json: { error: { message: 'not mocked' } } })
      return
    }
    const raw = route.request().postData() ?? ''
    const title = raw.includes('下一句') ? '下一句' : '语音'
    await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: sse('合成回答。', title) })
  })
  await page.goto('/')
  await page.getByTestId('landing-send').click()
  await page.getByTestId('key-input').fill('demo-local-key')
  await page.getByTestId('key-save').click()
  await expect(page.getByTestId('composer')).toBeVisible()
  return {
    seen,
    failed,
    releaseAsr: () => releaseAsr?.(),
  }
}

const messagePosts = (seen: { url: string }[]) => seen.filter((item) => item.url.includes('/messages'))
const asrPosts = (seen: { url: string }[]) => seen.filter((item) => item.url.includes('/v1/tools/asr'))

type Entry = {
  name: string
  viewport: { width: number; height: number }
  /** The phone drawer scrim covers the composer, so open it only after the mic is live. */
  revealAfterArm: boolean
  reveal: (page: Page) => Promise<void>
  click: (page: Page) => Promise<void>
}

const entries: Entry[] = [
  {
    name: 'sidebar new-chat at 1280',
    viewport: { width: 1280, height: 820 },
    revealAfterArm: false,
    reveal: async (page) => {
      await expect(page.getByTestId('new-chat')).toBeVisible()
    },
    click: async (page) => {
      await page.getByTestId('new-chat').click()
    },
  },
  {
    name: 'collapsed new-chat at 1280',
    viewport: { width: 1280, height: 820 },
    revealAfterArm: false,
    reveal: async (page) => {
      await page.locator('.sidebar').getByRole('button', { name: '收起边栏', exact: true }).click()
      await expect(page.locator('.float-pill').getByRole('button', { name: '开启新对话', exact: true })).toBeVisible()
    },
    click: async (page) => {
      await page.locator('.float-pill').getByRole('button', { name: '开启新对话', exact: true }).click()
    },
  },
  {
    name: 'top-new at 390',
    viewport: { width: 390, height: 844 },
    revealAfterArm: false,
    reveal: async (page) => {
      await expect(page.getByTestId('top-new')).toBeVisible()
    },
    click: async (page) => {
      await page.getByTestId('top-new').click()
    },
  },
  {
    name: 'mobile drawer new-chat at 390',
    viewport: { width: 390, height: 844 },
    revealAfterArm: true,
    reveal: async (page) => {
      await page.getByTestId('menu').click()
      await expect(page.locator('.shell.nav-open')).toBeVisible()
      await expect(page.getByTestId('new-chat')).toBeVisible()
    },
    click: async (page) => {
      await page.getByTestId('new-chat').click()
    },
  },
]

const boot = async (page: Page, entry: Entry) => {
  await page.setViewportSize(entry.viewport)
  await installMedia(page)
  await recordReturnedTracks(page)
  const session = await unlock(page)
  await expect(page.locator('.greeting')).toBeVisible()
  await expect(page.getByTestId('composer')).toHaveValue('')
  await expect(page.locator('a.chat-link')).toHaveCount(0)
  if (!entry.revealAfterArm) await entry.reveal(page)
  return session
}

const armRecording = async (page: Page) => {
  await page.getByTestId('voice-input').click()
  await expect(page.getByTestId('voice-input')).toHaveAttribute('aria-label', '结束录音并转写')
  await expect(page.getByTestId('voice-spectrum')).toBeVisible()
  await waitForRecorderSamples(page)
  await expect.poll(() => page.evaluate(() => {
    const tracks = (window as unknown as { __gumTracks?: MediaStreamTrack[] }).__gumTracks ?? []
    return tracks.length > 0 && tracks.every((track) => track.readyState === 'live')
  })).toBe(true)
}

const expectVoiceIdle = async (page: Page) => {
  const voice = page.getByTestId('voice-input')
  await expect(voice).toHaveAttribute('aria-label', '语音输入')
  await expect(voice).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByTestId('voice-timer')).toHaveCount(0)
  await expect(page.getByTestId('voice-spectrum')).toHaveCount(0)
}

const expectTracksEnded = async (page: Page) => {
  await expect.poll(() => page.evaluate(() => {
    const tracks = (window as unknown as { __gumTracks?: MediaStreamTrack[] }).__gumTracks ?? []
    return tracks.length > 0 && tracks.every((track) => track.readyState === 'ended')
  })).toBe(true)
}

const expectComposerSends = async (page: Page, seen: { url: string }[]) => {
  const composer = page.getByTestId('composer')
  await composer.fill('下一句')
  await expect(composer).toHaveValue('下一句')
  const send = page.getByTestId('send')
  await expect(send).toBeEnabled()
  const before = messagePosts(seen).length
  await send.click()
  await expect(page.getByTestId('assistant-text').last()).toContainText('合成回答。')
  expect(messagePosts(seen)).toHaveLength(before + 1)
  await expect(page.getByText('转写结果')).toHaveCount(0)
}

const expectLandingKept = async (page: Page) => {
  await expect(page.getByTestId('status-toast')).toContainText('已经是最新对话')
  await expect(page.locator('.greeting')).toBeVisible()
  await expect(page.locator('a.chat-link')).toHaveCount(0)
  await expect(page.getByTestId('composer')).toHaveValue('')
}

for (const entry of entries) {
  test(`empty-landing voice: ${entry.name} stops a recording`, async ({ page }) => {
    test.setTimeout(90_000)
    const session = await boot(page, entry)
    try {
      await armRecording(page)
      if (entry.revealAfterArm) await entry.reveal(page)
      await entry.click(page)
      await expectLandingKept(page)
      await expectVoiceIdle(page)
      await expectTracksEnded(page)
      expect(asrPosts(session.seen)).toHaveLength(0)
      await expectComposerSends(page, session.seen)
      expect(asrPosts(session.seen)).toHaveLength(0)
    } finally {
      session.releaseAsr()
    }
  })

  // Product phase is "transcribing" for the whole ASR upload. There is no separate uploading phase.
  test(`empty-landing voice: ${entry.name} cancels a transcribing upload`, async ({ page }) => {
    test.setTimeout(90_000)
    const session = await boot(page, entry)
    try {
      await armRecording(page)
      await page.getByTestId('voice-input').click()
      await expect.poll(() => asrPosts(session.seen).length).toBe(1)
      await expect(page.getByTestId('voice-input')).toHaveAttribute('aria-label', '正在转写，点击取消')
      await expectTracksEnded(page)
      if (entry.revealAfterArm) await entry.reveal(page)
      await entry.click(page)
      await expectLandingKept(page)
      await expectVoiceIdle(page)
      await expectTracksEnded(page)
      session.releaseAsr()
      await expect(page.getByTestId('composer')).toHaveValue('')
      await expect(page.getByTestId('voice-recovery')).toHaveCount(0)
      await expect(page.getByText('转写结果')).toHaveCount(0)
      await expect.poll(() => session.failed.some((line) => line.includes('/v1/tools/asr'))).toBe(true)
      await expectComposerSends(page, session.seen)
      await expect(page.getByText('转写结果')).toHaveCount(0)
    } finally {
      session.releaseAsr()
    }
  })
}

test('empty-landing voice control: new chat from a chat with messages still stops a recording', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1280, height: 820 })
  await installMedia(page)
  await recordReturnedTracks(page)
  const session = await unlock(page)
  try {
    await page.getByTestId('composer').fill('先说一句')
    await page.getByTestId('send').click()
    await expect(page.getByTestId('assistant-text')).toContainText('合成回答。')
    await expect(page.locator('.greeting')).toHaveCount(0)
    await expect(page.locator('a.chat-link')).toHaveCount(1)
    await expect(page.getByTestId('composer')).toHaveValue('')
    await armRecording(page)
    await page.getByTestId('new-chat').click()
    await expect(page.locator('.greeting')).toBeVisible()
    await expect(page.locator('a.chat-link')).toHaveCount(1)
    await expect(page.getByTestId('status-toast')).toHaveCount(0)
    await expectVoiceIdle(page)
    await expectTracksEnded(page)
    expect(asrPosts(session.seen)).toHaveLength(0)
    await expect(page.getByTestId('composer')).toHaveValue('')
    await expectComposerSends(page, session.seen)
    expect(asrPosts(session.seen)).toHaveLength(0)
    await expect(page.getByText('转写结果')).toHaveCount(0)
  } finally {
    session.releaseAsr()
  }
})
