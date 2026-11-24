import { ApiClientError } from '@deepapi/api-client'
import type { TtsVoice } from '@deepapi/types'
import { describe, expect, it } from 'vitest'
import { createReadAloud, type ReadAloudDeps } from './readAloud.js'
import type { PcmAudioHost, ScheduledClip } from './player.js'

const flush = async () => {
  for (let i = 0; i < 8; i += 1) await Promise.resolve()
}

const audio = () => {
  const clips: Array<ScheduledClip & { samples: Float32Array; when: number; stopped: boolean }> = []
  let closed = 0
  let resumed = 0
  const host: PcmAudioHost = {
    currentTime: 0,
    resume() { resumed += 1 },
    close() { closed += 1 },
    play(samples, when) {
      const clip = {
        samples,
        when,
        stopped: false,
        onended: null as (() => void) | null,
        stop() { clip.stopped = true },
        disconnect() {},
      }
      clips.push(clip)
      return clip
    },
  }
  return { host, clips, closed: () => closed, resumed: () => resumed }
}

const bytes = (...values: number[]) => new Uint8Array(values)

const streamFrom = (chunks: Uint8Array[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk)
      controller.close()
    },
  })

const setup = (overrides: Partial<ReadAloudDeps> = {}) => {
  const media = audio()
  const errors: string[] = []
  const voices: TtsVoice[] = []
  let voice: TtsVoice = 'stella'
  let contexts = 0
  const session = createReadAloud({
    synthesize: async (_text, selected) => {
      voices.push(selected)
      return streamFrom([bytes(0x00, 0x00, 0x00, 0x00)])
    },
    createContext: () => {
      contexts += 1
      return media.host
    },
    getVoice: () => voice,
    onError: (key) => errors.push(key),
    canSpeak: () => ({ ok: true }),
    ...overrides,
  })
  return { session, media, errors, voices, contexts: () => contexts, setVoice: (next: TtsVoice) => { voice = next } }
}

describe('read aloud', () => {
  it('creates the audio host synchronously and plays carried odd chunks', async () => {
    const media = audio()
    let contexts = 0
    const session = createReadAloud({
      synthesize: async () => streamFrom([bytes(0x00, 0x10, 0xff), bytes(0x7f)]),
      createContext: () => {
        contexts += 1
        return media.host
      },
      getVoice: () => 'tide',
      onError: () => { throw new Error('unexpected') },
      canSpeak: () => ({ ok: true }),
    })
    session.toggle('m1', 'c1', '  hello ')
    expect(contexts).toBe(1)
    expect(media.resumed()).toBe(1)
    expect(session.getSnapshot()).toMatchObject({ status: 'loading', messageId: 'm1' })
    await flush()
    expect(session.getSnapshot().status).toBe('playing')
    expect(media.clips).toHaveLength(2)
    expect(media.clips[0]?.when).toBeCloseTo(0.1)
    expect(media.clips[1] && media.clips[1].when).toBeGreaterThan(media.clips[0]!.when)
    media.clips.at(-1)?.onended?.()
    await flush()
    expect(session.getSnapshot().status).toBe('idle')
    expect(media.closed()).toBeGreaterThan(0)
  })

  it('stops the request and queued audio without touching another abort controller', async () => {
    const chat = new AbortController()
    const captured: { signal: AbortSignal | null } = { signal: null }
    const { session, media, errors } = setup({
      synthesize: (_text, _voice, signal) => new Promise((_resolve, reject) => {
        captured.signal = signal
        signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      }),
    })
    session.toggle('m1', 'c1', 'hello')
    expect(session.getSnapshot().status).toBe('loading')
    session.stop()
    await flush()
    expect(session.getSnapshot().status).toBe('idle')
    expect(captured.signal?.aborted).toBe(true)
    expect(chat.signal.aborted).toBe(false)
    expect(errors).toEqual([])
    expect(media.closed()).toBeGreaterThan(0)
  })

  it('plays only one answer and reads the voice at the start of the gesture', async () => {
    let release: ((stream: ReadableStream<Uint8Array>) => void) | null = null
    const seen: TtsVoice[] = []
    let voice: TtsVoice = 'stella'
    const { session } = setup({
      getVoice: () => voice,
      synthesize: (text, selected, signal) => {
        seen.push(selected)
        voice = 'tide'
        if (text === 'first') {
          return new Promise((resolve, reject) => {
            release = resolve
            signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
          })
        }
        return Promise.resolve(streamFrom([bytes(0x00, 0x00)]))
      },
    })
    session.toggle('a', 'c', 'first')
    session.toggle('b', 'c', 'second')
    await flush()
    expect(seen).toEqual(['stella', 'stella'])
    expect(session.getSnapshot().messageId).toBe('b')
    expect(release).toBeTruthy()
    session.toggle('b', 'c', 'second')
    expect(session.getSnapshot().status).toBe('idle')
  })

  it('reports a dangling byte and a read error, and does not toast a clean eof', async () => {
    const dangling = setup({
      synthesize: async () => streamFrom([bytes(0x00, 0x00, 0x01)]),
    })
    dangling.session.toggle('m', 'c', 'hello')
    await flush()
    expect(dangling.errors).toEqual(['ttsDangling'])
    expect(dangling.session.getSnapshot().status).toBe('idle')

    const broken = setup({
      synthesize: async () => new ReadableStream({
        start(controller) {
          controller.enqueue(bytes(0x00, 0x00))
          controller.error(new Error('cut'))
        },
      }),
    })
    broken.session.toggle('m', 'c', 'hello')
    await flush()
    expect(broken.errors).toEqual(['ttsStreamError'])
    expect(broken.session.getSnapshot().status).toBe('idle')

    const clean = setup()
    clean.session.toggle('m', 'c', 'hello')
    await flush()
    clean.media.clips.at(-1)?.onended?.()
    await flush()
    expect(clean.errors).toEqual([])
    expect(clean.session.getSnapshot().status).toBe('idle')
  })

  it('does not open a context for empty text, a refused gate, or a browser voice', async () => {
    const refused = setup({ canSpeak: () => ({ ok: false, key: 'ttsNeedsLocalKey' }) })
    refused.session.toggle('m', 'c', 'hello')
    expect(refused.contexts()).toBe(0)
    expect(refused.errors).toEqual(['ttsNeedsLocalKey'])

    const empty = setup()
    empty.session.toggle('m', 'c', '   ')
    expect(empty.contexts()).toBe(0)
    expect(empty.errors).toEqual(['ttsUnavailable'])

    const limited = setup({
      synthesize: async () => { throw new ApiClientError('http', 'big', 413) },
    })
    limited.session.toggle('m', 'c', 'hello')
    await flush()
    expect(limited.errors).toEqual(['ttsTooLong'])
    expect(limited.media.closed()).toBeGreaterThan(0)
  })
})
