import { defaultSettings } from '@harbor/types'
import type { Conversation, Message, SealedSecret, Settings, Tombstone } from '@harbor/types'

export type Repository = {
  loadSettings(): Promise<Settings>
  saveSettings(settings: Settings): Promise<void>
  listConversations(): Promise<Conversation[]>
  saveConversation(conversation: Conversation): Promise<void>
  listMessages(conversationId: string): Promise<Message[]>
  saveMessage(message: Message): Promise<void>
  deleteConversation(id: string): Promise<void>
  listTombstones(): Promise<Tombstone[]>
  readSecret(): Promise<SealedSecret | null>
  writeSecret(secret: SealedSecret | null): Promise<void>
}

export const createMemoryRepository = (deviceId = 'device-test'): Repository => {
  const conversations = new Map<string, Conversation>()
  const messages = new Map<string, Message>()
  const tombstones: Tombstone[] = []
  let settings = defaultSettings(deviceId)
  let secret: SealedSecret | null = null
  let rev = 1
  const nextRev = () => {
    rev += 1
    return rev
  }

  return {
    async loadSettings() {
      return settings
    },
    async saveSettings(next) {
      settings = next
    },
    async listConversations() {
      return [...conversations.values()].filter((conversation) => !conversation.deletedAt)
    },
    async saveConversation(conversation) {
      conversations.set(conversation.id, conversation)
    },
    async listMessages(conversationId) {
      return [...messages.values()].filter(
        (message) => message.conversationId === conversationId && !message.deletedAt,
      )
    },
    async saveMessage(message) {
      messages.set(message.id, message)
    },
    async deleteConversation(id) {
      const conversation = conversations.get(id)
      const now = new Date().toISOString()
      if (conversation) {
        conversations.delete(id)
        tombstones.push({
          key: `conversation:${id}`,
          entity: 'conversation',
          id,
          rev: nextRev(),
          deletedAt: now,
        })
      }
      for (const message of [...messages.values()]) {
        if (message.conversationId === id) {
          messages.delete(message.id)
          tombstones.push({
            key: `message:${message.id}`,
            entity: 'message',
            id: message.id,
            rev: nextRev(),
            deletedAt: now,
          })
        }
      }
    },
    async listTombstones() {
      return tombstones
    },
    async readSecret() {
      return secret
    },
    async writeSecret(next) {
      secret = next
    },
  }
}
