import { readFileSync, writeFileSync } from 'node:fs'
import { expect, test, type Page, type Route } from '@playwright/test'
import { installPcmProbe, openPcmServer, type PcmServer } from './lib/speech-pcm'

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

const installMedia = async (page: Page, mode: 'tone' | 'deny' | 'hold') => {
  await page.addInitScript((kind) => {
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
      const stream = destination.stream
      const track = stream.getTracks()[0]
      if (track) {
        const stop = track.stop.bind(track)
        track.stop = () => {
          const mark = window as unknown as { __stoppedTracks?: number }
          mark.__stoppedTracks = (mark.__stoppedTracks ?? 0) + 1
          stop()
          void context.close()
        }
      }
      return stream
    }
    const devices = navigator.mediaDevices
    devices.getUserMedia = (kind === 'deny'
      ? async () => {
          throw new DOMException('denied', 'NotAllowedError')
        }
      : kind === 'hold'
        ? () => new Promise((resolve) => {
            const gate = window as unknown as { __releaseMic?: () => void; __micWaits?: number }
            gate.__micWaits = (gate.__micWaits ?? 0) + 1
            gate.__releaseMic = () => resolve(makeStream())
          })
        : async () => makeStream())
  }, mode)
}

const unlock = async (page: Page, options?: { asrText?: string; holdAsr?: boolean; holdTts?: boolean; ttsPort?: number }) => {
  const asrText = options?.asrText ?? '转写结果'
  let releaseAsr: (() => void) | null = null
  let releaseTts: (() => void) | null = null
  const asrGate = options?.holdAsr ? new Promise<void>((resolve) => { releaseAsr = resolve }) : null
  const ttsGate = options?.holdTts ? new Promise<void>((resolve) => { releaseTts = resolve }) : null
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
      if (asrGate) await asrGate
      try {
        await route.fulfill({ json: { text: asrText } })
      } catch {
        /* The page aborted the upload. */
      }
      return
    }
    if (url.includes('/v1/tools/tts')) {
      if (options?.ttsPort) {
        try {
          await route.continue({ url: `https://127.0.0.1:${options.ttsPort}/v1/tools/tts` })
        } catch {
          /* The page aborted playback before the body was redirected. */
        }
        return
      }
      if (ttsGate) await ttsGate
      try {
        await route.fulfill({ status: 200, headers: { 'content-type': 'application/octet-stream' }, body: pcm() })
      } catch {
        /* The page aborted playback. */
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
    releaseTts: () => releaseTts?.(),
  }
}

const messagePosts = (seen: { url: string }[]) => seen.filter((item) => item.url.includes('/messages'))
const asrPosts = (seen: { url: string }[]) => seen.filter((item) => item.url.includes('/v1/tools/asr'))

test('whole-recording ASR inserts at the selection and does not send', async ({ page }) => {
  test.setTimeout(90_000)
  await installMedia(page, 'tone')
  const session = await unlock(page)
  const composer = page.getByTestId('composer')
  await composer.fill('你好世界')
  await composer.evaluate((node) => {
    const box = node as HTMLTextAreaElement
    box.focus()
    box.setSelectionRange(2, 4)
  })
  await page.getByTestId('voice-input').click()
  await expect(page.getByTestId('voice-input')).toHaveAttribute('aria-label', '结束录音并转写')
  await expect(page.getByTestId('voice-timer')).toHaveText(/录音中 \d+s/)
  await expect(page.getByTestId('voice-spectrum')).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByTestId('voice-timer')).toBeHidden()
  await expect(page.getByTestId('voice-spectrum')).toBeVisible()
  await page.setViewportSize({ width: 1280, height: 820 })
  await expect(page.getByTestId('voice-timer')).toHaveText(/录音中 [1-9]\d*s/)
  await page.getByTestId('voice-input').click()
  await expect(composer).toHaveValue('你好转写结果')
  expect(messagePosts(session.seen)).toHaveLength(0)
  const upload = asrPosts(session.seen).at(-1)
  expect(upload, 'ASR upload').toBeTruthy()
  const payload = upload!.bytes.toString('latin1')
  expect(payload).toContain('recording.wav')
  expect(payload).toContain('RIFF')
  expect(payload).toContain('WAVE')
  await page.getByTestId('send').click()
  await expect(page.getByTestId('assistant-text')).toContainText('合成回答。')
  expect(messagePosts(session.seen)).toHaveLength(1)
  expect(await page.evaluate(() => (window as unknown as { __stoppedTracks?: number }).__stoppedTracks ?? 0)).toBeGreaterThan(0)
})

test('a denied microphone shows the permission notice and does not upload', async ({ page }) => {
  await installMedia(page, 'deny')
  const session = await unlock(page)
  await page.getByTestId('voice-input').click()
  await expect(page.getByTestId('speech-notice')).toContainText('无法使用麦克风')
  await expect(page.getByTestId('voice-input')).toHaveAttribute('aria-label', '语音输入')
  expect(asrPosts(session.seen)).toHaveLength(0)
})

test('cancelling while permission is pending drops the late recording', async ({ page }) => {
  await installMedia(page, 'hold')
  const session = await unlock(page)
  await page.getByTestId('voice-input').click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __micWaits?: number }).__micWaits ?? 0)).toBe(1)
  await page.getByTestId('voice-input').click()
  await page.evaluate(() => (window as unknown as { __releaseMic?: () => void }).__releaseMic?.())
  await page.waitForTimeout(400)
  await expect(page.getByTestId('composer')).toHaveValue('')
  await expect(page.getByTestId('voice-input')).toHaveAttribute('aria-label', '语音输入')
  expect(asrPosts(session.seen)).toHaveLength(0)
})

