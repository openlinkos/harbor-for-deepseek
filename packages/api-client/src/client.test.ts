import { eventsToSse, fileObjectFixture, thinkingEvents } from '@deepapi/sse'
import type { Message } from '@deepapi/types'
import { describe, expect, it } from 'vitest'
import { createClient } from './client.js'
import { buildRequest, clampExpireSeconds, purposeForFile, toApiMessages } from './request.js'

const user = (id: string, text: string): Message => ({
  id,
  conversationId: 'c',
  parentId: null,
  role: 'user',
  status: 'complete',
  blocks: [{ type: 'text', text }],
  usage: null,
  errorMessage: null,
  createdAt: '2026-11-18T00:00:00.000Z',
  updatedAt: '2026-11-18T00:00:00.000Z',
  rev: 1,
  deletedAt: null,
})

describe('buildRequest', () => {
  it('turns safety review on, omits tools for the text-only model, and asks for a title', () => {
    const body = buildRequest({
      model: 'deepseek-v4-pro',
      thinking: true,
      search: true,
      readLink: true,
      effort: 'high',
      safetyLevel: 'high',
      requestTitle: true,
      messages: [user('u', '3+5')],
    })
    expect(body.safety_check).toEqual({ level: 'high' })
    expect(body.tools).toBeUndefined()
    expect(body.title).toEqual({ enabled: true })
    expect(body.thinking).toEqual({ type: 'enabled' })
    expect(body.stream).toBe(true)
  })

  it('declares search and read-link only when asked, on flash', () => {
    const body = buildRequest({
      model: 'deepseek-flash',
      thinking: false,
      search: true,
      readLink: true,
      effort: 'low',
      safetyLevel: 'high',
      requestTitle: false,
      messages: [user('u', 'https://example.com')],
    })
    expect(body.tools).toEqual([
      { type: 'deepseek_web_search', name: 'deepseek_web_search' },
      { type: 'deepseek_read_url', name: 'deepseek_read_url' },
    ])
    expect(body.thinking.type).toBe('disabled')
    expect(body.title).toBeUndefined()
  })

  it('keeps read-link signatures and drops refusals', () => {
    const assistant: Message = {
      ...user('a', ''),
      parentId: 'u',
      role: 'assistant',
      blocks: [
        {
          type: 'web_fetch_tool_result',
          tool_use_id: 'srvtoolu_rl_00_redacted',
          kind: 'read_link',
          signature: 'signature-redacted',
          content: { type: 'web_fetch_result', url: 'https://example.com' },
        },
        { type: 'text', text: 'A reserved domain.', citations: [] },
      ],
    }
    const refused: Message = { ...assistant, id: 'r', status: 'refused', blocks: [{ type: 'text', text: 'nope' }] }
    const replay = toApiMessages([user('u', 'read https://example.com'), assistant, refused])
    expect(replay).toHaveLength(2)
    const content = replay[1]?.content
    expect(Array.isArray(content)).toBe(true)
    if (Array.isArray(content)) {
      expect(content[0]).toMatchObject({ signature: 'signature-redacted' })
      expect(content[1]).toEqual({ type: 'text', text: 'A reserved domain.' })
    }
  })
})

