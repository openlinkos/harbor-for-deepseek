import { describe, expect, it } from 'vitest'
import type { Conversation, Message } from '@harbor/types'
import { exportNative, planNativeImport, readNative } from './index.js'

const conversation = (): Conversation & { messages: Message[] } => ({
  id: 'c1',
  title: '简单加法',
  titleSource: 'auto',
  model: 'deepseek-flash',
  thinking: true,
  search: false,
  readLink: false,
  effort: 'high',
  pinned: false,
  archived: false,
  activeLeafId: 'a1',
  createdAt: '2026-11-18T00:00:00.000Z',
  updatedAt: '2026-11-18T00:00:01.000Z',
  rev: 2,
  deletedAt: null,
  messages: [
    {
      id: 'u1',
      conversationId: 'c1',
      parentId: null,
      role: 'user',
      status: 'complete',
      blocks: [{ type: 'text', text: '3加5等于几？' }],
      usage: null,
      errorMessage: null,
      createdAt: '2026-11-18T00:00:00.000Z',
      updatedAt: '2026-11-18T00:00:00.000Z',
      rev: 1,
      deletedAt: null,
    },
    {
      id: 'a1',
      conversationId: 'c1',
      parentId: 'u1',
      role: 'assistant',
      status: 'complete',
      blocks: [
        { type: 'thinking', thinking: '3+5=8', signature: 'sig-redacted' },
        { type: 'text', text: '8' },
      ],
      usage: {
        input_tokens: 41,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        output_tokens: 33,
        service_tier: 'standard',
        output_tokens_details: { thinking_tokens: 31 },
      },
      errorMessage: null,
      createdAt: '2026-11-18T00:00:01.000Z',
      updatedAt: '2026-11-18T00:00:01.000Z',
      rev: 1,
      deletedAt: null,
    },
  ],
})

describe('native archive', () => {
  it('round-trips blocks and usage and never keeps a key field', () => {
    const archive = exportNative([conversation()], '2026-11-18T02:00:00.000Z')
    const raw = { ...archive, apiKey: 'demo-local-key' }
    const read = readNative(raw)
    expect(JSON.stringify(read)).not.toContain('demo-local-key')
    expect(read.conversations[0]?.messages[1]?.blocks[0]).toMatchObject({ signature: 'sig-redacted' })
    expect(read.conversations[0]?.messages[1]?.usage?.output_tokens).toBe(33)
  })

  it('merges by conversation id and can import a copy', () => {
    const archive = readNative(exportNative([conversation()], '2026-11-18T02:00:00.000Z'))
    const merged = planNativeImport(new Set(['c1']), archive, 'merge')
    expect(merged.added).toBe(0)
    expect(merged.skipped).toBe(1)
    let n = 0
    const copied = planNativeImport(new Set(['c1']), archive, 'copy', () => `new-${n++}`)
    expect(copied.added).toBe(1)
    expect(copied.conversations[0]?.id).toBe('new-0')
    expect(copied.conversations[0]?.messages[1]?.parentId).toBe('new-1')
    expect(copied.conversations[0]?.activeLeafId).toBe('new-2')
  })
})