test('a late transcript does not land in another conversation', async ({ page }) => {
  test.setTimeout(90_000)
  await installMedia(page, 'tone')
  const session = await unlock(page, { holdAsr: true })
  await page.getByTestId('composer').fill('先说一句')
  await page.getByTestId('send').click()
  await expect(page.getByTestId('assistant-text')).toContainText('合成回答。')
  const composer = page.getByTestId('composer')
  await composer.fill('前缀')
  await page.getByTestId('voice-input').click()
  await expect(page.getByTestId('voice-input')).toHaveAttribute('aria-label', '结束录音并转写')
  await page.waitForTimeout(700)
  await page.getByTestId('voice-input').click()
  await expect(page.getByTestId('voice-input')).toHaveAttribute('aria-label', '正在转写，点击取消')
  await page.getByTestId('new-chat').click()
  await expect(page.locator('.greeting')).toBeVisible()
  session.releaseAsr()
  await page.waitForTimeout(400)
  await expect(page.getByTestId('composer')).toHaveValue('')
  await expect(page.getByTestId('composer')).not.toContainText('转写结果')
})

test('read-aloud uses the selected public voice and stops on send', async ({ page }) => {
  test.setTimeout(90_000)
  await installMedia(page, 'tone')
  const session = await unlock(page, { holdTts: true })
  await page.getByTestId('user-menu').click()
  await page.getByTestId('settings-open').click()
  await page.getByTestId('voice-select').click()
  await page.getByRole('option', { name: '暗潮（男声）', exact: true }).click()
  await expect(page.getByTestId('voice-select')).toContainText('暗潮（男声）')
  await page.getByTestId('settings-close').click()
  await expect(page.getByTestId('settings-dialog')).toBeHidden()
  await page.getByTestId('composer').fill('请朗读')
  await page.getByTestId('send').click()
  await expect(page.getByTestId('assistant-text')).toContainText('合成回答。')
  const read = page.getByTestId('read-aloud')
  await read.click()
  await expect(read).toHaveAttribute('aria-label', '停止朗读')
  await expect(read.getByTestId('reading-bars')).toHaveAttribute('data-mode', 'loading')
  const tts = session.seen.find((item) => item.url.includes('/v1/tools/tts'))
  expect(tts, 'TTS request').toBeTruthy()
  const body = JSON.parse(tts!.body) as { text: string; voice_id: string; format: string; filter_markdown: boolean }
  expect(body).toMatchObject({ text: '合成回答。', voice_id: 'tide', format: 'pcm', filter_markdown: true })
  await page.getByTestId('composer').fill('下一句')
  await page.getByTestId('send').click()
  await expect(page.getByTestId('assistant-text').last()).toContainText('合成回答。')
  await expect(page.getByTestId('read-aloud').first()).toHaveAttribute('aria-label', '朗读')
  await expect.poll(() => session.failed.some((line) => line.includes('/v1/tools/tts'))).toBe(true)
  session.releaseTts()
})

test('the public voice survives reload and 贝壳 stays unlisted', async ({ page }) => {
  await installMedia(page, 'deny')
  await unlock(page)
  await page.getByTestId('user-menu').click()
  await page.getByTestId('settings-open').click()
  await page.getByTestId('voice-select').click()
  const menu = page.getByTestId('voice-select-menu')
  await expect(menu.getByRole('option')).toHaveText(['海星（女声）', '暗潮（男声）'])
  await menu.getByRole('option', { name: '暗潮（男声）', exact: true }).click()
  await page.getByTestId('settings-close').click()
  await page.reload()
  await expect(page.getByTestId('composer')).toBeVisible()
  await page.getByTestId('user-menu').click()
  await page.getByTestId('settings-open').click()
  await expect(page.getByTestId('voice-select')).toContainText('暗潮（男声）')
  await page.getByTestId('voice-select').click()
  await expect(page.getByTestId('voice-select-menu')).not.toContainText('贝壳')
  await expect(page.getByTestId('voice-select-menu')).not.toContainText('白浪')
})

const answer = async (page: Page, text: string) => {
  await page.getByTestId('composer').fill(text)
  await page.getByTestId('send').click()
  await expect(page.getByTestId('assistant-text').last()).toContainText('合成回答。')
}

const selectTide = async (page: Page) => {
  await page.getByTestId('user-menu').click()
  await page.getByTestId('settings-open').click()
  await page.getByTestId('voice-select').click()
  await page.getByRole('option', { name: '暗潮（男声）', exact: true }).click()
  await page.getByTestId('settings-close').click()
  await expect(page.getByTestId('settings-dialog')).toBeHidden()
}

/** Production UI plus the real AudioContext are both in the playing state. */
const expectPlaying = async (page: Page) => {
  await expect.poll(() => page.evaluate(() => {
    const probe = (window as unknown as { __pcm: { starts: number; destinationConnects: number; peak: number; bufferRates: number[]; bufferFrames: number[] } }).__pcm
    const live = (window as unknown as { __pcmLive: AudioContext[] }).__pcmLive
    const button = document.querySelector('[data-testid="read-aloud"][aria-label="停止朗读"]')
    const bars = button?.querySelector('[data-testid="reading-bars"]')
    return Boolean(
      button
      && bars?.getAttribute('data-mode') === 'playing'
      && probe.starts >= 1
      && probe.destinationConnects >= 1
      && probe.peak > 0.05
      && probe.bufferRates.at(-1) === 24000
      && (probe.bufferFrames.at(-1) ?? 0) > 0
      && live.some((context) => context.state === 'running'),
    )
  })).toBe(true)
}

const expectAudibleCleanup = async (page: Page) => {
  await expect.poll(() => page.evaluate(() => {
    const probe = (window as unknown as { __pcm: { closes: number; stops: number; disconnects: number; starts: number } }).__pcm
    const live = (window as unknown as { __pcmLive: AudioContext[] }).__pcmLive
    const playing = document.querySelector('[data-testid="read-aloud"][aria-label="停止朗读"]')
    return probe.closes >= 1
      && probe.stops >= probe.starts
      && probe.starts >= 1
      && probe.disconnects >= 1
      && live.every((context) => context.state === 'closed')
      && !playing
  })).toBe(true)
}

const voiceOf = (raw: string) => JSON.parse(raw) as { text: string; voice_id: string; format: string; filter_markdown: boolean }