describe('createClient', () => {
  it('calls the API with credentials omitted and reads the final stream', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = []
    const sse = eventsToSse(thinkingEvents())
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init: init ?? {} })
      const url = String(input)
      if (url.endsWith('/user/balance')) {
        return new Response(
          JSON.stringify({
            is_available: true,
            balance_infos: [
              { currency: 'CNY', total_balance: '317.22', granted_balance: '0.00', topped_up_balance: '317.22' },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      if (url.endsWith('/files')) {
        return new Response(JSON.stringify(fileObjectFixture), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response(sse, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    }
    const client = createClient({ fetch: fetchImpl })
    const balance = await client.getBalance('demo-local-key')
    expect(balance.balance_infos[0]?.total_balance).toBe('317.22')
    const body = buildRequest({
      model: 'deepseek-flash',
      thinking: true,
      search: false,
      readLink: false,
      effort: 'high',
      safetyLevel: 'high',
      requestTitle: true,
      messages: [user('u', '3加5等于几？')],
    })
    const events = []
    for await (const event of client.streamMessage('demo-local-key', body, new AbortController().signal)) {
      events.push(event.type)
    }
    expect(events).toContain('message_delta')
    expect(events.at(-1)).toBe('message_stop')
    for (const call of calls) {
      expect(call.init.credentials).toBe('omit')
    }
    const post = calls.find((call) => call.url.endsWith('/messages'))
    expect(post?.init.headers).toMatchObject({ 'x-api-key': 'demo-local-key' })
    const sent = JSON.parse(String(post?.init.body)) as { safety_check: { level: string } }
    expect(sent.safety_check.level).toBe('high')
  })

  it('sends file expiry as form fields and the files beta header when a file is attached', async () => {
    let form: FormData | undefined
    let messageHeaders: HeadersInit | undefined
    const fetchImpl: typeof fetch = async (input, init) => {
      if (String(input).endsWith('/files')) {
        form = init?.body as FormData
        return new Response(JSON.stringify(fileObjectFixture), { status: 200 })
      }
      messageHeaders = init?.headers
      return new Response(eventsToSse(thinkingEvents()), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    }
    const client = createClient({ fetch: fetchImpl })
    const uploaded = await client.uploadFile('demo-local-key', new Blob(['%PDF']), 'probe.pdf', 'text_recognition', 3600)
    expect(uploaded.expires_at).toBe(1794940246)
    expect(form?.get('purpose')).toBe('text_recognition')
    expect(form?.get('expires_after[anchor]')).toBe('created_at')
    expect(form?.get('expires_after[seconds]')).toBe('3600')
    expect(form?.get('file')).toBeTruthy()
    const attached: Message = {
      ...user('u', 'what is the answer'),
      blocks: [
        { type: 'text', text: 'what is the answer' },
        {
          type: 'file_ref',
          fileId: uploaded.id,
          filename: 'probe.pdf',
          media: 'document',
          purpose: 'text_recognition',
          bytes: 588,
          expiresAt: uploaded.expires_at,
        },
      ],
    }
    const body = buildRequest({
      model: 'deepseek-flash',
      thinking: false,
      search: false,
      readLink: false,
      effort: 'high',
      safetyLevel: 'high',
      requestTitle: false,
      messages: [attached],
    })
    for await (const _event of client.streamMessage('demo-local-key', body, new AbortController().signal)) {
      // drain
    }
    expect(messageHeaders).toMatchObject({ 'anthropic-beta': 'files-api-2025-04-14' })
  })

  it('maps purposes and clamps expiry into the documented window', () => {
    expect(purposeForFile('a.png', 'image/png').media).toBe('image')
    expect(purposeForFile('notes.txt', 'text/plain').purpose).toBe('user_data')
    expect(clampExpireSeconds(7)).toBe(7 * 24 * 3600)
    expect(clampExpireSeconds(0)).toBe(3600)
    expect(clampExpireSeconds(90)).toBe(2_592_000)
  })

  it('always parses pdf and office files with rich layout', () => {
    expect(purposeForFile('probe.pdf', 'application/pdf').purpose).toBe('rich_layout_recognition')
    expect(purposeForFile('memo.doc', 'application/msword').purpose).toBe('rich_layout_recognition')
    expect(purposeForFile('memo.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document').purpose).toBe('rich_layout_recognition')
    expect(purposeForFile('slides.ppt', 'application/vnd.ms-powerpoint').purpose).toBe('rich_layout_recognition')
    expect(purposeForFile('slides.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation').purpose).toBe('rich_layout_recognition')
    expect(purposeForFile('sheet.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').purpose).toBe('rich_layout_recognition')
    expect(purposeForFile('photo.jpg', '').purpose).toBe('user_data')
    expect(purposeForFile('notes.md', '').purpose).toBe('user_data')
  })
})
