import 'fake-indexeddb/auto'
import { openDB } from 'idb'
import { describe, expect, it } from 'vitest'
import type { Conversation, Message } from '@deepapi/types'
import { migrateLegacyIndexedDb, openIndexedRepository } from './indexeddb.js'
import { mergeSnapshot } from './merge.js'
import { createMemoryRepository } from './memory.js'
import { openSecret, sealSecret } from './secret.js'

const conversation = (id: string, rev: number, title: string): Conversation => ({
  id,
  title,
  titleSource: 'user',
  model: 'deepseek-flash',
  thinking: true,
  search: false,
  readLink: false,
  effort: 'high',
  pinned: false,
  archived: false,
  activeLeafId: null,
  createdAt: '2026-11-18T00:00:00.000Z',
  updatedAt: '2026-11-18T00:00:00.000Z',
  rev,
  deletedAt: null,
})

const message = (id: string, text: string): Message => ({
  id,
  conversationId: 'c1',
  parentId: null,
  role: 'user',
  status: 'complete',
  blocks: [{ type: 'text', text }],
  usage: null,
  errorMessage: null,
  createdAt: '2026-11-18T00:00:00.000Z',
  updatedAt: '2026-11-18T00:00:00.000Z',
  rev: 1,
  deletedAt: null,
})

describe('mergeSnapshot', () => {
  it('lets a higher conversation rev win and refuses to replace a message id', () => {
    const merged = mergeSnapshot(
      {
        conversations: [conversation('c1', 1, 'local')],
        messages: [message('m1', 'local text')],
        tombstones: [],
      },
      {
        conversations: [conversation('c1', 4, 'cloud')],
        messages: [message('m1', 'cloud text'), message('m2', 'new')],
        tombstones: [],
      },
    )
    expect(merged.conversations[0]?.title).toBe('cloud')
    expect(merged.messages.find((item) => item.id === 'm1')?.blocks).toEqual([
      { type: 'text', text: 'local text' },
    ])
    expect(merged.messages.map((item) => item.id).sort()).toEqual(['m1', 'm2'])
  })

  it('applies a tombstone without keeping the message body', () => {
    const merged = mergeSnapshot(
      {
        conversations: [conversation('c1', 2, 'kept')],
        messages: [message('m1', 'secret conversation text')],
        tombstones: [],
      },
      {
        conversations: [],
        messages: [],
        tombstones: [
          { key: 'message:m1', entity: 'message', id: 'm1', rev: 5, deletedAt: '2026-11-18T01:00:00.000Z' },
        ],
      },
    )
    expect(merged.messages).toHaveLength(0)
    expect(JSON.stringify(merged.messages)).not.toContain('secret conversation text')
    expect(merged.tombstones[0]?.id).toBe('m1')
  })
})

describe('secrets', () => {
  it('round-trips a passphrase and rejects the wrong one', async () => {
    const sealed = await sealSecret('demo-local-key', 'correct horse')
    expect(sealed.enc).toBe(true)
    expect(JSON.stringify(sealed)).not.toContain('demo-local-key')
    await expect(openSecret(sealed, 'correct horse')).resolves.toBe('demo-local-key')
    await expect(openSecret(sealed, 'nope')).rejects.toThrow(/passphrase/)
  })

  it('stores an unencrypted key only when the user skips a passphrase', async () => {
    const sealed = await sealSecret('demo-local-key', null)
    expect(sealed).toEqual({ v: 1, enc: false, value: 'demo-local-key' })
  })
})