test('playback reaches WebAudio playing for stella and cleans up on EOF', async ({ page }) => {
  test.setTimeout(90_000)
  const pcm = await openPcmServer('eof', 24000)
  try {
    await installPcmProbe(page)
    await unlock(page, { ttsPort: pcm.port })
    await answer(page, '请朗读海星')
    await page.getByTestId('read-aloud').click()
    await expectPlaying(page)
    await expect.poll(() => pcm.bodies.length).toBe(1)
    expect(voiceOf(pcm.bodies[0]!)).toMatchObject({ text: '合成回答。', voice_id: 'stella', format: 'pcm', filter_markdown: true })
    await expectAudibleCleanup(page)
    await expect.poll(() => pcm.finished[0] === true && pcm.aborted[0] === false).toBe(true)
    await expect(page.getByTestId('read-aloud')).toHaveAttribute('aria-label', '朗读')
    await expect(page.getByTestId('speech-notice')).toHaveCount(0)
  } finally {
    await pcm.close()
  }
})

test('playback stop for tide closes queued sources, the context, and the open request', async ({ page }) => {
  test.setTimeout(90_000)
  const pcm = await openPcmServer('open', 24000 * 4)
  try {
    await installPcmProbe(page)
    await unlock(page, { ttsPort: pcm.port })
    await selectTide(page)
    await answer(page, '请朗读暗潮')
    const read = page.getByTestId('read-aloud')
    await read.click()
    await expectPlaying(page)
    await expect.poll(() => pcm.bodies.length).toBe(1)
    expect(voiceOf(pcm.bodies[0]!)).toMatchObject({ text: '合成回答。', voice_id: 'tide', format: 'pcm', filter_markdown: true })
    await read.click()
    await expectAudibleCleanup(page)
    await expect.poll(() => pcm.aborted[0]).toBe(true)
    await expect(read).toHaveAttribute('aria-label', '朗读')
    await expect(page.getByTestId('speech-notice')).toHaveCount(0)
  } finally {
    await pcm.close()
  }
})

test('a second read-aloud replaces the one that is playing', async ({ page }) => {
  test.setTimeout(90_000)
  const pcm = await openPcmServer('open', 24000 * 4)
  try {
    await installPcmProbe(page)
    await unlock(page, { ttsPort: pcm.port })
    await answer(page, '第一段')
    await answer(page, '下一句')
    await page.getByTestId('read-aloud').first().click()
    await expectPlaying(page)
    await selectTide(page)
    await page.getByTestId('read-aloud').nth(1).click()
    await expect.poll(() => page.evaluate(() => {
      const probe = (window as unknown as { __pcm: { closes: number } }).__pcm
      const live = (window as unknown as { __pcmLive: AudioContext[] }).__pcmLive
      const labels = [...document.querySelectorAll('[data-testid="read-aloud"]')].map((node) => node.getAttribute('aria-label'))
      const bars = document.querySelector('[data-testid="read-aloud"][aria-label="停止朗读"] [data-testid="reading-bars"]')
      return probe.closes >= 1
        && live.filter((context) => context.state === 'running').length === 1
        && live.filter((context) => context.state === 'closed').length >= 1
        && labels.join(',') === '朗读,停止朗读'
        && bars?.getAttribute('data-mode') === 'playing'
    })).toBe(true)
    await expect.poll(() => pcm.bodies.length).toBeGreaterThanOrEqual(2)
    expect(voiceOf(pcm.bodies[0]!).voice_id).toBe('stella')
    expect(voiceOf(pcm.bodies[1]!).voice_id).toBe('tide')
    await expect.poll(() => pcm.aborted[0]).toBe(true)
    expect(pcm.aborted[1]).toBe(false)
  } finally {
    await pcm.close()
  }
})

const playOpen = async (page: Page, frames = 24000 * 5) => {
  const pcm = await openPcmServer('open', frames)
  await installPcmProbe(page)
  await unlock(page, { ttsPort: pcm.port })
  await answer(page, '生命周期')
  await page.getByTestId('read-aloud').click()
  await expectPlaying(page)
  return pcm
}

const expectPlaybackHalted = async (page: Page, pcm: PcmServer) => {
  await expect.poll(() => pcm.aborted[0]).toBe(true)
  await expect.poll(() => page.evaluate(() => {
    const probe = (window as unknown as { __pcm: { closes: number; stops: number; disconnects: number } }).__pcm
    const live = (window as unknown as { __pcmLive: AudioContext[] }).__pcmLive
    return probe.closes >= 1 && probe.stops >= 1 && probe.disconnects >= 1 && live.every((context) => context.state === 'closed')
  })).toBe(true)
  await expect(page.locator('[data-testid="read-aloud"][aria-label="停止朗读"]')).toHaveCount(0)
}

test('send while playing stops the player and aborts the request', async ({ page }) => {
  test.setTimeout(90_000)
  const pcm = await playOpen(page)
  try {
    await page.getByTestId('composer').fill('下一句')
    await page.getByTestId('send').click()
    await expect(page.getByTestId('assistant-text').last()).toContainText('合成回答。')
    await expectPlaybackHalted(page, pcm)
    await expect(page.getByTestId('read-aloud').first()).toHaveAttribute('aria-label', '朗读')
  } finally {
    await pcm.close()
  }
})

test('regenerate while playing stops the player and aborts the request', async ({ page }) => {
  test.setTimeout(90_000)
  const pcm = await playOpen(page)
  try {
    await page.getByTestId('regenerate').click()
    await expect(page.getByTestId('assistant-text').last()).toContainText('合成回答。')
    await expectPlaybackHalted(page, pcm)
    await expect(page.getByTestId('read-aloud')).toHaveAttribute('aria-label', '朗读')
  } finally {
    await pcm.close()
  }
})

test('continue while playing stops the player and aborts the request', async ({ page }) => {
  test.setTimeout(90_000)
  const pcm = await openPcmServer('open', 24000 * 5)
  try {
    await installPcmProbe(page)
    await page.addInitScript(SSE)
    await unlock(page, { ttsPort: pcm.port })
    await page.getByTestId('composer').fill('先停')
    await page.getByTestId('send').click()
    await page.waitForFunction(() => (window as unknown as { __sse: { count: () => number } }).__sse.count() > 0)
    await page.evaluate((events) => (window as unknown as { __sse: { push: (value: unknown[]) => void } }).__sse.push(events), [
      { type: 'message_start', message: { id: 'c1', model: 'deepseek-flash' } },
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '半句。' } },
    ])
    await expect(page.getByTestId('assistant-text')).toContainText('半句')
    await page.getByTestId('stop').click()
    await expect(page.getByTestId('continue')).toBeVisible()
    await page.getByTestId('read-aloud').click()
    await expectPlaying(page)
    await page.getByTestId('continue').click()
    await expectPlaybackHalted(page, pcm)
  } finally {
    await pcm.close()
  }
})

