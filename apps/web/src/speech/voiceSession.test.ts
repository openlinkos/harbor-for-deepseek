import { ApiClientError } from '@deepapi/api-client'
import { ASR_SAMPLE_RATE } from '@deepapi/types'
import { describe, expect, it } from 'vitest'
import { startRecording, type Recording, type RecordingHost } from './recorder.js'
import { applyVoiceEdit, createVoiceInput, insertTranscript, resolveVoiceAnchor, type VoiceDeps } from './voiceSession.js'

const flush = async () => {
  for (let i = 0; i < 8; i += 1) await Promise.resolve()
}

const recording = (wav: Blob | null, cancel = () => undefined): Recording => ({
  analyser: { fftSize: 512, smoothingTimeConstant: 0.2, frequencyBinCount: 256, getFloatFrequencyData() {} },
  stop: async () => wav,
  cancel,
})

const wav = () => new Blob([new Uint8Array(80)], { type: 'audio/wav' })

const setup = (overrides: Partial<VoiceDeps> = {}) => {
  const errors: string[] = []
  const texts: string[] = []
  let conversation: string | null = 'c1'
  let secure = true
  let now = 1_000
  const session = createVoiceInput({
    now: () => now,
    startRecording: async () => recording(wav()),
    transcribe: async () => '你好',
    secure: () => secure,
    gate: () => ({ ok: true }),
    onError: (key) => errors.push(key),
    onText: (text) => texts.push(text),
    activeConversationId: () => conversation,
    ...overrides,
  })
  return {
    session,
    errors,
    texts,
    setConversation: (id: string | null) => { conversation = id },
    setSecure: (value: boolean) => { secure = value },
    advance: (ms: number) => { now += ms },
  }
}

