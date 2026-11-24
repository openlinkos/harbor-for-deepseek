import { expect, test, type Page, type Route } from './fixture.js'

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


export { installMedia, unlock, sse, asrPosts, messagePosts }
