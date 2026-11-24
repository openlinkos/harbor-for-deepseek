import { ASR_MAX_BYTES, TTS_MAX_BILLING_CHARS } from '@deepapi/types'
import { describe, expect, it } from 'vitest'
import { ApiClientError, createClient } from './client.js'
import type { FetchLike } from './client.js'

const calls: Array<{ url: string; init: RequestInit }> = []

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const clientWith = (fetchImpl: FetchLike) => {
  calls.length = 0
  return createClient({
    origin: 'https://api.deepseek.com',
    fetch: async (url, init) => {
      calls.push({ url, init })
      return fetchImpl(url, init)
    },
  })
}

describe('speech transport', () => {
  it('posts the wav as multipart file with bearer and no manual content type', async () => {
    const client = clientWith(async () => jsonResponse({ text: '你好' }))
    const wav = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/wav' })
    const signal = new AbortController().signal
    await expect(client.transcribe('device-key', wav, signal)).resolves.toBe('你好')
    expect(calls).toHaveLength(1)
    const call = calls[0]
    expect(call?.url).toBe('https://api.deepseek.com/v1/tools/asr')
    expect(call?.init.method).toBe('POST')
    expect(call?.init.credentials).toBe('omit')
    expect(call?.init.signal).toBe(signal)
    const headers = call?.init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer device-key')
    expect(headers['Content-Type']).toBeUndefined()
    const form = call?.init.body as FormData
    const file = form.get('file') as File
    expect(file).toBeInstanceOf(Blob)
    expect(file.name).toBe('recording.wav')
    expect(form.get('purpose')).toBeNull()
  })

  it('treats an empty transcript as text and rejects a body without text', async () => {
    const ok = clientWith(async () => jsonResponse({ text: '' }))
    await expect(ok.transcribe('k', new Blob(['x']))).resolves.toBe('')
    const bad = clientWith(async () => jsonResponse({}))
    await expect(bad.transcribe('k', new Blob(['x']))).rejects.toMatchObject({ kind: 'protocol' })
  })

  it('does not call the network when the recording is over 8 MiB', async () => {
    const client = clientWith(async () => jsonResponse({ text: 'nope' }))
    const file = new Blob([new Uint8Array(ASR_MAX_BYTES + 1)])
    await expect(client.transcribe('k', file)).rejects.toMatchObject({ kind: 'http', status: 413 })
    expect(calls).toHaveLength(0)
  })

  it('posts the documented tts body and returns the pcm stream', async () => {
    const pcm = new Uint8Array([0x00, 0x00, 0xff, 0x7f])
    const signal = new AbortController().signal
    const client = clientWith(async () => new Response(pcm, { status: 200 }))
    const stream = await client.synthesize('device-key', '全文', 'tide', signal)
    const body = new Uint8Array(await new Response(stream).arrayBuffer())
    expect(Array.from(body)).toEqual(Array.from(pcm))
    const call = calls[0]
    expect(call?.url).toBe('https://api.deepseek.com/v1/tools/tts')
    expect(call?.init.credentials).toBe('omit')
    expect(call?.init.signal).toBe(signal)
    const headers = call?.init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer device-key')
    expect(headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(String(call?.init.body))).toEqual({
      text: '全文',
      voice_id: 'tide',
      format: 'pcm',
      filter_markdown: true,
    })
  })

  it('rejects an unsupported voice and an over-limit text before fetch', async () => {
    const client = clientWith(async () => new Response(new Uint8Array([0, 0])))
    await expect(client.synthesize('k', 'hi', '贝壳' as 'stella')).rejects.toBeInstanceOf(ApiClientError)
    await expect(client.synthesize('k', 'hi', '贝壳' as 'stella')).rejects.toMatchObject({ kind: 'protocol' })
    await expect(client.synthesize('k', '字'.repeat(TTS_MAX_BILLING_CHARS / 2 + 1), 'stella')).rejects.toMatchObject({
      status: 413,
    })
    expect(calls).toHaveLength(0)
  })

  it('maps an http error and leaves a separate chat abort untouched', async () => {
    const chat = new AbortController()
    const speech = new AbortController()
    const client = clientWith(async () => new Response('no', { status: 402 }))
    await expect(client.synthesize('k', 'hi', 'stella', speech.signal)).rejects.toMatchObject({ status: 402 })
    speech.abort()
    expect(chat.signal.aborted).toBe(false)
    expect(speech.signal.aborted).toBe(true)
  })
})
