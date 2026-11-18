import { describe, expect, it } from 'vitest'
import type { Conversation, Message } from '@harbor/types'
import { exportV3, importV3 } from './index.js'

const sample = (): Conversation & { messages: Message[] } => ({
  id: 'c1',
  title: '冰岛人口',
  titleSource: 'auto',
  model: 'deepseek-flash',
  thinking: false,
  search: true,
  readLink: true,
  effort: 'high',
  pinned: false,
  archived: false,
  activeLeafId: 'a1',
  createdAt: '2026-11-18T01:31:00.000Z',
  updatedAt: '2026-11-18T01:31:02.000Z',
  rev: 1,
  deletedAt: null,
  messages: [
    {
      id: 'u1',
      conversationId: 'c1',
      parentId: null,
      role: 'user',
      status: 'complete',
      blocks: [{ type: 'text', text: '冰岛现在大约多少人口？' }],
      usage: null,
      errorMessage: null,
      createdAt: '2026-11-18T01:31:00.000Z',
      updatedAt: '2026-11-18T01:31:00.000Z',
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
        {
          type: 'server_tool_use',
          id: 'srvtoolu_s_00_redacted',
          name: 'deepseek_web_search',
          input: { action: 'search', queries: ['Iceland population 2026'] },
          kind: 'search',
        },
        {
          type: 'web_search_tool_result',
          tool_use_id: 'srvtoolu_s_00_redacted',
          kind: 'search',
          content: [
            {
              type: 'web_search_result',
              title: 'Iceland',
              url: 'https://example.com/iceland',
              snippet: 'About 394,000.',
              site_name: 'Example',
              site_icon: null,
            },
          ],
        },
        { type: 'text', text: 'About 394,000.' },
      ],
      usage: null,
      errorMessage: null,
      createdAt: '2026-11-18T01:31:02.000Z',
      updatedAt: '2026-11-18T01:31:02.000Z',
      rev: 1,
      deletedAt: null,
    },
  ],
})

describe('v3 zip', () => {
  it('round-trips a session and merges without replacing an existing id', () => {
    const imported = importV3(exportV3([sample()]))
    expect(imported.conversations).toHaveLength(1)
    const conversation = imported.conversations[0]
    expect(conversation?.id).toBe('v3:c1')
    expect(conversation?.messages[0]?.blocks[0]).toMatchObject({ type: 'text' })
    expect(conversation?.messages[1]?.blocks.some((block) => block.type === 'web_search_tool_result')).toBe(true)
    expect(conversation?.id.startsWith('v3:')).toBe(true)
    const again = importV3(exportV3([sample()]))
    expect(again.conversations[0]?.id).toBe(conversation?.id)
  })
})
