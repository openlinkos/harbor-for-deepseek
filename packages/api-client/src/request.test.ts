import { describe, expect, it } from 'vitest'
import { buildRequest } from './request.js'

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
