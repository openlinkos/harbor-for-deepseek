import type { Message } from './records.js'

export const activePath = (messages: Message[], leafId: string | null): Message[] => {
  if (!leafId) {
    return []
  }
  const byId = new Map(messages.map((message) => [message.id, message]))
  const path: Message[] = []
  const seen = new Set<string>()
  let cursor: Message | undefined = byId.get(leafId)
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id)
    path.push(cursor)
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined
  }
  path.reverse()
  return path
}

export const childIds = (messages: Message[], parentId: string | null): string[] =>
  messages
    .filter((message) => message.parentId === parentId && !message.deletedAt)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    .map((message) => message.id)

/** Sibling messages that share a parent, in creation order. */
export const siblingIds = (messages: Message[], messageId: string): string[] => {
  const message = messages.find((item) => item.id === messageId)
  if (!message) {
    return []
  }
  return childIds(messages, message.parentId)
}