describe('transcript insertion', () => {
  it('replaces the saved selection and does not require a send', () => {
    expect(insertTranscript('hello world', 'there', { start: 6, end: 11 })).toEqual({ text: 'hello there', caret: 11 })
    expect(insertTranscript('abcd', 'X', { start: 3, end: 1 })).toEqual({ text: 'aXd', caret: 2 })
    expect(insertTranscript('ab', 'Z', { start: 9, end: 12 })).toEqual({ text: 'abZ', caret: 3 })
  })

  it('keeps a saved range through edits that have one anchor and refuses a stale index', () => {
    expect(resolveVoiceAnchor('你好世界', { text: '你好世界', start: 2, end: 4 })).toEqual({ start: 2, end: 4 })
    expect(resolveVoiceAnchor('你好世界', { text: '你好世界', start: 2, end: 2 })).toEqual({ start: 2, end: 2 })
    expect(resolveVoiceAnchor('你好世界', { text: '你好世界', start: 4, end: 2 })).toEqual({ start: 2, end: 4 })
    expect(resolveVoiceAnchor('啊你好世界', { text: '你好世界', start: 2, end: 4 })).toEqual({ start: 3, end: 5 })
    expect(resolveVoiceAnchor('好世界', { text: '你好世界', start: 2, end: 4 })).toEqual({ start: 1, end: 3 })
    expect(resolveVoiceAnchor('你好世界!', { text: '你好世界', start: 0, end: 2 })).toEqual({ start: 0, end: 2 })
    expect(resolveVoiceAnchor('你好大家', { text: '你好世界', start: 2, end: 4 })).toEqual({ start: 2, end: 4 })
    expect(resolveVoiceAnchor('abZZcd', { text: 'abXYcd', start: 2, end: 4 })).toEqual({ start: 2, end: 4 })
    expect(resolveVoiceAnchor('你好啊世界', { text: '你好世界', start: 2, end: 2 })).toEqual({ start: 3, end: 3 })
    expect(resolveVoiceAnchor('你好世界!', { text: '你好世界', start: 4, end: 4 })).toEqual({ start: 4, end: 4 })
    expect(resolveVoiceAnchor('啊你好世界', { text: '你好世界', start: 4, end: 4 })).toEqual({ start: 5, end: 5 })
    expect(resolveVoiceAnchor('你好世啊界', { text: '你好世界', start: 2, end: 2 })).toEqual({ start: 2, end: 2 })
    expect(resolveVoiceAnchor('已输入', { text: '', start: 0, end: 0 })).toEqual({ start: 3, end: 3 })
    expect(resolveVoiceAnchor('啊你好大家', { text: '你好世界', start: 2, end: 4 })).toBeNull()
    expect(resolveVoiceAnchor('完全不同', { text: '你好世界', start: 2, end: 4 })).toBeNull()
    // old="abcabc", select the first "abc", current="abcabcabc".
    // A prepend and an append are the same string. The suffix match is not an edit location.
    expect(resolveVoiceAnchor('abcabcabc', { text: 'abcabc', start: 0, end: 3 })).toBeNull()
    expect(resolveVoiceAnchor('abcabcabc', { text: 'abcabc', start: 3, end: 6 })).toBeNull()
    expect(resolveVoiceAnchor('你好世界世界', { text: '你好世界', start: 2, end: 4 })).toBeNull()
    const shifted = resolveVoiceAnchor('啊你好世界', { text: '你好世界', start: 2, end: 4 })
    expect(shifted).toEqual({ start: 3, end: 5 })
    expect(insertTranscript('啊你好世界', '转写结果', shifted!)).toEqual({ text: '啊你好转写结果', caret: 7 })
  })

  it('uses an observed caret when a repeated draft makes the string ambiguous', () => {
    const saved = { text: 'abcabc', start: 0, end: 3 }
    expect(applyVoiceEdit(saved, 'abcabcabc', 6, 6)).toEqual({ status: 'applied', text: 'abcabcabc', start: 0, end: 3 })
    expect(insertTranscript('abcabcabc', '转写结果', { start: 0, end: 3 })).toEqual({ text: '转写结果abcabc', caret: 4 })
    expect(applyVoiceEdit(saved, 'abcabcabc', 0, 0)).toEqual({ status: 'applied', text: 'abcabcabc', start: 3, end: 6 })
    expect(insertTranscript('abcabcabc', '转写结果', { start: 3, end: 6 })).toEqual({ text: 'abc转写结果abc', caret: 7 })
    let step = applyVoiceEdit(saved, 'abcabca', 6, 6)
    expect(step.status).toBe('applied')
    if (step.status !== 'applied') return
    step = applyVoiceEdit(step, 'abcabcab', 7, 7)
    expect(step.status).toBe('applied')
    if (step.status !== 'applied') return
    step = applyVoiceEdit(step, 'abcabcabc', 8, 8)
    expect(step).toEqual({ status: 'applied', text: 'abcabcabc', start: 0, end: 3 })
    expect(applyVoiceEdit({ text: '你好世界', start: 2, end: 4 }, '完全不同', 0, 4)).toEqual({ status: 'rejected' })
    expect(applyVoiceEdit(saved, 'zzz', 0, 0)).toEqual({ status: 'unexplained' })
    expect(applyVoiceEdit({ text: '你好世界', start: 4, end: 4 }, '你好世界!', 4, 4)).toEqual({ status: 'applied', text: '你好世界!', start: 4, end: 4 })
    expect(applyVoiceEdit({ text: '你好世界', start: 2, end: 4 }, '你好世界世界', 4, 4)).toEqual({ status: 'applied', text: '你好世界世界', start: 2, end: 4 })
    expect(applyVoiceEdit({ text: '你好世界', start: 2, end: 2 }, '你好啊世界', 2, 2)).toEqual({ status: 'applied', text: '你好啊世界', start: 3, end: 3 })
  })
})

