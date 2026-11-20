import { describe, expect, it } from 'vitest'
import { ServerSentEventDecoder } from './decode.js'
import { eventsToSse, parseSse, searchEvents, thinkingEvents, weatherUsage } from './fixtures.js'
import { reduceEvents } from './reduce.js'

describe('ServerSentEventDecoder', () => {
  it('ignores comment keep-alives and accepts CR LF splits', () => {
    const decoder = new ServerSentEventDecoder()
    const first = decoder.push('event: ping\r\ndata: {"type":"ping"}\r\n\r\n: keep-alive\n\n')
    expect(first.map((event) => event.event)).toEqual(['ping'])
    const second = decoder.push('event: message_stop\ndata: {"type":"message_stop"}\n\n')
    expect(second[0]?.data).toContain('message_stop')
  })

  it('joins multi-line data and drops a trailing event without a blank line', () => {
    const decoder = new ServerSentEventDecoder()
    const events = decoder.push('data: one\ndata: two\n')
    expect(events).toEqual([])
    expect(decoder.end()).toEqual([])
    const done = new ServerSentEventDecoder()
    expect(done.push('data: one\n\n')).toEqual([
      { event: 'message', data: 'one', lastEventId: '' },
    ])
  })
})

describe('stream reducer', () => {
  it('keeps the final usage and the generated title, not message_start usage', () => {
    const draft = reduceEvents(thinkingEvents())
    expect(draft.startedUsage?.input_tokens).toBe(49)
    expect(draft.usage?.input_tokens).toBe(41)
    expect(draft.usage?.output_tokens).toBe(33)
    expect(draft.usage?.output_tokens_details?.thinking_tokens).toBe(31)
    expect(draft.title).toBe('简单加法')
    expect(draft.blocks[0]).toMatchObject({ type: 'thinking', thinking: '3+5=8', signature: 'sig-redacted' })
    expect(draft.blocks[1]).toMatchObject({ type: 'text', text: '8' })
    expect(draft.stopped).toBe(true)
  })

  it('round-trips a search stream through SSE text, including a keep-alive', () => {
    const payload = `: keep-alive\n\n${eventsToSse(searchEvents())}`
    const events = parseSse(payload)
    const draft = reduceEvents(events)
    expect(draft.blocks[0]).toMatchObject({ type: 'server_tool_use', kind: 'search' })
    expect(draft.blocks[2]).toMatchObject({
      type: 'text',
      text: 'About 394,000.',
      citations: [{ url: 'https://example.com/iceland' }],
    })
    expect(draft.usage?.server_tool_use).toMatchObject({
      web_search_requests: 1,
      tool_search: 2,
      tool_fetch: 0,
    })
  })

  it('records the text offset a citation arrived at', () => {
    const draft = reduceEvents([
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '甲。' } },
      {
        type: 'content_block_delta',
        index: 0,
        delta: {
          type: 'citations_delta',
          citation: {
            type: 'web_search_result_location',
            url: 'https://example.com/a',
            title: 'A',
            cited_text: 'src',
            encrypted_index: '',
          },
        },
      },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '乙。' } },
    ])
    expect(draft.blocks[0]).toMatchObject({ type: 'text', text: '甲。乙。', citations: [{ at: 2, url: 'https://example.com/a' }] })
  })

  it('preserves the deep-search billing split from the weather round', () => {
    expect(weatherUsage.server_tool_use.web_fetch_requests).toBe(4)
    expect(weatherUsage.server_tool_use.tool_fetch).toBe(0)
    expect(weatherUsage.server_tool_use.tool_search).toBe(2)
  })
})
