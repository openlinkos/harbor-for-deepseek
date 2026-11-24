import { openDB } from 'idb'
import { defaultSettings, legacyVoiceCandidates, resolveTtsVoice } from '@deepapi/types'
import type { Conversation, Message, SealedSecret, Settings, Tombstone } from '@deepapi/types'
import type { Repository } from './memory.js'

const readLegacyVoices = (): unknown[] => {
  if (typeof localStorage === 'undefined') return []
  return legacyVoiceCandidates({
    getItem: (key) => {
      try {
        return localStorage.getItem(key)
      } catch {
        return null
      }
    },
  })
}

const DATA = 'deepapi'
const SECRETS = 'deepapi-secrets'
const LEGACY_DATA = 'harbor'
const LEGACY_SECRETS = 'harbor-secrets'
const DB_VERSION = 2

const databaseNames = async () => {
  if (typeof indexedDB.databases !== 'function') return [] as string[]
  const rows = await indexedDB.databases()
  return rows.map((row) => row.name).filter((name): name is string => Boolean(name))
}

const copyDatabase = async (from: string, to: string, setup: (db: import('idb').IDBPDatabase) => void) => {
  const names = await databaseNames()
  if (!names.includes(from) || names.includes(to)) return
  const source = await openDB(from)
  const target = await openDB(to, DB_VERSION, { upgrade: setup })
  const stores = [...source.objectStoreNames]
  for (const name of stores) {
    if (!target.objectStoreNames.contains(name)) continue
    const tx = source.transaction(name)
    const inline = Boolean(tx.store.keyPath)
    const rows: Array<{ value: unknown; key: IDBValidKey }> = []
    let cursor = await tx.store.openCursor()
    while (cursor) {
      rows.push({ value: cursor.value, key: cursor.key })
      cursor = await cursor.continue()
    }
    await tx.done
    for (const row of rows) {
      if (inline) await target.put(name, row.value)
      else await target.put(name, row.value, row.key)
    }
  }
  source.close()
  target.close()
}

const upgradeData = (db: import('idb').IDBPDatabase) => {
  if (!db.objectStoreNames.contains('conversations')) db.createObjectStore('conversations', { keyPath: 'id' })
  if (!db.objectStoreNames.contains('messages')) {
    const messages = db.createObjectStore('messages', { keyPath: 'id' })
    messages.createIndex('byConversation', 'conversationId')
  }
  if (!db.objectStoreNames.contains('tombstones')) db.createObjectStore('tombstones', { keyPath: 'key' })
  if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv')
}

const upgradeSecrets = (db: import('idb').IDBPDatabase) => {
  if (!db.objectStoreNames.contains('secrets')) db.createObjectStore('secrets')
}

/** Copy chats and the sealed key from the Harbor databases when the DeepAPI ones are absent. */
export const migrateLegacyIndexedDb = async () => {
  await copyDatabase(LEGACY_DATA, DATA, upgradeData)
  await copyDatabase(LEGACY_SECRETS, SECRETS, upgradeSecrets)
}

export const openIndexedRepository = async (): Promise<Repository> => {
  await migrateLegacyIndexedDb()
  const data = await openDB(DATA, DB_VERSION, {
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
  const secrets = await openDB(SECRETS, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('secrets')) {
        db.createObjectStore('secrets')
      }
    },
  })

  return {
    async loadSettings() {
      const stored = (await data.get('kv', 'settings')) as
        | (Omit<Partial<Settings>, 'ttsVoice'> & {
            documentPurpose?: unknown
            fileExpireDays?: unknown
            deviceId?: string
            ttsVoice?: unknown
          })
        | undefined
      const legacy = readLegacyVoices()
      if (stored && typeof stored === 'object') {
        const { documentPurpose: _legacyPurpose, fileExpireDays: _legacyFileExpireDays, ttsVoice: rawVoice, ...rest } = stored
        void _legacyPurpose
        void _legacyFileExpireDays
        const hadVoice = Object.prototype.hasOwnProperty.call(stored, 'ttsVoice')
        return {
          ...defaultSettings(stored.deviceId || crypto.randomUUID()),
          ...rest,
          safetyLevel: stored.safetyLevel || 'high',
          ttsVoice: resolveTtsVoice(rawVoice, legacy, hadVoice),
        }
      }
      const created = {
        ...defaultSettings(crypto.randomUUID()),
        ttsVoice: resolveTtsVoice(undefined, legacy, false),
      }
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
