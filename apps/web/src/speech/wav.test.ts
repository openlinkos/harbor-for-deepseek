import { ASR_MAX_SECONDS, ASR_SAMPLE_RATE } from '@deepapi/types'
import { describe, expect, it } from 'vitest'
import { encodeWav, floatToInt16, resampleLinear } from './wav.js'

const readWav = async (blob: Blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const view = new DataView(bytes.buffer)
  const text = (offset: number, length: number) => String.fromCharCode(...bytes.subarray(offset, offset + length))
  return {
    bytes,
    riff: text(0, 4),
    wave: text(8, 4),
    fmt: text(12, 4),
    data: text(36, 4),
    audioFormat: view.getUint16(20, true),
    channels: view.getUint16(22, true),
    sampleRate: view.getUint32(24, true),
    byteRate: view.getUint32(28, true),
    blockAlign: view.getUint16(32, true),
    bits: view.getUint16(34, true),
    dataBytes: view.getUint32(40, true),
    sample: (index: number) => view.getInt16(44 + index * 2, true),
  }
}

describe('wav encoder', () => {
  it('writes a 16 kHz signed-16 mono header and the documented int16 rounding', async () => {
    expect(floatToInt16(1)).toBe(32767)
    expect(floatToInt16(-1)).toBe(-32768)
    expect(floatToInt16(0)).toBe(0)
    const wav = await readWav(encodeWav(new Float32Array([0, 1, -1, 0.5])))
    expect(wav.riff).toBe('RIFF')
    expect(wav.wave).toBe('WAVE')
    expect(wav.fmt).toBe('fmt ')
    expect(wav.data).toBe('data')
    expect(wav.audioFormat).toBe(1)
    expect(wav.channels).toBe(1)
    expect(wav.sampleRate).toBe(ASR_SAMPLE_RATE)
    expect(wav.byteRate).toBe(ASR_SAMPLE_RATE * 2)
    expect(wav.blockAlign).toBe(2)
    expect(wav.bits).toBe(16)
    expect(wav.dataBytes).toBe(8)
    expect(wav.sample(0)).toBe(0)
    expect(wav.sample(1)).toBe(32767)
    expect(wav.sample(2)).toBe(-32768)
    expect(wav.bytes.length).toBe(44 + 8)
  })

  it('caps duration at 120 seconds', async () => {
    const wav = await readWav(encodeWav(new Float32Array(ASR_SAMPLE_RATE * (ASR_MAX_SECONDS + 1))))
    expect(wav.dataBytes / 2 / wav.sampleRate).toBe(ASR_MAX_SECONDS)
  })

  it('resamples a higher capture rate down to 16 kHz', () => {
    const input = new Float32Array(48000)
    input[0] = 1
    input[47999] = -1
    const out = resampleLinear(input, 48000, ASR_SAMPLE_RATE)
    expect(out.length).toBe(ASR_SAMPLE_RATE)
    expect(out[0]).toBeCloseTo(1, 5)
  })
})