describe('voice input', () => {
  it('transcribes a whole recording and drops a late result after cancel', async () => {
    const pending: { resolve: ((value: string) => void) | null } = { resolve: null }
    const box = setup({
      transcribe: () => new Promise((resolve) => { pending.resolve = resolve }),
    })
    const first = box.session.getSnapshot()
    expect(box.session.getSnapshot()).toBe(first)
    box.session.toggle()
    await flush()
    expect(box.session.getSnapshot().phase).toBe('recording')
    box.advance(1500)
    box.session.tick()
    expect(box.session.getSnapshot().elapsedMs).toBe(1500)
    box.session.toggle()
    await flush()
    expect(box.session.getSnapshot().phase).toBe('transcribing')
    box.session.cancel()
    pending.resolve?.('迟到')
    await flush()
    expect(box.texts).toEqual([])
    expect(box.errors).toEqual([])
    expect(box.session.getSnapshot().phase).toBe('idle')
  })

  it('inserts only while the conversation still matches', async () => {
    const box = setup()
    box.session.toggle()
    await flush()
    box.session.toggle()
    box.setConversation('c2')
    await flush()
    expect(box.texts).toEqual([])
    expect(box.session.getSnapshot().phase).toBe('idle')
  })

  it('reports empty audio, http failures, permission, and a missing device', async () => {
    const empty = setup({ startRecording: async () => recording(null) })
    empty.session.toggle()
    await flush()
    empty.session.toggle()
    await flush()
    expect(empty.errors).toEqual(['voiceInputEmpty'])

    const denied = setup({
      startRecording: async () => { throw new DOMException('no', 'NotAllowedError') },
    })
    denied.session.toggle()
    await flush()
    expect(denied.errors).toEqual(['voiceInputPermissionDenied'])
    expect(denied.session.getSnapshot().phase).toBe('idle')

    const missing = setup({
      startRecording: async () => { throw new DOMException('none', 'NotFoundError') },
    })
    missing.session.toggle()
    await flush()
    expect(missing.errors).toEqual(['voiceInputNoDevice'])

    const balance = setup({
      transcribe: async () => { throw new ApiClientError('http', 'pay', 402) },
    })
    balance.session.toggle()
    await flush()
    balance.session.toggle()
    await flush()
    expect(balance.errors).toEqual(['usageLimitReached'])

    const limited = setup({
      transcribe: async () => { throw new ApiClientError('http', 'slow', 429) },
    })
    limited.session.toggle()
    await flush()
    limited.session.toggle()
    await flush()
    expect(limited.errors).toEqual(['requestFrequencyTooHigh'])
  })

  it('does not open the microphone when the context is insecure or there is no local key', async () => {
    let opened = 0
    const insecure = setup({
      secure: () => false,
      startRecording: async () => { opened += 1; return recording(wav()) },
    })
    insecure.session.toggle()
    expect(opened).toBe(0)
    expect(insecure.errors).toEqual(['voiceInputRequiresHttps'])

    const server = setup({
      gate: () => ({ ok: false, key: 'voiceInputNeedsLocalKey' }),
      startRecording: async () => { opened += 1; return recording(wav()) },
    })
    server.session.toggle()
    expect(opened).toBe(0)
    expect(server.errors).toEqual(['voiceInputNeedsLocalKey'])
  })

  it('drops a microphone that arrives after cancel and stops at 120 seconds', async () => {
    const pendingRec: { resolve: ((value: Recording) => void) | null } = { resolve: null }
    let cancelled = 0
    const late = setup({
      startRecording: () => new Promise((resolve) => { pendingRec.resolve = resolve }),
    })
    late.session.toggle()
    expect(late.session.getSnapshot().phase).toBe('idle')
    late.session.toggle()
    pendingRec.resolve?.(recording(wav(), () => { cancelled += 1 }))
    await flush()
    expect(cancelled).toBe(1)
    expect(late.texts).toEqual([])

    const fake = fakeHost(ASR_SAMPLE_RATE)
    const limited = setup({
      startRecording: (onLimit) => startRecording(onLimit, fake.host),
    })
    limited.session.toggle()
    await flush()
    fake.push(new Float32Array(ASR_SAMPLE_RATE * 120))
    await flush()
    expect(limited.errors).toEqual(['voiceInputTooLong'])
    expect(limited.texts).toEqual(['你好'])
  })
})

const fakeHost = (sampleRate: number) => {
  let handler: ((event: { inputBuffer: { getChannelData(channel: number): Float32Array } }) => void) | null = null
  const stream = { getTracks: () => [{ stop() {} }] } as unknown as MediaStream
  const host: RecordingHost = {
    async getUserMedia() { return stream },
    createContext: () => ({
      sampleRate,
      destination: {} as AudioNode,
      createMediaStreamSource: () => ({ connect() {}, disconnect() {} }),
      createAnalyser: () => ({
        fftSize: 0,
        smoothingTimeConstant: 0,
        frequencyBinCount: 256,
        getFloatFrequencyData() {},
        connect() {},
        disconnect() {},
      }),
      createScriptProcessor: () => ({
        set onaudioprocess(fn) { handler = fn },
        get onaudioprocess() { return handler },
        connect() {},
        disconnect() {},
      }),
      close() {},
    }),
  }
  return { host, push: (samples: Float32Array) => handler?.({ inputBuffer: { getChannelData: () => samples } }) }
}
