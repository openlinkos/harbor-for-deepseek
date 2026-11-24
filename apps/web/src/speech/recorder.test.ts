import { ASR_SAMPLE_RATE } from '@deepapi/types'
import { describe, expect, it } from 'vitest'
import { startRecording, type RecordingContext, type RecordingHost } from './recorder.js'

const hostWith = (sampleRate: number) => {
  let handler: ((event: { inputBuffer: { getChannelData(channel: number): Float32Array } }) => void) | null = null
  let stopped = 0
  let closed = 0
  const stream = { getTracks: () => [{ stop: () => { stopped += 1 } }] } as unknown as MediaStream
  const host: RecordingHost = {
    async getUserMedia() {
      return stream
    },
    createContext(): RecordingContext {
      return {
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
        close() { closed += 1 },
      }
    },
  }
  return {
    host,
    push(samples: Float32Array) {
      handler?.({ inputBuffer: { getChannelData: () => samples } })
    },
    stopped: () => stopped,
    closed: () => closed,
  }
}

describe('recorder lifecycle', () => {
  it('encodes injected samples at 16 kHz and releases the device on stop', async () => {
    const fake = hostWith(ASR_SAMPLE_RATE)
    const recording = await startRecording(() => undefined, fake.host)
    fake.push(new Float32Array([0, 0.5, -0.5]))
    const wav = await recording.stop()
    expect(wav).toBeTruthy()
    const view = new DataView(await wav!.arrayBuffer())
    expect(view.getUint32(24, true)).toBe(ASR_SAMPLE_RATE)
    expect(view.getUint32(40, true)).toBe(6)
    expect(fake.stopped()).toBeGreaterThan(0)
    expect(fake.closed()).toBe(1)
    await recording.stop()
    expect(fake.closed()).toBe(1)
  })

  it('stops at 120 seconds and resamples a 48 kHz context', async () => {
    const limited = hostWith(ASR_SAMPLE_RATE)
    let hits = 0
    const recording = await startRecording(() => { hits += 1 }, limited.host)
    limited.push(new Float32Array(ASR_SAMPLE_RATE * 120))
    limited.push(new Float32Array(ASR_SAMPLE_RATE))
    expect(hits).toBe(1)
    const wav = await recording.stop()
    const view = new DataView(await wav!.arrayBuffer())
    expect(view.getUint32(40, true) / 2).toBe(ASR_SAMPLE_RATE * 120)

    const fast = hostWith(48000)
    const high = await startRecording(() => undefined, fast.host)
    fast.push(new Float32Array(48000))
    const resampled = await high.stop()
    const highView = new DataView(await resampled!.arrayBuffer())
    expect(highView.getUint32(24, true)).toBe(ASR_SAMPLE_RATE)
    expect(highView.getUint32(40, true) / 2).toBe(ASR_SAMPLE_RATE)
  })

  it('returns null for silence of zero length and cancel closes the capture', async () => {
    const fake = hostWith(ASR_SAMPLE_RATE)
    const empty = await startRecording(() => undefined, fake.host)
    expect(await empty.stop()).toBeNull()
    expect(fake.stopped()).toBeGreaterThan(0)
    const again = hostWith(ASR_SAMPLE_RATE)
    const recording = await startRecording(() => undefined, again.host)
    recording.cancel()
    expect(again.stopped()).toBeGreaterThan(0)
    expect(again.closed()).toBe(1)
    expect(await recording.stop()).toBeNull()
  })
})