describe('indexeddb repository', () => {
  it('does nothing when the Harbor database was never created', async () => {
    await migrateLegacyIndexedDb()
  })

  it('copies chats and the sealed key from the Harbor databases', async () => {
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase('deepapi')
      request.onsuccess = () => resolve()
      request.onerror = () => resolve()
    })
    const legacy = await openDB('harbor', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('conversations')) db.createObjectStore('conversations', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv')
      },
    })
    await legacy.put('conversations', conversation('c1', 1, 'Kept chat'))
    legacy.close()
    const legacySecrets = await openDB('harbor-secrets', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('secrets')) db.createObjectStore('secrets')
      },
    })
    await legacySecrets.put('secrets', { v: 1, enc: false, value: 'demo-local-key' }, 'api-key')
    legacySecrets.close()
    await migrateLegacyIndexedDb()
    const repo = await openIndexedRepository()
    expect((await repo.listConversations()).map((item) => item.title)).toContain('Kept chat')
    expect(await repo.readSecret()).toEqual({ v: 1, enc: false, value: 'demo-local-key' })
  })

  it('drops a legacy documentPurpose and fileExpireDays', async () => {
    const repo = await openIndexedRepository()
    const current = await repo.loadSettings()
    const db = await openDB('deepapi', 2)
    await db.put('kv', { ...current, documentPurpose: 'text_recognition', fileExpireDays: 11 }, 'settings')
    db.close()
    const loaded = await (await openIndexedRepository()).loadSettings()
    expect(loaded.deviceId).toBe(current.deviceId)
    expect('documentPurpose' in loaded).toBe(false)
    expect('fileExpireDays' in loaded).toBe(false)
    await (await openIndexedRepository()).saveSettings(loaded)
    const raw = await (await openDB('deepapi', 2)).get('kv', 'settings') as { documentPurpose?: unknown; fileExpireDays?: number }
    expect(raw.documentPurpose).toBeUndefined()
    expect(raw.fileExpireDays).toBeUndefined()
    const nested = await openDB('deepapi', 2)
    await nested.put('kv', { ...current, documentPurpose: { mode: 'text_recognition' }, fileExpireDays: 3 }, 'settings')
    nested.close()
    const odd = await (await openIndexedRepository()).loadSettings()
    expect(odd.deviceId).toBe(current.deviceId)
    expect('documentPurpose' in odd).toBe(false)
    expect('fileExpireDays' in odd).toBe(false)
  })

  it('keeps the key out of the conversation database and deletes by tombstone', async () => {
    const repo = await openIndexedRepository()
    const settings = await repo.loadSettings()
    expect(settings.safetyLevel).toBe('high')
    await repo.writeSecret(await sealSecret('demo-local-key', 'phrase'))
    await repo.saveConversation(conversation('c1', 1, 'Hello'))
    await repo.saveMessage(message('m1', 'hello'))
    await repo.deleteConversation('c1')
    expect(await repo.listConversations()).toEqual([])
    expect(await repo.listMessages('c1')).toEqual([])
    const tombstones = await repo.listTombstones()
    expect(tombstones.some((item) => item.id === 'm1')).toBe(true)
    const opened = await openSecret((await repo.readSecret())!, 'phrase')
    expect(opened).toBe('demo-local-key')
    const memory = createMemoryRepository()
    expect(await memory.listConversations()).toEqual([])
  })

  it('loads when stored settings still include fileExpireDays', async () => {
    const db = await openDB('deepapi', 2, {
      upgrade(database) {
        if (!database.objectStoreNames.contains('kv')) database.createObjectStore('kv')
      },
    })
    await db.put(
      'kv',
      {
        locale: 'en',
        safetyLevel: 'low',
        fileExpireDays: 3,
        documentPurpose: 'text_recognition',
        acknowledgedKeyRisk: true,
        deviceId: 'legacy-device',
      },
      'settings',
    )
    db.close()
    const repo = await openIndexedRepository()
    const settings = await repo.loadSettings()
    expect(settings.locale).toBe('en')
    expect(settings.safetyLevel).toBe('low')
    expect(settings.acknowledgedKeyRisk).toBe(true)
    expect(settings.deviceId).toBe('legacy-device')
    expect(settings).not.toHaveProperty('fileExpireDays')
    expect(settings).not.toHaveProperty('documentPurpose')
  })
})
