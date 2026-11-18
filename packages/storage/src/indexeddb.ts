import { openDB } from 'idb'
import { defaultSettings } from '@harbor/types'
import type { Conversation, Message, SealedSecret, Settings, Tombstone } from '@harbor/types'
import type { Repository } from './memory.js'

const DATA = 'harbor'
const SECRETS = 'harbor-secrets'

export const openIndexedRepository = async (): Promise<Repository> => {
  const data = await openDB(DATA, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('conversations')) {
        db.createObjectStore('conversations', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('messages')) {
        const messages = db.createObjectStore('messages', { keyPath: 'id' })
        messages.createIndex('byConversation', 'conversationId')
      }
      if (!db.objectStoreNames.contains('tombstones')) {
        db.createObjectStore('tombstones', { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains('kv')) {
        db.createObjectStore('kv')
      }
    },
  })
  const secrets = await openDB(SECRETS, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('secrets')) {
        db.createObjectStore('secrets')
      }
    },
  })

  return {
    async loadSettings() {
      const stored = (await data.get('kv', 'settings')) as Settings | undefined
      if (stored) {
        return { ...defaultSettings(stored.deviceId || crypto.randomUUID()), ...stored, safetyLevel: stored.safetyLevel || 'high' }
      }
      const created = defaultSettings(crypto.randomUUID())
      await data.put('kv', created, 'settings')
      return created
    },
    async saveSettings(settings) {
      await data.put('kv', settings, 'settings')
    },
    async listConversations() {
      const all = (await data.getAll('conversations')) as Conversation[]
      return all.filter((conversation) => !conversation.deletedAt)
    },
    async saveConversation(conversation) {
      await data.put('conversations', conversation)
    },
    async listMessages(conversationId) {
      const all = (await data.getAllFromIndex('messages', 'byConversation', conversationId)) as Message[]
      return all.filter((message) => !message.deletedAt)
    },
    async saveMessage(message) {
      await data.put('messages', message)
    },
    async deleteConversation(id) {
      const tx = data.transaction(['conversations', 'messages', 'tombstones'], 'readwrite')
      const now = new Date().toISOString()
      let rev = Date.now()
      await tx.objectStore('conversations').delete(id)
      await tx.objectStore('tombstones').put({
        key: `conversation:${id}`,
        entity: 'conversation',
        id,
        rev,
        deletedAt: now,
      } satisfies Tombstone)
      const index = tx.objectStore('messages').index('byConversation')
      let cursor = await index.openCursor(id)
      while (cursor) {
        rev += 1
        await tx.objectStore('tombstones').put({
          key: `message:${String(cursor.value.id)}`,
          entity: 'message',
          id: String(cursor.value.id),
          rev,
          deletedAt: now,
        } satisfies Tombstone)
        cursor.delete()
        cursor = await cursor.continue()
      }
      await tx.done
    },
    async listTombstones() {
      return (await data.getAll('tombstones')) as Tombstone[]
    },
    async readSecret() {
      const value = await secrets.get('secrets', 'api-key')
      return (value as SealedSecret | undefined) ?? null
    },
    async writeSecret(secret) {
      if (!secret) {
        await secrets.delete('secrets', 'api-key')
        return
      }
      await secrets.put('secrets', secret, 'api-key')
    },
  }
}
