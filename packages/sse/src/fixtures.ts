import { reduceEvents } from './reduce.js'
import { readStreamEvent } from './parse.js'
import { ServerSentEventDecoder } from './decode.js'
import type { StreamEvent } from '@harbor/types'

/** Redacted shapes from the design notes, appendix B. No secrets. */

export const balanceFixture = {
  is_available: true,
  balance_infos: [
    {
      currency: 'CNY',
      total_balance: '317.22',
      granted_balance: '0.00',
      topped_up_balance: '317.22',
    },
  ],
}

export const modelsFixture = {
  object: 'list',
  data: [
    { id: 'deepseek-flash', object: 'model', owned_by: 'deepseek' },
    { id: 'deepseek-v4-pro', object: 'model', owned_by: 'deepseek' },
  ],
}

const startUsage = {
  input_tokens: 49,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
  output_tokens: 0,
  service_tier: 'standard',
}

const finalThinkingUsage = {
  input_tokens: 41,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
  output_tokens: 33,
  service_tier: 'standard',
  output_tokens_details: { thinking_tokens: 31 },
}

export const weatherUsage = {
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

export const thinkingEvents = (): StreamEvent[] => [
  {
    type: 'message_start',
    message: { id: 'req-add', model: 'deepseek-flash', usage: startUsage },
  },
  {
    type: 'content_block_start',
    index: 0,
    content_block: { type: 'thinking', thinking: '', signature: '' },
  },
  {
    type: 'content_block_delta',
    index: 0,
    delta: { type: 'thinking_delta', thinking: '3+5=8' },
  },
  {
    type: 'content_block_delta',
    index: 0,
    delta: { type: 'signature_delta', signature: 'sig-redacted' },
  },
  { type: 'content_block_stop', index: 0 },
  {
    type: 'content_block_start',
    index: 1,
    content_block: { type: 'text', text: '' },
  },
  {
    type: 'content_block_delta',
    index: 1,
    delta: { type: 'text_delta', text: '8' },
  },
  { type: 'content_block_stop', index: 1 },
  {
    type: 'message_delta',
    delta: { stop_reason: 'end_turn', stop_sequence: null, title: '简单加法' },
    usage: finalThinkingUsage,
  },
  { type: 'message_stop' },
  { type: 'ping' },
]

export const searchEvents = (): StreamEvent[] => [
  {
    type: 'message_start',
    message: { id: 'req-ice', model: 'deepseek-flash', usage: startUsage },
  },
  {
    type: 'content_block_start',
    index: 0,
    content_block: {
      type: 'server_tool_use',
      id: 'srvtoolu_s_00_redacted',
      name: 'deepseek_web_search',
      input: { action: 'search', queries: ['冰岛现在大约多少人口', 'Iceland population 2026'] },
      caller: { type: 'direct' },
      kind: 'search',
    },
  },
  { type: 'content_block_stop', index: 0 },
  {
    type: 'content_block_start',
    index: 1,
    content_block: {
      type: 'web_search_tool_result',
      tool_use_id: 'srvtoolu_s_00_redacted',
      kind: 'search',
      content: [
        {
          type: 'web_search_result',
          title: 'Iceland population',
          url: 'https://example.com/iceland',
          snippet: 'About 394,000 people.',
          site_name: 'Example',
          site_icon: null,
          page_age: null,
          encrypted_content: 'redacted',
        },
      ],
    },
  },
  { type: 'content_block_stop', index: 1 },
  {
    type: 'content_block_start',
    index: 2,
    content_block: { type: 'text', text: '' },
  },
  {
    type: 'content_block_delta',
    index: 2,
    delta: { type: 'text_delta', text: 'About 394,000.' },
  },
  {
    type: 'content_block_delta',
    index: 2,
    delta: {
      type: 'citations_delta',
      citation: {
        type: 'web_search_result_location',
        url: 'https://example.com/iceland',
        title: 'Iceland population',
        cited_text: 'About 394,000.',
        encrypted_index: '',
      },
    },
  },
  { type: 'content_block_stop', index: 2 },
  {
    type: 'message_delta',
    delta: { stop_reason: 'end_turn', stop_sequence: null, title: '冰岛人口' },
    usage: {
      input_tokens: 1905,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      output_tokens: 72,
      service_tier: 'standard',
      server_tool_use: {
        web_search_requests: 1,
        web_fetch_requests: 0,
        tool_search: 2,
        tool_fetch: 0,
        tool_image_search: 0,
      },
    },
  },
  { type: 'message_stop' },
]

export const readLinkEvents = (): StreamEvent[] => [
  {
    type: 'message_start',
    message: { id: 'req-link', model: 'deepseek-flash' },
  },
  {
    type: 'content_block_start',
    index: 0,
    content_block: {
      type: 'server_tool_use',
      id: 'srvtoolu_rl_00_redacted',
      name: 'deepseek_read_url',
      input: { action: 'read_link', url: 'https://example.com' },
      caller: { type: 'direct' },
      kind: 'read_link',
    },
  },
  {
    type: 'content_block_start',
    index: 1,
    content_block: {
      type: 'web_fetch_tool_result',
      tool_use_id: 'srvtoolu_rl_00_redacted',
      kind: 'read_link',
      signature: 'signature-redacted',
      content: {
        type: 'web_fetch_result',
        url: 'https://example.com',
        content: {
          type: 'document',
          title: 'Example Domain',
          source: { type: 'text', media_type: 'text/plain', data: '' },
        },
        published_at: null,
      },
    },
  },
  {
    type: 'content_block_start',
    index: 2,
    content_block: { type: 'text', text: 'Example Domain is reserved for documentation.' },
  },
  {
    type: 'message_delta',
    delta: { stop_reason: 'end_turn', stop_sequence: null },
    usage: {
      input_tokens: 80,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      output_tokens: 40,
      service_tier: 'standard',
      server_tool_use: {
        web_search_requests: 0,
        web_fetch_requests: 1,
        tool_search: 0,
        tool_fetch: 1,
        tool_image_search: 0,
      },
    },
  },
  { type: 'message_stop' },
]

export const fileObjectFixture = {
  id: 'file-api-00000000-0000-4000-8000-000000000001',
  object: 'file',
  bytes: 588,
  created_at: 1794936646,
  filename: 'probe.pdf',
  purpose: 'text_recognition',
  expires_at: 1794940246,
}

export const eventsToSse = (events: StreamEvent[]): string =>
  events
    .map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
    .join('')
    .concat(': keep-alive\n\n')

export const parseSse = (payload: string): StreamEvent[] => {
  const decoder = new ServerSentEventDecoder()
  const frames = decoder.push(payload)
  frames.push(...decoder.end())
  return frames.flatMap((frame) => {
    const parsed = readStreamEvent(JSON.parse(frame.data) as unknown)
    return parsed ? [parsed] : []
  })
}

export const draftFromEvents = (events: StreamEvent[]) => reduceEvents(events)
