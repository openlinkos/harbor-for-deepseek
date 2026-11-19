import type { Usage } from '@deepapi/types'

/**
 * Prices published for 2026-11-18, CNY.
 * Token rates are per 1,000,000 tokens, off-peak / peak.
 * Search and fetch are per 1,000 billed calls and do not change at peak.
 * Title generation is not billed. Thinking tokens are already inside output_tokens.
 */
export type PriceTable = {
  cacheHitPerMillion: [number, number]
  inputPerMillion: [number, number]
  outputPerMillion: [number, number]
  searchPerThousand: number
  fetchPerThousand: number
  filePagesPerThousand: number
}

export const PRICE_TABLE: PriceTable = {
  cacheHitPerMillion: [0.02, 0.04],
  inputPerMillion: [1, 2],
  outputPerMillion: [4, 8],
  searchPerThousand: 5,
  fetchPerThousand: 5,
  filePagesPerThousand: 1.5,
}

const SHANGHAI = 'Asia/Shanghai'

export const isPeakInstant = (at: Date): boolean => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SHANGHAI,
    weekday: 'short',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at)
  const weekday = parts.find((part) => part.type === 'weekday')?.value
  const hour = Number(parts.find((part) => part.type === 'hour')?.value)
  if (weekday === 'Sat' || weekday === 'Sun' || Number.isNaN(hour)) {
    return false
  }
  return (hour >= 9 && hour < 12) || (hour >= 14 && hour < 18)
}

export type CostBreakdown = {
  peak: boolean
  inputCny: number
  cacheCny: number
  outputCny: number
  searchCny: number
  fetchCny: number
  fileCny: number
  totalCny: number
  billedSearch: number
  billedFetch: number
}

const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000

export const estimateCost = (
  usage: Usage | null | undefined,
  at: Date,
  prices: PriceTable = PRICE_TABLE,
): CostBreakdown => {
  const peak = isPeakInstant(at)
  const side = peak ? 1 : 0
  const input = usage?.input_tokens ?? 0
  const cache = usage?.cache_read_input_tokens ?? 0
  const output = usage?.output_tokens ?? 0
  const tools = usage?.server_tool_use
  const billedSearch = (tools?.tool_search ?? 0) + (tools?.tool_image_search ?? 0)
  const billedFetch = tools?.tool_fetch ?? 0
  const pages = usage?.file_pages ?? 0
  const inputCny = (input / 1_000_000) * prices.inputPerMillion[side]
  const cacheCny = (cache / 1_000_000) * prices.cacheHitPerMillion[side]
  const outputCny = (output / 1_000_000) * prices.outputPerMillion[side]
  const searchCny = (billedSearch / 1000) * prices.searchPerThousand
  const fetchCny = (billedFetch / 1000) * prices.fetchPerThousand
  const fileCny = (pages / 1000) * prices.filePagesPerThousand
  const totalCny = inputCny + cacheCny + outputCny + searchCny + fetchCny + fileCny
  return {
    peak,
    inputCny: round(inputCny),
    cacheCny: round(cacheCny),
    outputCny: round(outputCny),
    searchCny: round(searchCny),
    fetchCny: round(fetchCny),
    fileCny: round(fileCny),
    totalCny: round(totalCny),
    billedSearch,
    billedFetch,
  }
}

export const sumUsage = (items: Array<Usage | null | undefined>): Usage => {
  const total: Usage = {
    input_tokens: 0,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
    output_tokens: 0,
    service_tier: 'standard',
    output_tokens_details: { thinking_tokens: 0, safety_tokens: 0 },
    server_tool_use: {
      web_search_requests: 0,
      web_fetch_requests: 0,
      tool_search: 0,
      tool_fetch: 0,
      tool_image_search: 0,
    },
    file_pages: 0,
  }
  for (const usage of items) {
    if (!usage) {
      continue
    }
    total.input_tokens += usage.input_tokens
    total.cache_creation_input_tokens += usage.cache_creation_input_tokens
    total.cache_read_input_tokens += usage.cache_read_input_tokens
    total.output_tokens += usage.output_tokens
    total.output_tokens_details!.thinking_tokens! += usage.output_tokens_details?.thinking_tokens ?? 0
    total.output_tokens_details!.safety_tokens! += usage.output_tokens_details?.safety_tokens ?? 0
    total.server_tool_use!.web_search_requests += usage.server_tool_use?.web_search_requests ?? 0
    total.server_tool_use!.web_fetch_requests += usage.server_tool_use?.web_fetch_requests ?? 0
    total.server_tool_use!.tool_search += usage.server_tool_use?.tool_search ?? 0
    total.server_tool_use!.tool_fetch += usage.server_tool_use?.tool_fetch ?? 0
    total.server_tool_use!.tool_image_search += usage.server_tool_use?.tool_image_search ?? 0
    total.file_pages! += usage.file_pages ?? 0
  }
  return total
}

export const formatCny = (value: number): string => {
  if (value === 0) {
    return '0'
  }
  if (value < 0.01) {
    return value.toFixed(4)
  }
  return value.toFixed(2)
}