test('switching conversation while playing stops the player and aborts the request', async ({ page }) => {
  test.setTimeout(90_000)
  const pcm = await openPcmServer('open', 24000 * 5)
  try {
    await installPcmProbe(page)
    await unlock(page, { ttsPort: pcm.port })
    await answer(page, '第一段')
    await page.getByTestId('new-chat').click()
    await answer(page, '下一句')
    await page.getByTestId('read-aloud').click()
    await expectPlaying(page)
    await page.locator('.chat-link', { hasText: '语音' }).click()
    await expect(page.getByTestId('assistant-text')).toContainText('合成回答。')
    await expectPlaybackHalted(page, pcm)
    await expect(page.getByTestId('read-aloud')).toHaveAttribute('aria-label', '朗读')
  } finally {
    await pcm.close()
  }
})

test('import while playing stops the player and aborts the request', async ({ page }) => {
  test.setTimeout(90_000)
  const pcm = await playOpen(page)
  try {
    const archive = {
      format: 'deepapi',
      version: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      app: 'deepapi',
      conversations: [{
        id: 'conv-import-speech',
        title: '导入的会话',
        titleSource: 'user',
        model: 'deepseek-flash',
        thinking: false,
        search: false,
        readLink: false,
        effort: 'high',
        pinned: false,
        archived: false,
        activeLeafId: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        rev: 1,
        deletedAt: null,
        messages: [],
      }],
    }
    const path = '/tmp/speech-import-archive.json'
    writeFileSync(path, JSON.stringify(archive))
    await page.getByTestId('user-menu').click()
    await page.getByTestId('settings-open').click()
    await page.getByRole('button', { name: '数据管理' }).click()
    await page.getByTestId('import-json').setInputFiles(path)
    await expect(page.getByTestId('import-toast')).toContainText('已导入')
    await expectPlaybackHalted(page, pcm)
  } finally {
    await pcm.close()
  }
})

test('deleting the active chat while playing stops the player and aborts the request', async ({ page }) => {
  test.setTimeout(90_000)
  const pcm = await playOpen(page)
  try {
    await page.locator('.chat-link.active').getByRole('button', { name: '菜单' }).click()
    await page.getByTestId('chat-item-menu').getByRole('menuitem', { name: '删除' }).click()
    await page.getByTestId('confirm-delete').click()
    await expect(page.locator('.greeting')).toBeVisible()
    await expectPlaybackHalted(page, pcm)
  } finally {
    await pcm.close()
  }
})

test('removing the key while playing stops the player and aborts the request', async ({ page }) => {
  test.setTimeout(90_000)
  const pcm = await playOpen(page)
  try {
    await page.getByTestId('user-menu').click()
    await page.getByTestId('settings-open').click()
    await page.getByTestId('settings-nav-account').click()
    await page.getByTestId('settings-dialog').getByRole('button', { name: '移除 Key' }).click()
    await expect(page.getByTestId('landing')).toBeVisible()
    await expectPlaybackHalted(page, pcm)
  } finally {
    await pcm.close()
  }
})

const holdComposerFocus = async (page: Page) => {
  await page.addInitScript(() => {
    const queued: FrameRequestCallback[] = []
    const native = window.requestAnimationFrame.bind(window)
    let hold = true
    const mark = window as unknown as { __heldFocusFrames?: number; __releaseFocusFrames?: () => void }
    mark.__heldFocusFrames = 0
    window.requestAnimationFrame = (callback) => {
      if (!hold) return native(callback)
      queued.push(callback)
      mark.__heldFocusFrames = queued.length
      return queued.length
    }
    mark.__releaseFocusFrames = () => {
      hold = false
      const pending = queued.splice(0)
      for (const callback of pending) native(callback)
    }
  })
}

const countAudioCallbacks = async (page: Page) => {
  await page.addInitScript(() => {
    const proto = window.ScriptProcessorNode?.prototype
    if (!proto) return
    const desc = Object.getOwnPropertyDescriptor(proto, 'onaudioprocess')
    if (!desc?.set || !desc.get) return
    Object.defineProperty(proto, 'onaudioprocess', {
      configurable: true,
      enumerable: desc.enumerable,
      get() { return desc.get!.call(this) },
      set(fn: ((this: ScriptProcessorNode, event: AudioProcessingEvent) => void) | null) {
        const wrapped = typeof fn === 'function'
          ? function (this: ScriptProcessorNode, event: AudioProcessingEvent) {
              const mark = window as unknown as { __audioCallbacks?: number }
              mark.__audioCallbacks = (mark.__audioCallbacks ?? 0) + 1
              fn.call(this, event)
            }
          : fn
        desc.set!.call(this, wrapped)
      },
    })
  })
}

const composerRange = (page: Page) => page.getByTestId('composer').evaluate((node) => {
  const box = node as HTMLTextAreaElement
  return { start: box.selectionStart, end: box.selectionEnd, value: box.value }
})

const releaseFocusFrames = (page: Page) => page.evaluate(() => {
  ;(window as unknown as { __releaseFocusFrames?: () => void }).__releaseFocusFrames?.()
})

const waitForSamples = (page: Page) => expect.poll(() => page.evaluate(() => (window as unknown as { __audioCallbacks?: number }).__audioCallbacks ?? 0)).toBeGreaterThan(0)

const readUploadedWav = (bytes: Buffer) => {
  const offset = bytes.indexOf(Buffer.from('RIFF'))
  expect(offset).toBeGreaterThanOrEqual(0)
  const data = bytes.subarray(offset)
  const size = data.readUInt32LE(40)
  let peak = 0
  for (let index = 44; index + 1 < 44 + size && index + 1 < data.length; index += 2) {
    peak = Math.max(peak, Math.abs(data.readInt16LE(index)))
  }
  return {
    format: data.readUInt16LE(20),
    channels: data.readUInt16LE(22),
    rate: data.readUInt32LE(24),
    bits: data.readUInt16LE(34),
    size,
    peak,
    name: bytes.toString('latin1').includes('recording.wav'),
  }
}

