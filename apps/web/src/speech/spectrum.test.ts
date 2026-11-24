import { describe, expect, it } from 'vitest'
import { bandTargets, barCountFor, barHeight, buildRanges, DB_FLOOR, tiltFor, type FrequencyRange } from './spectrum.js'

/** Paint the bins a band actually reads, including a narrow band's interpolation pair. */
const paintBand = (data: Float32Array, range: FrequencyRange, value: number) => {
  if (range.to - range.from <= 1) {
    const base = Math.min(data.length - 2, Math.max(0, Math.floor(range.center)))
    data[base] = value
    const next = Math.min(base + 1, data.length - 1)
    data[next] = value
    return
  }
  for (let bin = range.from; bin < range.to; bin += 1) data[bin] = value
}

describe('spectrum levels', () => {
  it('stays down on silence and rises on a band that has signal', () => {
    const count = barCountFor(300)
    expect(count).toBeGreaterThan(1)
    const ranges = buildRanges(count, 16000 / 512, 256)
    const tilts = tiltFor(count)
    const quiet = bandTargets(new Float32Array(256).fill(DB_FLOOR), ranges, tilts)
    expect(Math.max(...quiet)).toBe(0)
    const loud = new Float32Array(256).fill(DB_FLOOR)
    const bin = ranges[Math.floor(count / 2)]?.from ?? 1
    loud[bin] = -20
    const levels = bandTargets(loud, ranges, tilts)
    expect(levels[Math.floor(count / 2)]).toBeGreaterThan(quiet[Math.floor(count / 2)] ?? 0)
    expect(barHeight(0)).toBe(5)
    expect(barHeight(1)).toBe(36)
  })

  it('tilts energy above the floor and still leaves the highest silent bar down', () => {
    const count = barCountFor(300)
    const ranges = buildRanges(count, 16000 / 512, 256)
    const tilts = tiltFor(count)
    const last = count - 1
    const quiet = bandTargets(new Float32Array(256).fill(DB_FLOOR), ranges, tilts)
    expect(quiet[0]).toBe(0)
    expect(quiet[last]).toBe(0)
    const below = -70
    const low = new Float32Array(256).fill(DB_FLOOR)
    const high = new Float32Array(256).fill(DB_FLOOR)
    const first = ranges[0]
    const highest = ranges[last]
    expect(first).toBeTruthy()
    expect(highest).toBeTruthy()
    if (!first || !highest) return
    paintBand(low, first, below)
    paintBand(high, highest, below)
    const lowLevel = bandTargets(low, ranges, tilts)[0] ?? 0
    const highLevel = bandTargets(high, ranges, tilts)[last] ?? 0
    expect(lowLevel).toBeGreaterThan(0)
    expect(lowLevel).toBeLessThan(1)
    expect(highLevel).toBeGreaterThan(lowLevel)
    expect(highLevel).toBeLessThan(1)
  })
})
