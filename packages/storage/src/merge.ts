import type { Conversation, Message, Tombstone } from '@deepapi/types'

export type Snapshot = {
  conversations: Conversation[]
  messages: Message[]
  tombstones: Tombstone[]
}

const byId = <T extends { id: string }>(items: T[]) => new Map(items.map((item) => [item.id, item]))

const tombstoneWins = (existing: { rev: number } | undefined, tombstone: Tombstone) =>
  !existing || tombstone.rev >= existing.rev

/**
 * Sync merge used later by a self-hosted backend.
 * Conversations: the larger rev wins.
 * Messages: append-only. An existing id is never replaced.
 * Tombstones remove local rows and are not resurrected.
 */
export const mergeSnapshot = (local: Snapshot, incoming: Snapshot): Snapshot => {
  const tombstones = new Map(local.tombstones.map((item) => [item.key, item]))
  for (const tombstone of incoming.tombstones) {
    const current = tombstones.get(tombstone.key)
    if (!current || tombstone.rev >= current.rev) {
      tombstones.set(tombstone.key, tombstone)
    }
  }
  const conversations = byId(local.conversations)
  for (const conversation of incoming.conversations) {
    const tombstone = tombstones.get(`conversation:${conversation.id}`)
    if (tombstone && tombstoneWins(conversation, tombstone)) {
      conversations.delete(conversation.id)
      continue
    }
    const current = conversations.get(conversation.id)
    if (!current || conversation.rev > current.rev) {
      conversations.set(conversation.id, conversation)
    }
  }
  for (const [id, conversation] of conversations) {
    const tombstone = tombstones.get(`conversation:${id}`)
    if (tombstone && tombstoneWins(conversation, tombstone)) {
      conversations.delete(id)
    }
  }
  const messages = byId(local.messages)
  for (const message of incoming.messages) {
    const tombstone = tombstones.get(`message:${message.id}`)
    if (tombstone && tombstoneWins(message, tombstone)) {
      continue
    }
    if (!messages.has(message.id)) {
      messages.set(message.id, message)
    }
  }
  for (const [id, message] of messages) {
    const tombstone = tombstones.get(`message:${id}`)
    if (tombstone && tombstoneWins(message, tombstone)) {
      messages.delete(id)
    }
  }
  return {
    conversations: [...conversations.values()],
    messages: [...messages.values()],
    tombstones: [...tombstones.values()],
  }
}
