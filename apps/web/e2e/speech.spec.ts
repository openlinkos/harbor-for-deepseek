import { expect, test, type Page, type Route } from '@playwright/test'

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

const unlock = async (page: Page, options?: { asrText?: string; holdAsr?: boolean; holdTts?: boolean }) => {
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