test('delayed focus, permission, and upload keep a saved selection after an edit before it', async ({ page }) => {
  test.setTimeout(90_000)
  await holdComposerFocus(page)
  await countAudioCallbacks(page)
  await installMedia(page, 'hold')
  const session = await unlock(page, { holdAsr: true })
  const composer = page.getByTestId('composer')
  await composer.fill('你好世界')
  await composer.evaluate((node) => {
    const box = node as HTMLTextAreaElement
    box.focus()
    box.setSelectionRange(2, 4)
  })
  await expect.poll(() => page.evaluate(() => (window as unknown as { __heldFocusFrames?: number }).__heldFocusFrames ?? 0)).toBeGreaterThan(0)
  expect(await composerRange(page)).toEqual({ start: 2, end: 4, value: '你好世界' })
  await releaseFocusFrames(page)
  await expect.poll(async () => composerRange(page)).toEqual({ start: 2, end: 4, value: '你好世界' })
  await page.getByTestId('voice-input').click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __micWaits?: number }).__micWaits ?? 0)).toBe(1)
  await composer.evaluate((node) => {
    const box = node as HTMLTextAreaElement
    box.focus()
    box.setSelectionRange(0, 0)
  })
  await page.keyboard.type('啊')
  await expect(composer).toHaveValue('啊你好世界')
  await page.evaluate(() => (window as unknown as { __releaseMic?: () => void }).__releaseMic?.())
  await expect(page.getByTestId('voice-input')).toHaveAttribute('aria-label', '结束录音并转写')
  await waitForSamples(page)
  await page.getByTestId('voice-input').click()
  await expect(page.getByTestId('voice-input')).toHaveAttribute('aria-label', '正在转写，点击取消')
  await expect(composer).toHaveValue('啊你好世界')
  session.releaseAsr()
  await expect(composer).toHaveValue('啊你好转写结果')
  expect(messagePosts(session.seen)).toHaveLength(0)
  const upload = asrPosts(session.seen).at(-1)
  expect(upload, 'ASR upload').toBeTruthy()
  expect(readUploadedWav(upload!.bytes)).toMatchObject({ format: 1, channels: 1, rate: 16000, bits: 16, name: true })
  expect(readUploadedWav(upload!.bytes).size).toBeGreaterThan(0)
  expect(readUploadedWav(upload!.bytes).peak).toBeGreaterThan(0)
})

test('a saved caret survives delayed permission and upload', async ({ page }) => {
  test.setTimeout(90_000)
  await holdComposerFocus(page)
  await countAudioCallbacks(page)
  await installMedia(page, 'hold')
  const session = await unlock(page, { holdAsr: true })
  const composer = page.getByTestId('composer')
  await composer.fill('你好世界')
  await composer.evaluate((node) => {
    const box = node as HTMLTextAreaElement
    box.focus()
    box.setSelectionRange(2, 2)
  })
  await releaseFocusFrames(page)
  await expect.poll(async () => composerRange(page)).toEqual({ start: 2, end: 2, value: '你好世界' })
  await page.getByTestId('voice-input').click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __micWaits?: number }).__micWaits ?? 0)).toBe(1)
  await page.evaluate(() => (window as unknown as { __releaseMic?: () => void }).__releaseMic?.())
  await expect(page.getByTestId('voice-input')).toHaveAttribute('aria-label', '结束录音并转写')
  await waitForSamples(page)
  await page.getByTestId('voice-input').click()
  await expect(page.getByTestId('voice-input')).toHaveAttribute('aria-label', '正在转写，点击取消')
  session.releaseAsr()
  await expect(composer).toHaveValue('你好转写结果世界')
  expect(messagePosts(session.seen)).toHaveLength(0)
  expect(readUploadedWav(asrPosts(session.seen).at(-1)!.bytes).peak).toBeGreaterThan(0)
})

test('an edit of the saved selection is replaced when the delayed transcript arrives', async ({ page }) => {
  test.setTimeout(90_000)
  await countAudioCallbacks(page)
  await installMedia(page, 'tone')
  const session = await unlock(page, { holdAsr: true })
  const composer = page.getByTestId('composer')
  await composer.fill('你好世界')
  await composer.evaluate((node) => {
    const box = node as HTMLTextAreaElement
    box.focus()
    box.setSelectionRange(2, 4)
  })
  await page.getByTestId('voice-input').click()
  await expect(page.getByTestId('voice-input')).toHaveAttribute('aria-label', '结束录音并转写')
  await waitForSamples(page)
  await page.getByTestId('voice-input').click()
  await expect(page.getByTestId('voice-input')).toHaveAttribute('aria-label', '正在转写，点击取消')
  await composer.evaluate((node) => {
    const box = node as HTMLTextAreaElement
    box.focus()
    box.setSelectionRange(2, 4)
  })
  await page.keyboard.type('大家')
  await expect(composer).toHaveValue('你好大家')
  session.releaseAsr()
  await expect(composer).toHaveValue('你好转写结果')
  expect(messagePosts(session.seen)).toHaveLength(0)
})

test('an edit on both sides of the saved range keeps the new draft', async ({ page }) => {
  test.setTimeout(90_000)
  await countAudioCallbacks(page)
  await installMedia(page, 'tone')
  const session = await unlock(page, { holdAsr: true })
  const composer = page.getByTestId('composer')
  await composer.fill('你好世界')
  await composer.evaluate((node) => {
    const box = node as HTMLTextAreaElement
    box.focus()
    box.setSelectionRange(2, 4)
  })
  await page.getByTestId('voice-input').click()
  await expect(page.getByTestId('voice-input')).toHaveAttribute('aria-label', '结束录音并转写')
  await waitForSamples(page)
  await page.getByTestId('voice-input').click()
  await expect(page.getByTestId('voice-input')).toHaveAttribute('aria-label', '正在转写，点击取消')
  await composer.fill('完全不同')
  session.releaseAsr()
  await expect(composer).toHaveValue('完全不同')
  expect(asrPosts(session.seen).length).toBeGreaterThan(0)
  expect(messagePosts(session.seen)).toHaveLength(0)
})

