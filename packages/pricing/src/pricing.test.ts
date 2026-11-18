import { describe, expect, it } from 'vitest'
import type { Usage } from '@harbor/types'
import { estimateCost, isPeakInstant, sumUsage } from './index.js'

const weatherUsage: Usage = {
  input_tokens: 7418,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 4096,
  output_tokens: 658,
  service_tier: 'standard',
  server_tool_use: {
    web_search_requests: 1,
    web_fetch_requests: 4,
    tool_search: 2,
    tool_fetch: 0,
    tool_image_search: 0,
  },
  output_tokens_details: { thinking_tokens: 438 },
}

describe('pricing', () => {
  it('treats Beijing weekday office hours as peak and nights and weekends as off-peak', () => {
    expect(isPeakInstant(new Date('2026-11-18T01:30:00+08:00'))).toBe(false)
    expect(isPeakInstant(new Date('2026-11-18T09:00:00+08:00'))).toBe(true)
    expect(isPeakInstant(new Date('2026-11-18T12:00:00+08:00'))).toBe(false)
    expect(isPeakInstant(new Date('2026-11-18T14:30:00+08:00'))).toBe(true)
    expect(isPeakInstant(new Date('2026-11-18T18:00:00+08:00'))).toBe(false)
    expect(isPeakInstant(new Date('2026-11-21T10:00:00+08:00'))).toBe(false)
  })

  it('bills tool_search and tool_fetch, not the display counters', () => {
    const at = new Date('2026-11-18T01:33:00+08:00')
    const cost = estimateCost(weatherUsage, at)
    expect(cost.peak).toBe(false)
    expect(cost.billedSearch).toBe(2)
    expect(cost.billedFetch).toBe(0)
    expect(cost.searchCny).toBeCloseTo(0.01, 6)
    expect(cost.fetchCny).toBe(0)
    const expected =
      (7418 / 1_000_000) * 1 + (4096 / 1_000_000) * 0.02 + (658 / 1_000_000) * 4 + 0.01
    expect(cost.totalCny).toBeCloseTo(expected, 6)
    expect(cost.totalCny).toBeLessThan(0.03)
  })

  it('doubles token rates at peak and still ignores web_fetch_requests when tool_fetch is 0', () => {
    const cost = estimateCost(weatherUsage, new Date('2026-11-18T15:00:00+08:00'))
    expect(cost.peak).toBe(true)
    expect(cost.fetchCny).toBe(0)
    expect(cost.outputCny).toBeCloseTo((658 / 1_000_000) * 8, 6)
    expect(cost.inputCny).toBeCloseTo((7418 / 1_000_000) * 2, 6)
  })

  it('does not add thinking tokens on top of output tokens', () => {
    const usage = sumUsage([
      weatherUsage,
      {
        input_tokens: 10,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        output_tokens: 5,
        service_tier: 'standard',
        output_tokens_details: { thinking_tokens: 4 },
        file_pages: 2,
      },
    ])
    const cost = estimateCost(usage, new Date('2026-11-18T01:00:00+08:00'))
    expect(usage.output_tokens).toBe(663)
    expect(cost.outputCny).toBeCloseTo((663 / 1_000_000) * 4, 6)
    expect(cost.fileCny).toBeCloseTo((2 / 1000) * 1.5, 6)
  })
})
