/** Log bands across the speech range. Bar geometry matches the demo spectrum. */
export const BAR_WIDTH = 2
export const BAR_GAP = 3
export const BAR_MIN = 5
export const BAR_MAX = 36
export const MAX_BARS = 60
export const FREQ_LOW = 100
export const FREQ_HIGH = 4000
export const DB_FLOOR = -80
export const DB_CEIL = -25
const TILT_DB_PER_OCTAVE = 4

export type FrequencyRange = { from: number; to: number; center: number }

export const barCountFor = (width: number): number => {
  const fit = Math.floor((width + BAR_GAP) / (BAR_WIDTH + BAR_GAP))
  return Math.max(0, Math.min(MAX_BARS, fit))
}

export const buildRanges = (count: number, binWidth: number, binCount: number): FrequencyRange[] => {
  const ranges: FrequencyRange[] = []
  const ratio = FREQ_HIGH / FREQ_LOW
  for (let index = 0; index < count; index += 1) {
    const low = FREQ_LOW * ratio ** (index / count)
    const high = FREQ_LOW * ratio ** ((index + 1) / count)
    const from = Math.min(binCount - 1, Math.floor(low / binWidth))
    const to = Math.min(binCount, Math.max(from + 1, Math.ceil(high / binWidth)))
    ranges.push({ from, to, center: Math.sqrt(low * high) / binWidth })
  }
  return ranges
}

export const tiltFor = (count: number): Float32Array => {
  const tilts = new Float32Array(count)
  for (let index = 0; index < count; index += 1) {
    tilts[index] = TILT_DB_PER_OCTAVE * Math.log2(FREQ_HIGH / FREQ_LOW) * (index / count)
  }
  return tilts
}

/**
 * Peak each log band. Silence at the noise floor stays at 0.
 * Tilt compensates high-frequency rolloff only for energy above that floor;
 * adding it to the floor itself would light silent bars.
 */
export const bandTargets = (data: Float32Array, ranges: FrequencyRange[], tilts: Float32Array): Float32Array => {
  const targets = new Float32Array(ranges.length)
  for (let index = 0; index < ranges.length; index += 1) {
    const range = ranges[index]
    if (!range) continue
    let peak = Number.NEGATIVE_INFINITY
    if (range.to - range.from <= 1) {
      const base = Math.min(data.length - 2, Math.max(0, Math.floor(range.center)))
      const weight = range.center - base
      const left = data[base] ?? DB_FLOOR
      const right = data[Math.min(base + 1, data.length - 1)] ?? left
      peak = left * (1 - weight) + right * weight
    } else {
      for (let bin = range.from; bin < range.to; bin += 1) peak = Math.max(peak, data[bin] ?? DB_FLOOR)
    }
    if (!Number.isFinite(peak) || peak <= DB_FLOOR) continue
    const db = peak + (tilts[index] ?? 0)
    targets[index] = Math.min(1, Math.max(0, (db - DB_FLOOR) / (DB_CEIL - DB_FLOOR)))
  }
  return targets
}

export const barHeight = (level: number): number => BAR_MIN + (BAR_MAX - BAR_MIN) * level
