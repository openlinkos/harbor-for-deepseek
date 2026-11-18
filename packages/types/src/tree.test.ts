import { describe, expect, it } from 'vitest'
import { activePath, siblingIds } from './tree.js'
import type { Message } from './records.js'

const message = (partial: Pick<Message, 'id' | 'parentId' | 'createdAt'>): Message => ({
  rev: 1,
  updatedAt: partial.createdAt,
  deletedAt: null,
  conversationId: 'c1',
  role: partial.parentId ? 'assistant' : 'user',
  status: 'complete',
  blocks: [],
  usage: null,
  errorMessage: null,
  ...partial,
})

describe('activePath', () => {
  const messages = [
    message({ id: 'u1', parentId: null, createdAt: '2026-11-18T00:00:00.000Z' }),
    message({ id: 'a1', parentId: 'u1', createdAt: '2026-11-18T00:00:01.000Z' }),
    message({ id: 'a2', parentId: 'u1', createdAt: '2026-11-18T00:00:02.000Z' }),
    message({ id: 'u2', parentId: 'a2', createdAt: '2026-11-18T00:00:03.000Z' }),
  ]

  it('walks from the leaf to the root', () => {
    expect(activePath(messages, 'u2').map((item) => item.id)).toEqual(['u1', 'a2', 'u2'])
  })

  it('lists regenerate siblings without the other branch', () => {
    expect(siblingIds(messages, 'a1')).toEqual(['a1', 'a2'])
    expect(activePath(messages, 'a1').map((item) => item.id)).toEqual(['u1', 'a1'])
  })
})