test('refocus while upload is pending does not append over a saved selection', async ({ page }) => {
  test.setTimeout(90_000)
  await countAudioCallbacks(page)
  await installMedia(page, 'tone')
  const session = await unlock(page, { holdAsr: true })
  const composer = page.getByTestId('composer')
  await composer.fill('你好世界')
  await composer.evaluate((node) => {
    const box = node as HTMLTextAreaElement
    box.focus()
    box.setSelectionRange(2, 4)
  })
  await page.getByTestId('voice-input').click()
  await expect(page.getByTestId('voice-input')).toHaveAttribute('aria-label', '结束录音并转写')
  await waitForSamples(page)
  await page.getByTestId('voice-input').click()
  await expect(page.getByTestId('voice-input')).toHaveAttribute('aria-label', '正在转写，点击取消')
  await page.keyboard.press('Escape')
  await expect.poll(async () => composerRange(page)).toMatchObject({ start: 4, end: 4, value: '你好世界' })
  session.releaseAsr()
  await expect(composer).toHaveValue('你好转写结果')
  expect(messagePosts(session.seen)).toHaveLength(0)
})

test('a late transcript does not land in another open conversation', async ({ page }) => {
  test.setTimeout(90_000)
  await countAudioCallbacks(page)
  await installMedia(page, 'tone')
  const session = await unlock(page, { holdAsr: true })
  await page.getByTestId('composer').fill('先说一句')
  await page.getByTestId('send').click()
  await expect(page.getByTestId('assistant-text')).toContainText('合成回答。')
  await page.getByTestId('new-chat').click()
  await expect(page.locator('.greeting')).toBeVisible()
  await page.getByTestId('composer').fill('下一句')
  await page.getByTestId('send').click()
  await expect(page.getByTestId('assistant-text').last()).toContainText('合成回答。')
  await page.locator('.chat-link', { hasText: '语音' }).click()
  await expect(page.getByTestId('assistant-text')).toContainText('合成回答。')
  const composer = page.getByTestId('composer')
  await composer.fill('前缀内容')
  await composer.evaluate((node) => {
    const box = node as HTMLTextAreaElement
    box.focus()
    box.setSelectionRange(2, 4)
  })
  await page.getByTestId('voice-input').click()
  await expect(page.getByTestId('voice-input')).toHaveAttribute('aria-label', '结束录音并转写')
  await waitForSamples(page)
  await page.getByTestId('voice-input').click()
  await expect(page.getByTestId('voice-input')).toHaveAttribute('aria-label', '正在转写，点击取消')
  await page.locator('.chat-link', { hasText: '下一句' }).click()
  await expect(page.getByTestId('assistant-text')).toContainText('合成回答。')
  session.releaseAsr()
  await expect(page.getByTestId('composer')).not.toHaveValue(/转写结果/)
  await page.locator('.chat-link', { hasText: '语音' }).click()
  await expect(page.getByTestId('assistant-text')).toContainText('合成回答。')
  await expect(page.getByTestId('composer')).not.toHaveValue(/转写结果/)
  expect(messagePosts(session.seen)).toHaveLength(2)
})

test('an observed append of a repeated token does not replace the unselected copy', async ({ page }) => {
  test.setTimeout(90_000)
  await countAudioCallbacks(page)
  await installMedia(page, 'tone')
  const session = await unlock(page, { holdAsr: true })
  const composer = page.getByTestId('composer')
  await composer.fill('abcabc')
  await composer.evaluate((node) => {
    const box = node as HTMLTextAreaElement
    box.focus()
    box.setSelectionRange(0, 3)
  })
  await page.getByTestId('voice-input').click()
  await expect(page.getByTestId('voice-input')).toHaveAttribute('aria-label', '结束录音并转写')
  await waitForSamples(page)
  await page.getByTestId('voice-input').click()
  await expect(page.getByTestId('voice-input')).toHaveAttribute('aria-label', '正在转写，点击取消')
  await composer.evaluate((node) => {
    const box = node as HTMLTextAreaElement
    box.focus()
    box.setSelectionRange(6, 6)
  })
  await page.keyboard.type('abc')
  await expect(composer).toHaveValue('abcabcabc')
  session.releaseAsr()
  await expect(composer).toHaveValue('转写结果abcabc')
  expect(messagePosts(session.seen)).toHaveLength(0)
  expect(readUploadedWav(asrPosts(session.seen).at(-1)!.bytes).peak).toBeGreaterThan(0)
})

test('an observed insert of a repeated token before the saved selection shifts it', async ({ page }) => {
  test.setTimeout(90_000)
  await countAudioCallbacks(page)
  await installMedia(page, 'tone')
  const session = await unlock(page, { holdAsr: true })
  const composer = page.getByTestId('composer')
  await composer.fill('abcabc')
  await composer.evaluate((node) => {
    const box = node as HTMLTextAreaElement
    box.focus()
    box.setSelectionRange(0, 3)
  })
  await page.getByTestId('voice-input').click()
  await expect(page.getByTestId('voice-input')).toHaveAttribute('aria-label', '结束录音并转写')
  await waitForSamples(page)
  await page.getByTestId('voice-input').click()
  await expect(page.getByTestId('voice-input')).toHaveAttribute('aria-label', '正在转写，点击取消')
  await composer.evaluate((node) => {
    const box = node as HTMLTextAreaElement
    box.focus()
    box.setSelectionRange(0, 0)
  })
  await page.keyboard.type('abc')
  await expect(composer).toHaveValue('abcabcabc')
  session.releaseAsr()
  await expect(composer).toHaveValue('abc转写结果abc')
  expect(messagePosts(session.seen)).toHaveLength(0)
  expect(readUploadedWav(asrPosts(session.seen).at(-1)!.bytes).peak).toBeGreaterThan(0)
})

const armHeldSelection = async (page: Page, value: string, start: number, end: number) => {
  await countAudioCallbacks(page)
  await installMedia(page, 'hold')
  const session = await unlock(page, { holdAsr: true })
  const composer = page.getByTestId('composer')
  await composer.fill(value)
  await composer.evaluate((node, range) => {
    const box = node as HTMLTextAreaElement
    box.focus()
    box.setSelectionRange(range.start, range.end)
  }, { start, end })
  await page.getByTestId('voice-input').click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __micWaits?: number }).__micWaits ?? 0)).toBe(1)
  return { session, composer }
}

