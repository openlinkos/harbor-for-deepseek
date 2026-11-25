import { ASR_MAX_SECONDS, ASR_SAMPLE_RATE } from '@deepapi/types'

export const floatToInt16 = (sample: number): number => {
  const clamped = Math.max(-1, Math.min(1, sample))
  if (clamped < 0) return Math.round(clamped * 0x8000)
  return Math.round(clamped * 0x7fff)
}

/** Linear resample so a browser that ignores the requested rate is not labeled 16 kHz. */
export const resampleLinear = (input: Float32Array, fromRate: number, toRate: number): Float32Array => {
  if (fromRate === toRate || input.length === 0) return input
  const outLength = Math.max(1, Math.round((input.length * toRate) / fromRate))
  const out = new Float32Array(outLength)
  const scale = input.length / outLength
  for (let index = 0; index < outLength; index += 1) {
    const position = index * scale
    const left = Math.floor(position)
    const frac = position - left
    const a = input[left] ?? 0
    const b = input[Math.min(left + 1, input.length - 1)] ?? a
    out[index] = a + (b - a) * frac
  }
  return out
}

const writeString = (view: DataView, offset: number, text: string) => {
  for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index))
}

/** 16-bit little-endian mono PCM WAV. Samples beyond 120 s are dropped. */
export const encodeWav = (samples: Float32Array, sampleRate = ASR_SAMPLE_RATE): Blob => {
  const cap = ASR_MAX_SECONDS * sampleRate
  const capped = samples.length > cap ? samples.subarray(0, cap) : samples
  const dataBytes = capped.length * 2
  const buffer = new ArrayBuffer(44 + dataBytes)
  const view = new DataView(buffer)
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataBytes, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(view, 36, 'data')
  view.setUint32(40, dataBytes, true)
  let offset = 44
  for (let index = 0; index < capped.length; index += 1) {
    view.setInt16(offset, floatToInt16(capped[index] ?? 0), true)
    offset += 2
  }
  return new Blob([buffer], { type: 'audio/wav' })
}
