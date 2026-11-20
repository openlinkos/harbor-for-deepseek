import { describe, expect, it } from 'vitest'
import { buildRequest, messageUsedWebTool, toApiMessages } from './request.js'

const user = (id: string, text: string) => ({
  id,
  conversationId: 'c',
  parentId: null,
  role: 'user' as const,
  status: 'complete' as const,
  blocks: [{ type: 'text' as const, text }],
  usage: null,
  errorMessage: null,
  createdAt: '2026-11-18T00:00:00.000Z',
  updatedAt: '2026-11-18T00:00:00.000Z',
  rev: 1,
  deletedAt: null,
})

describe('harborSystemPrompt', () => {
  it('puts Shanghai time in the prompt and switches to Chinese with the UI', () => {
    const now = new Date('2026-11-18T01:30:00.000Z')
    const english = buildRequest({
      model: 'deepseek-flash',
      thinking: true,
      search: true,
      readLink: false,
      effort: 'high',
      safetyLevel: 'high',
      requestTitle: false,
      messages: [user('u', '今天上海天气怎么样')],
      locale: 'en',
      timeZone: 'Asia/Shanghai',
      now,
    })
    expect(english.system).toBeUndefined()
    const chinese = buildRequest({
      model: 'deepseek-flash',
      thinking: true,
      search: true,
      readLink: false,
      effort: 'high',
      safetyLevel: 'high',
      requestTitle: false,
      messages: [user('u', '今天上海天气怎么样')],
      locale: 'zh',
      timeZone: 'Asia/Shanghai',
      now,
    })
    expect(chinese.system).toBeUndefined()
  })
})

describe('continuation', () => {
  const assistant = {
    ...user('a', ''),
    role: 'assistant' as const,
    parentId: 'u',
    status: 'aborted' as const,
    blocks: [
      { type: 'thinking' as const, thinking: '先想', signature: 'sig' },
      { type: 'text' as const, text: '原文甲' },
    ],
  }
  it('ends the request with the partial assistant message and can omit thinking', () => {
    const kept = toApiMessages([user('u', '写一首诗'), assistant])
    expect(kept.at(-1)?.role).toBe('assistant')
    expect(JSON.stringify(kept.at(-1))).toContain('原文甲')
    expect(JSON.stringify(kept.at(-1))).toContain('先想')
    const dropped = toApiMessages([user('u', '写一首诗'), assistant], { dropThinking: true })
    expect(JSON.stringify(dropped.at(-1))).toContain('原文甲')
    expect(JSON.stringify(dropped.at(-1))).not.toContain('先想')
  })
  it('treats web search and page reads as not continuable', () => {
    expect(messageUsedWebTool(assistant)).toBe(false)
    expect(messageUsedWebTool({
      blocks: [{ type: 'server_tool_use', id: 's', name: 'deepseek_web_search', input: { action: 'search', queries: ['q'] } }],
    })).toBe(true)
  })
})