const openHeldRecording = async (page: Page, session: { releaseAsr: () => void }) => {
  await page.evaluate(() => (window as unknown as { __releaseMic?: () => void }).__releaseMic?.())
  await expect(page.getByTestId('voice-input')).toHaveAttribute('aria-label', '结束录音并转写')
  await waitForSamples(page)
  await page.getByTestId('voice-input').click()
  await expect(page.getByTestId('voice-input')).toHaveAttribute('aria-label', '正在转写，点击取消')
  return session
}

const expectOutsideKept = (after: string, before: string, start: number, end: number, transcript: string) => {
  const prefix = before.slice(0, start)
  const suffix = before.slice(end)
  expect(after.startsWith(prefix)).toBe(true)
  expect(after.endsWith(suffix)).toBe(true)
  expect(after).toBe(`${prefix}${transcript}${suffix}`)
}

test('an observed suffix and a repeated prepend keep both unselected copies', async ({ page }) => {
  test.setTimeout(90_000)
  const { session, composer } = await armHeldSelection(page, 'abcabc', 0, 3)
  await composer.focus()
  await composer.press('Control+End')
  await composer.pressSequentially('X')
  await expect(composer).toHaveValue('abcabcX')
  await openHeldRecording(page, session)
  await composer.focus()
  await composer.press('Control+Home')
  await composer.pressSequentially('abc')
  await expect(composer).toHaveValue('abcabcabcX')
  const before = 'abcabcabcX'
  session.releaseAsr()
  await expect(composer).toHaveValue('abc转写结果abcX')
  expectOutsideKept(await composer.inputValue(), before, 3, 6, '转写结果')
  expect(messagePosts(session.seen)).toHaveLength(0)
  expect(readUploadedWav(asrPosts(session.seen).at(-1)!.bytes).peak).toBeGreaterThan(0)
})

test('deleting the selection and retyping the same draft does not delete the survivor', async ({ page }) => {
  test.setTimeout(90_000)
  const { session, composer } = await armHeldSelection(page, 'abcabc', 0, 3)
  await composer.focus()
  await composer.press('Backspace')
  await expect(composer).toHaveValue('abc')
  await openHeldRecording(page, session)
  await composer.focus()
  await composer.press('Control+End')
  await composer.pressSequentially('abc')
  await expect(composer).toHaveValue('abcabc')
  session.releaseAsr()
  await expect(composer).toHaveValue('转写结果abcabc')
  expectOutsideKept(await composer.inputValue(), 'abcabc', 0, 0, '转写结果')
  expect(messagePosts(session.seen)).toHaveLength(0)
})

test('edits before, inside, and after the range keep every outside character', async ({ page }) => {
  test.setTimeout(90_000)
  const { session, composer } = await armHeldSelection(page, '0123456789', 4, 6)
  await openHeldRecording(page, session)
  await composer.evaluate((node) => {
    const box = node as HTMLTextAreaElement
    box.focus()
    box.setSelectionRange(4, 6)
  })
  await page.keyboard.type('ZZ')
  await expect(composer).toHaveValue('0123ZZ6789')
  await composer.press('Control+Home')
  await composer.pressSequentially('A')
  await composer.press('Control+End')
  await composer.pressSequentially('B')
  await expect(composer).toHaveValue('A0123ZZ6789B')
  session.releaseAsr()
  await expect(composer).toHaveValue('A0123转写结果6789B')
  expectOutsideKept(await composer.inputValue(), 'A0123ZZ6789B', 5, 7, '转写结果')
  expect(messagePosts(session.seen)).toHaveLength(0)
})

test('undo and redo follow the edit step and not the restored letters', async ({ page }) => {
  test.setTimeout(90_000)
  const { session, composer } = await armHeldSelection(page, 'abcabc', 0, 3)
  await openHeldRecording(page, session)
  await composer.evaluate((node) => {
    const box = node as HTMLTextAreaElement
    box.focus()
    box.setSelectionRange(0, 3)
  })
  await composer.press('Backspace')
  await expect(composer).toHaveValue('abc')
  await composer.press('Control+End')
  await composer.pressSequentially('abc')
  await expect(composer).toHaveValue('abcabc')
  for (const value of ['abcab', 'abca', 'abc', 'abcabc']) {
    await composer.press('Control+z')
    await expect(composer).toHaveValue(value)
  }
  await composer.press('Control+Shift+Z')
  await expect(composer).toHaveValue('abc')
  await composer.press('Control+y')
  await expect(composer).toHaveValue('abca')
  await composer.press('Control+z')
  await expect(composer).toHaveValue('abc')
  await composer.press('Control+y')
  await expect(composer).toHaveValue('abca')
  await composer.press('Control+y')
  await expect(composer).toHaveValue('abcab')
  await composer.press('Control+y')
  await expect(composer).toHaveValue('abcabc')
  session.releaseAsr()
  await expect(composer).toHaveValue('转写结果abcabc')
  expectOutsideKept(await composer.inputValue(), 'abcabc', 0, 0, '转写结果')
  expect(messagePosts(session.seen)).toHaveLength(0)
})

test('spaces and a surrogate pair outside the replaced span survive', async ({ page }) => {
  test.setTimeout(90_000)
  const emoji = '😀'
  const initial = `a b ${emoji} c`
  const emojiAt = initial.indexOf(emoji)
  const { session, composer } = await armHeldSelection(page, initial, emojiAt, emojiAt + emoji.length)
  await openHeldRecording(page, session)
  await composer.focus()
  await composer.press('Control+Home')
  await composer.pressSequentially('前')
  await composer.press('Control+End')
  await composer.pressSequentially('后')
  const before = `前${initial}后`
  await expect(composer).toHaveValue(before)
  session.releaseAsr()
  const prefix = before.slice(0, before.indexOf(emoji))
  const suffix = before.slice(before.indexOf(emoji) + emoji.length)
  await expect(composer).toHaveValue(`${prefix}转写结果${suffix}`)
  expectOutsideKept(await composer.inputValue(), before, before.indexOf(emoji), before.indexOf(emoji) + emoji.length, '转写结果')
  expect(messagePosts(session.seen)).toHaveLength(0)
})

test('moving the caret while recording does not retarget the saved span', async ({ page }) => {
  test.setTimeout(90_000)
  const { session, composer } = await armHeldSelection(page, 'abcabc', 0, 3)
  await page.evaluate(() => (window as unknown as { __releaseMic?: () => void }).__releaseMic?.())
  await expect(page.getByTestId('voice-input')).toHaveAttribute('aria-label', '结束录音并转写')
  await waitForSamples(page)
  await composer.focus()
  await composer.press('Control+End')
  expect(await composerRange(page)).toMatchObject({ start: 6, end: 6, value: 'abcabc' })
  await page.getByTestId('voice-input').click()
  await expect(page.getByTestId('voice-input')).toHaveAttribute('aria-label', '正在转写，点击取消')
  session.releaseAsr()
  await expect(composer).toHaveValue('转写结果abc')
  expectOutsideKept(await composer.inputValue(), 'abcabc', 0, 3, '转写结果')
  expect(messagePosts(session.seen)).toHaveLength(0)
})

test('an unobserved edit keeps the draft until the recovery actions run', async ({ page }) => {
  test.setTimeout(90_000)
  await countAudioCallbacks(page)
  await installMedia(page, 'tone')
  const session = await unlock(page, { holdAsr: true })
  await page.evaluate(() => {
    const mark = window as unknown as { __copied?: string[] }
    mark.__copied = []
    const clipboard = navigator.clipboard
    clipboard.writeText = async (value: string) => {
      mark.__copied?.push(value)
    }
  })
  const composer = page.getByTestId('composer')
  await composer.fill('你好世界')
  await composer.evaluate((node) => {
    const box = node as HTMLTextAreaElement
    box.focus()
    box.setSelectionRange(2, 4)
  })
  await page.getByTestId('voice-input').click()
  await expect(page.getByTestId('voice-input')).toHaveAttribute('aria-label', '结束录音并转写')
  await waitForSamples(page)
  await page.getByTestId('voice-input').click()
  await expect(page.getByTestId('voice-input')).toHaveAttribute('aria-label', '正在转写，点击取消')
  await composer.fill('完全不同')
  session.releaseAsr()
  await expect(composer).toHaveValue('完全不同')
  const offer = page.getByTestId('voice-recovery')
  await expect(offer).toBeVisible()
  await expect(page.getByTestId('voice-recovery-transcript')).toHaveText('转写结果')
  expect(await page.evaluate(() => (window as unknown as { __copied?: string[] }).__copied ?? [])).toEqual([])
  await page.getByTestId('voice-recovery-copy').click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __copied?: string[] }).__copied ?? [])).toEqual(['转写结果'])
  await expect(composer).toHaveValue('完全不同')
  await page.getByTestId('voice-recovery-insert').click()
  await expect(composer).toHaveValue('完全不同转写结果')
  expect((await composer.inputValue()).startsWith('完全不同')).toBe(true)
  await expect(offer).toHaveCount(0)
  expect(messagePosts(session.seen)).toHaveLength(0)
})

test('a transcript for another conversation is not offered or inserted', async ({ page }) => {
  test.setTimeout(90_000)
  await countAudioCallbacks(page)
  await installMedia(page, 'tone')
  const session = await unlock(page, { holdAsr: true })
  await page.getByTestId('composer').fill('先说一句')
  await page.getByTestId('send').click()
  await expect(page.getByTestId('assistant-text')).toContainText('合成回答。')
  await page.getByTestId('new-chat').click()
  await expect(page.locator('.greeting')).toBeVisible()
  await page.getByTestId('composer').fill('下一句')
  await page.getByTestId('send').click()
  await expect(page.getByTestId('assistant-text').last()).toContainText('合成回答。')
  await page.locator('.chat-link', { hasText: '语音' }).click()
  const composer = page.getByTestId('composer')
  await composer.fill('你好世界')
  await composer.evaluate((node) => {
    const box = node as HTMLTextAreaElement
    box.focus()
    box.setSelectionRange(2, 4)
  })
  await page.getByTestId('voice-input').click()
  await expect(page.getByTestId('voice-input')).toHaveAttribute('aria-label', '结束录音并转写')
  await waitForSamples(page)
  await page.getByTestId('voice-input').click()
  await expect(page.getByTestId('voice-input')).toHaveAttribute('aria-label', '正在转写，点击取消')
  await composer.fill('完全不同')
  await page.locator('.chat-link', { hasText: '下一句' }).click()
  session.releaseAsr()
  await expect(page.getByTestId('voice-recovery')).toHaveCount(0)
  await expect(page.getByTestId('composer')).not.toHaveValue(/转写结果/)
  await page.locator('.chat-link', { hasText: '语音' }).click()
  await expect(page.getByTestId('voice-recovery')).toHaveCount(0)
  await expect(page.getByTestId('composer')).not.toHaveValue(/转写结果/)
  expect(messagePosts(session.seen)).toHaveLength(2)
})

test('cancelling transcription drops a late result with no recovery offer', async ({ page }) => {
  test.setTimeout(90_000)
  const { session, composer } = await armHeldSelection(page, 'abcabc', 0, 3)
  await openHeldRecording(page, session)
  await expect(composer).toHaveValue('abcabc')
  await page.getByTestId('voice-input').click()
  await expect(page.getByTestId('voice-input')).toHaveAttribute('aria-label', '语音输入')
  session.releaseAsr()
  await expect(composer).toHaveValue('abcabc')
  await expect(page.getByTestId('voice-recovery')).toHaveCount(0)
  expect(messagePosts(session.seen)).toHaveLength(0)
})

test('reloading the app closes the playing audio context', async ({ page }) => {
  test.setTimeout(90_000)
  const pcm = await playOpen(page)
  try {
    await page.reload()
    await expect(page.getByTestId('composer')).toBeVisible()
    const closed = await page.evaluate(() => sessionStorage.getItem('deepapi-pcm-closed'))
    expect(closed).not.toBeNull()
    await expect(page.getByTestId('read-aloud')).toHaveAttribute('aria-label', '朗读')
  } finally {
    await pcm.close()
  }
})
