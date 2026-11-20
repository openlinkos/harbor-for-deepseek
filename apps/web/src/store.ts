import { buildRequest, createClient, purposeForFile } from '@deepapi/api-client'
import { exportNative, planNativeImport, readNative } from '@deepapi/archive-native'
import { exportV3, importV3 } from '@deepapi/archive-v3'
import { estimateCost, sumUsage } from '@deepapi/pricing'
import { createDraft, reduceEvent } from '@deepapi/sse'
import { createThinkingClock } from './thinkingClock.js'
import { openIndexedRepository, openSecret, sealSecret } from '@deepapi/storage'
import { isNativeApp, shareDownload } from './native.js'
import { readRemoteSession, writeRemoteSession } from './nativeSession.js'
import { api, clearRemoteSession, hostedPage, readRun, setCsrf, setRemoteSession, type ServerUser } from './remote.js'
import { validateServerUrl } from './serverUrl.js'
import type { Repository } from '@deepapi/storage'
import {
  activePath,
  childIds,
  DEFAULT_CHAT_MODEL,
  DEFAULT_EFFORT,
  defaultSettings,
  type Balance,
  type Conversation,
  type Message,
  type Settings,
  type Usage,
} from '@deepapi/types'
import { create } from 'zustand'

const client = createClient()
let repo: Repository | null = null
let abort: AbortController | null = null
let serverAbort: AbortController | null = null
let serverRunId: string | null = null
let persistTimer = 0

export type ServerQuota = {
  tokenUsed: number
  tokenQuota: number
  searchUsed: number
  searchQuota: number
  pageUsed: number
  pageQuota: number
}

export type DraftFile = {
  localId: string
  filename: string
  media: 'image' | 'document'
  purpose: Message extends never ? never : 'user_data' | 'text_recognition' | 'rich_layout_recognition'
  bytes: number
  fileId?: string
  expiresAt: number | null
  busy: boolean
  error?: string
}

type Prefs = Pick<Conversation, 'thinking' | 'search' | 'readLink'>

const TOGGLE_KEY = 'deepapi-toggles'

type Toggles = Pick<Prefs, 'thinking' | 'search'>

const defaultPrefs = (): Prefs => ({
  thinking: true,
  search: true,
  readLink: false,
})

const withFixedModel = (prefs: Prefs) => ({
  ...prefs,
  model: DEFAULT_CHAT_MODEL,
  effort: DEFAULT_EFFORT,
})

const readToggles = (): Toggles => {
  const fallback: Toggles = { thinking: true, search: true }
  try {
    const raw = localStorage.getItem(TOGGLE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<Toggles>
    return {
      thinking: typeof parsed.thinking === 'boolean' ? parsed.thinking : fallback.thinking,
      search: typeof parsed.search === 'boolean' ? parsed.search : fallback.search,
    }
  } catch {
    return fallback
  }
}

const writeToggles = (toggles: Toggles) => {
  try {
    localStorage.setItem(TOGGLE_KEY, JSON.stringify({ thinking: toggles.thinking, search: toggles.search }))
  } catch {
    // Storage can be unavailable in private mode. The in-memory prefs still apply for this tab.
  }
}

const withToggles = (base: Prefs): Prefs => ({ ...base, ...readToggles() })

const prefsFor = (conversation: Conversation | undefined, fallback: Prefs): Prefs =>
  withToggles(
    conversation
      ? {
          thinking: conversation.thinking,
          search: conversation.search,
          readLink: conversation.readLink,
        }
      : fallback,
  )

const nowIso = () => new Date().toISOString()
const nid = () => crypto.randomUUID()

const blockText = (block: Message['blocks'][number]) => {
  if (block.type === 'text') return block.text
  if (block.type === 'thinking') return block.thinking
  return ''
}

const messageText = (message: Message) => message.blocks.map(blockText).filter(Boolean).join('\n')

const blankConversation = (prefs: Prefs): Conversation => {
  const now = nowIso()
  return {
    id: nid(),
    title: '',
    titleSource: 'default',
    ...withFixedModel(prefs),
    pinned: false,
    archived: false,
    activeLeafId: null,
    createdAt: now,
    updatedAt: now,
    rev: 1,
    deletedAt: null,
  }
}

export type HarborState = {
  booted: boolean
  settings: Settings
  key: string | null
  locked: boolean
  conversations: Conversation[]
  activeId: string | null
  messages: Message[]
  totals: Usage
  streaming: boolean
  balance: Balance | null
  balanceError: boolean
  settingsOpen: boolean
  sidebarOpen: boolean
  notice: string | null
  prefs: Prefs
  drafts: DraftFile[]
  boot: () => Promise<void>
  saveKey: (key: string, passphrase: string, acknowledged: boolean) => Promise<void>
  unlock: (passphrase: string) => Promise<boolean>
  clearKey: () => Promise<void>
  setLocale: (locale: Settings['locale']) => Promise<void>
  patchSettings: (patch: Partial<Settings>) => Promise<void>
  setPrefs: (patch: Partial<Prefs>) => Promise<void>
  newChat: () => Promise<void>
  openChat: (id: string) => Promise<void>
  /** Message text for every chat, used by the history search dialog. */
  loadSearchCorpus: () => Promise<Record<string, string>>
  rename: (id: string, title: string) => Promise<void>
  pin: (id: string) => Promise<void>
  pinMany: (ids: string[]) => Promise<void>
  removeChat: (id: string) => Promise<void>
  selectSibling: (messageId: string, siblingId: string) => Promise<void>
  send: (text: string) => Promise<void>
  regenerate: (assistantId: string) => Promise<void>
  editUser: (messageId: string, text: string) => Promise<void>
  stop: () => void
  refreshBalance: () => Promise<void>
  addFiles: (files: File[]) => Promise<void>
  removeDraft: (localId: string) => void
  exportJson: () => Promise<void>
  exportZip: () => Promise<void>
  importJson: (file: File, asCopy: boolean) => Promise<void>
  importZip: (file: File, asCopy: boolean) => Promise<void>
  setSettingsOpen: (open: boolean) => void
  setSidebarOpen: (open: boolean) => void
  dismissNotice: () => void
  hosted: boolean
  setupRequired: boolean
  serverUser: ServerUser | null
  serverMode: boolean
  quota: ServerQuota | null
  showLogin: boolean
  showAdmin: boolean
  setupAdmin: (username: string, password: string) => Promise<void>
  loginServer: (username: string, password: string) => Promise<void>
  registerServer: (code: string, username: string, password: string) => Promise<void>
  logoutServer: () => Promise<void>
  enterServerMode: () => Promise<void>
  enterLocalMode: () => Promise<void>
  syncServer: () => Promise<void>
  copyLocalToServer: () => Promise<void>
  openLogin: () => void
  openAdmin: (open: boolean) => void
  native: boolean
  allowLanHttp: boolean
  serverBase: string
  setAllowLanHttp: (value: boolean) => void
  connectRemote: (base: string, username: string, password: string) => Promise<void>
  registerRemote: (base: string, code: string, username: string, password: string) => Promise<void>
  dismissOverlay: () => boolean
}

const repository = async () => {
  repo ??= await openIndexedRepository()
  return repo
}

const leafUnder = (messages: Message[], startId: string): string => {
  let current = startId
  for (;;) {
    const children = childIds(messages, current)
    const next = children.at(-1)
    if (!next) {
      return current
    }
    current = next
  }
}

const download = (filename: string, blob: Blob) => {
  if (isNativeApp()) {
    void shareDownload(filename, blob)
    return
  }
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const stamp = <T extends { rev: number; updatedAt: string }>(record: T): T => ({
  ...record,
  rev: record.rev + 1,
  updatedAt: nowIso(),
})

export const useHarbor = create<HarborState>((set, get) => ({
  booted: false,
  settings: defaultSettings('pending'),
  key: null,
  locked: false,
  conversations: [],
  activeId: null,
  messages: [],
  totals: sumUsage([]),
  streaming: false,
  balance: null,
  balanceError: false,
  settingsOpen: false,
  sidebarOpen: false,
  notice: null,
  prefs: withToggles(defaultPrefs()),
  drafts: [],
  hosted: false,
  setupRequired: false,
  serverUser: null,
  serverMode: false,
  quota: null,
  showLogin: false,
  showAdmin: false,
  native: false,
  allowLanHttp: false,
  serverBase: '',

  async boot() {
    const previousKey = get().key
    const store = await repository()
    const settings = await store.loadSettings()
    const secret = await store.readSecret()
    const conversations = (await store.listConversations()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    const usages: Array<Usage | null> = []
    let messages: Message[] = []
    const activeId = conversations[0]?.id ?? null
    for (const conversation of conversations) {
      const rows = await store.listMessages(conversation.id)
      for (const row of rows) {
        usages.push(row.usage)
      }
      if (conversation.id === activeId) {
        messages = rows
      }
    }
    let key: string | null = previousKey
    let locked = false
    if (secret?.enc) {
      locked = !previousKey
      key = previousKey
    } else if (secret && !secret.enc) {
      key = secret.value
    } else {
      key = null
    }
    document.documentElement.lang = settings.locale === 'en' ? 'en' : 'zh'
    set({
      booted: true,
      settings,
      key,
      locked,
      conversations,
      activeId,
      messages,
      totals: sumUsage(usages),
      prefs: prefsFor(conversations[0], defaultPrefs()),
    })
    if (key) {
      void get().refreshBalance()
    }
    if (hostedPage()) {
      await probeHost(set, get)
    } else if (get().native || isNativeApp()) {
      set({ native: true })
      const saved = await readRemoteSession()
      if (saved?.token && saved.base) {
        setRemoteSession(saved.base, saved.token)
        set({ serverBase: saved.base, serverUser: { id: '', username: saved.username, role: 'member' } })
        try {
          const me = await api<{ user: ServerUser }>('/api/me')
          set({ serverUser: me.user, serverMode: sessionStorage.getItem('deepapi-mode') !== 'local' })
          if (sessionStorage.getItem('deepapi-mode') !== 'local') {
            await loadServerChats(set)
          }
        } catch {
          clearRemoteSession()
          await writeRemoteSession(null)
        }
      }
    }
  },

  async saveKey(key, passphrase, acknowledged) {
    if (!acknowledged || !key.trim()) {
      return
    }
    const store = await repository()
    const settings = { ...get().settings, acknowledgedKeyRisk: true }
    await store.saveSettings(settings)
    await store.writeSecret(await sealSecret(key.trim(), passphrase.trim() || null))
    set({ key: key.trim(), locked: false, settings })
    void get().refreshBalance()
  },

  async unlock(passphrase) {
    const store = await repository()
    const secret = await store.readSecret()
    if (!secret) {
      return false
    }
    try {
      const key = await openSecret(secret, passphrase)
      set({ key, locked: false })
      void get().refreshBalance()
      return true
    } catch {
      return false
    }
  },

  async clearKey() {
    const store = await repository()
    await store.writeSecret(null)
    set({ key: null, locked: false, balance: null })
  },

  async setLocale(locale) {
    await get().patchSettings({ locale })
    document.documentElement.lang = locale === 'en' ? 'en' : 'zh'
  },

  async patchSettings(patch) {
    const store = await repository()
    const settings = { ...get().settings, ...patch }
    if (settings.safetyLevel !== 'high' && settings.safetyLevel !== 'low') {
      settings.safetyLevel = 'high'
    }
    await store.saveSettings(settings)
    set({ settings })
  },

  async setPrefs(patch) {
    const prefs = { ...get().prefs, ...patch }
    if ('thinking' in patch || 'search' in patch) {
      const stored = readToggles()
      writeToggles({
        thinking: 'thinking' in patch ? prefs.thinking : stored.thinking,
        search: 'search' in patch ? prefs.search : stored.search,
      })
    }
    set({ prefs })
    const { activeId, conversations } = get()
    if (!activeId) {
      return
    }
    const current = conversations.find((item) => item.id === activeId)
    if (!current) {
      return
    }
    const next = stamp({ ...current, ...prefs })
    await (await repository()).saveConversation(next)
    set({ conversations: conversations.map((item) => (item.id === next.id ? next : item)) })
  },

  async newChat() {
    set({ activeId: null, messages: [], drafts: [], sidebarOpen: false, prefs: withToggles(defaultPrefs()) })
  },

  async openChat(id) {
    if (get().serverMode) {
      const data = await api<{ messages: Message[] }>(`/api/conversations/${id}/messages`)
      const conversation = get().conversations.find((item) => item.id === id)
      set({
        activeId: id,
        messages: data.messages,
        sidebarOpen: false,
        drafts: [],
        prefs: prefsFor(conversation, get().prefs),
      })
      return
    }
    const store = await repository()
    const messages = await store.listMessages(id)
    const conversation = get().conversations.find((item) => item.id === id)
    set({
      activeId: id,
      messages,
      sidebarOpen: false,
      drafts: [],
      prefs: prefsFor(conversation, get().prefs),
    })
  },

  async loadSearchCorpus() {
    const { conversations, serverMode, activeId, messages } = get()
    const out: Record<string, string> = {}
    if (activeId) out[activeId] = messages.map(messageText).join('\n')
    if (serverMode) {
      await Promise.all(conversations.map(async (item) => {
        if (item.id === activeId) return
        try {
          const data = await api<{ messages: Message[] }>(`/api/conversations/${item.id}/messages`)
          out[item.id] = data.messages.map(messageText).join('\n')
        } catch {
          out[item.id] = ''
        }
      }))
      return out
    }
    const store = await repository()
    await Promise.all(conversations.map(async (item) => {
      const stored = (await store.listMessages(item.id)).map(messageText).join('\n')
      out[item.id] = item.id === activeId && out[item.id] ? out[item.id] : stored
    }))
    return out
  },

  async rename(id, title) {
    if (get().serverMode) {
      await api(`/api/conversations/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) })
      set({
        conversations: get().conversations.map((item) =>
          item.id === id ? { ...item, title, titleSource: 'user' } : item,
        ),
      })
      return
    }
    const store = await repository()
    const current = get().conversations.find((item) => item.id === id)
    if (!current) {
      return
    }
    const next = stamp({ ...current, title: title.trim(), titleSource: 'user' as const })
    await store.saveConversation(next)
    set({ conversations: get().conversations.map((item) => (item.id === id ? next : item)) })
  },

  async pin(id) {
    const current = get().conversations.find((item) => item.id === id)
    if (!current) {
      return
    }
    const next = stamp({ ...current, pinned: !current.pinned })
    if (!get().serverMode) {
      const store = await repository()
      await store.saveConversation(next)
    }
    set({ conversations: get().conversations.map((item) => (item.id === id ? next : item)) })
  },

  async pinMany(ids) {
    const wanted = new Set(ids)
    const next = get().conversations.map((item) => (wanted.has(item.id) && !item.pinned ? stamp({ ...item, pinned: true }) : item))
    if (!get().serverMode) {
      const store = await repository()
      for (const item of next) {
        if (wanted.has(item.id)) await store.saveConversation(item)
      }
    }
    set({ conversations: next })
  },

  async removeChat(id) {
    if (get().serverMode) {
      await api(`/api/conversations/${id}`, { method: 'DELETE' })
      const wasActive = get().activeId === id
      const conversations = get().conversations.filter((item) => item.id !== id)
      const next = wasActive ? (conversations[0]?.id ?? null) : get().activeId
      set({ conversations, activeId: next, messages: wasActive ? [] : get().messages })
      if (wasActive && next) {
        await get().openChat(next)
      }
      return
    }
    const store = await repository()
    await store.deleteConversation(id)
    const conversations = get().conversations.filter((item) => item.id !== id)
    if (get().activeId !== id) {
      set({ conversations })
      return
    }
    const next = conversations[0]?.id ?? null
    set({ conversations, activeId: next, messages: [] })
    if (next) {
      await get().openChat(next)
    }
  },

  async selectSibling(messageId, siblingId) {
    const messages = get().messages
    if (!messages.some((item) => item.id === siblingId)) {
      return
    }
    const leaf = leafUnder(messages, siblingId)
    const conversation = get().conversations.find((item) => item.id === get().activeId)
    if (!conversation) {
      return
    }
    const next = stamp({ ...conversation, activeLeafId: leaf })
    if (get().serverMode) {
      await api(`/api/conversations/${conversation.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ activeLeafId: leaf }),
      })
      set({ conversations: get().conversations.map((item) => (item.id === next.id ? next : item)) })
      return
    }
    await (await repository()).saveConversation(next)
    set({
      conversations: get().conversations.map((item) => (item.id === next.id ? next : item)),
    })
    void messageId
  },

  async send(text) {
    if (get().serverMode) {
      await runServerTurn(text.trim(), null)
      return
    }
    const trimmed = text.trim()
    const { drafts, streaming, key } = get()
    if (streaming || !key) {
      return
    }
    if (!trimmed && drafts.every((file) => !file.fileId)) {
      return
    }
    if (drafts.some((file) => file.busy || file.error || !file.fileId)) {
      return
    }
    await runTurn(trimmed)
  },

  async regenerate(assistantId) {
    const assistant = get().messages.find((item) => item.id === assistantId)
    if (!assistant || get().streaming) {
      return
    }
    if (get().serverMode) {
      await runServerTurn('', assistant.parentId)
      return
    }
    if (!get().key) {
      return
    }
    await runTurn('', assistant.parentId)
  },

  async editUser(messageId, text) {
    const message = get().messages.find((item) => item.id === messageId)
    const trimmed = text.trim()
    if (!message || message.role !== 'user' || !trimmed || get().streaming) {
      return
    }
    if (get().serverMode) {
      await runServerTurn(trimmed, message.parentId)
      return
    }
    if (!get().key) {
      return
    }
    await runTurn(trimmed, undefined, message.parentId)
  },

  stop() {
    abort?.abort()
    serverAbort?.abort()
    if (serverRunId) {
      void api(`/api/runs/${serverRunId}/abort`, { method: 'POST' }).catch(() => undefined)
    }
  },

  async refreshBalance() {
    const key = get().key
    if (!key) {
      return
    }
    try {
      const balance = await client.getBalance(key)
      set({ balance, balanceError: false })
    } catch {
      set({ balanceError: true })
    }
  },

  async addFiles(files) {
    if (get().serverMode) {
      for (const file of files) {
        const localId = nid()
        const mapped = purposeForFile(file.name, file.type)
        set({
          drafts: [...get().drafts, { localId, filename: file.name, media: mapped.media, purpose: mapped.purpose, bytes: file.size, expiresAt: null, busy: true }],
        })
        try {
          const form = new FormData()
          form.set('purpose', mapped.purpose)
          form.set('file', file)
          const uploaded = await api<{ id: string; expires_at: number | null }>('/api/files', { method: 'POST', body: form })
          set({
            drafts: get().drafts.map((item) =>
              item.localId === localId ? { ...item, busy: false, fileId: uploaded.id, expiresAt: uploaded.expires_at } : item,
            ),
          })
        } catch (error) {
          set({
            drafts: get().drafts.map((item) =>
              item.localId === localId ? { ...item, busy: false, error: error instanceof Error ? error.message : 'upload' } : item,
            ),
          })
        }
      }
      return
    }
    const key = get().key
    if (!key) {
      return
    }
    for (const file of files) {
      const localId = nid()
      const mapped = purposeForFile(file.name, file.type)
      set({
        drafts: [
          ...get().drafts,
          {
            localId,
            filename: file.name,
            media: mapped.media,
            purpose: mapped.purpose,
            bytes: file.size,
            expiresAt: null,
            busy: true,
          },
        ],
      })
      try {
        const uploaded = await client.uploadFile(key, file, file.name, mapped.purpose)
        set({
          drafts: get().drafts.map((item) =>
            item.localId === localId
              ? { ...item, busy: false, fileId: uploaded.id, expiresAt: uploaded.expires_at }
              : item,
          ),
        })
      } catch (error) {
        set({
          drafts: get().drafts.map((item) =>
            item.localId === localId
              ? { ...item, busy: false, error: error instanceof Error ? error.message : 'upload' }
              : item,
          ),
        })
      }
    }
  },

  removeDraft(localId) {
    set({ drafts: get().drafts.filter((item) => item.localId !== localId) })
  },

  async exportJson() {
    const payload = exportNative(await collect(), nowIso())
    download(
      `deepapi-${payload.exportedAt.slice(0, 10)}.json`,
      new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
    )
  },

  async exportZip() {
    const bytes = exportV3(await collect())
    download(`deepapi-${nowIso().slice(0, 10)}.zip`, new Blob([bytes], { type: 'application/zip' }))
  },

  async importJson(file, asCopy) {
    const archive = readNative(JSON.parse(await file.text()) as unknown)
    await applyImport(archive.conversations, asCopy)
  },

  async importZip(file, asCopy) {
    const imported = importV3(new Uint8Array(await file.arrayBuffer()))
    await applyImport(imported.conversations, asCopy)
  },

  setSettingsOpen(open) {
    set({ settingsOpen: open })
  },
  setSidebarOpen(open) {
    set({ sidebarOpen: open })
  },
  dismissNotice() {
    set({ notice: null })
  },

  async setupAdmin(username, password) {
    const result = await api<{ user: ServerUser; csrf: string }>('/api/setup/admin', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    setCsrf(result.csrf)
    sessionStorage.setItem('deepapi-mode', 'server')
    set({ setupRequired: false, serverUser: result.user, serverMode: true, showAdmin: result.user.role === 'admin', conversations: [], messages: [], activeId: null })
  },

  async loginServer(username, password) {
    const result = await api<{ user: ServerUser; csrf: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    setCsrf(result.csrf)
    sessionStorage.setItem('deepapi-mode', 'server')
    set({ serverUser: result.user, serverMode: true, showLogin: false, showAdmin: false })
    await loadServerChats(set)
  },

  async registerServer(code, username, password) {
    const result = await api<{ user: ServerUser; csrf: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ code, username, password }),
    })
    setCsrf(result.csrf)
    sessionStorage.setItem('deepapi-mode', 'server')
    set({ serverUser: result.user, serverMode: true, showLogin: false })
    await loadServerChats(set)
  },

  async logoutServer() {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
    setCsrf('')
    clearRemoteSession()
    if (get().native) {
      await writeRemoteSession(null)
    }
    sessionStorage.removeItem('deepapi-mode')
    set({ serverUser: null, serverMode: false, serverBase: '', showAdmin: false, showLogin: get().native ? false : true })
    await reloadLocal(set)
  },

  async enterServerMode() {
    sessionStorage.setItem('deepapi-mode', 'server')
    set({ serverMode: true })
    await loadServerChats(set)
  },

  async enterLocalMode() {
    sessionStorage.setItem('deepapi-mode', 'local')
    set({ serverMode: false, showAdmin: false })
    await reloadLocal(set)
  },

  async syncServer() {
    await loadServerChats(set)
  },

  async copyLocalToServer() {
    const payload = exportNative(await collect(), nowIso())
    const result = await api<{ added: number; skipped: number }>('/api/migrations/local', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    set({ notice: `${result.added}:${result.skipped}` })
    await loadServerChats(set)
  },

  openLogin() {
    set({ showLogin: true })
  },

  openAdmin(open) {
    set({ showAdmin: open })
  },

  setAllowLanHttp(value) {
    set({ allowLanHttp: value })
  },

  async connectRemote(base, username, password) {
    const origin = validateServerUrl(base, get().allowLanHttp)
    const result = await fetch(`${origin}/api/auth/login`, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }).then(async (response) => {
      const data = (await response.json()) as { token?: string; user?: ServerUser; error?: { message?: string } }
      if (!response.ok || !data.token || !data.user) {
        throw new Error(data.error?.message || 'login failed')
      }
      return data
    })
    setRemoteSession(origin, result.token!)
    await writeRemoteSession({ base: origin, token: result.token!, username: result.user!.username })
    sessionStorage.setItem('deepapi-mode', 'server')
    set({ serverBase: origin, serverUser: result.user!, serverMode: true, showLogin: false, native: isNativeApp() })
    await loadServerChats(set)
  },

  async registerRemote(base, code, username, password) {
    const origin = validateServerUrl(base, get().allowLanHttp)
    const result = await fetch(`${origin}/api/auth/register`, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, username, password }),
    }).then(async (response) => {
      const data = (await response.json()) as { token?: string; user?: ServerUser; error?: { message?: string } }
      if (!response.ok || !data.token || !data.user) {
        throw new Error(data.error?.message || 'register failed')
      }
      return data
    })
    setRemoteSession(origin, result.token!)
    await writeRemoteSession({ base: origin, token: result.token!, username: result.user!.username })
    sessionStorage.setItem('deepapi-mode', 'server')
    set({ serverBase: origin, serverUser: result.user!, serverMode: true, showLogin: false, native: isNativeApp() })
    await loadServerChats(set)
  },

  dismissOverlay() {
    if (get().settingsOpen) {
      set({ settingsOpen: false })
      return true
    }
    if (get().showAdmin) {
      set({ showAdmin: false })
      return true
    }
    if (get().showLogin) {
      set({ showLogin: false })
      return true
    }
    if (get().sidebarOpen) {
      set({ sidebarOpen: false })
      return true
    }
    return false
  },
}))

const collect = async () => {
  const store = await repository()
  const conversations = await store.listConversations()
  const full = []
  for (const conversation of conversations) {
    full.push({ ...conversation, messages: await store.listMessages(conversation.id) })
  }
  return full
}

const applyImport = async (
  incoming: Array<Conversation & { messages: Message[] }>,
  asCopy: boolean,
) => {
  const store = await repository()
  const existing = new Set((await store.listConversations()).map((item) => item.id))
  const plan = planNativeImport(
    existing,
    { format: 'deepapi', version: 1, exportedAt: nowIso(), app: 'deepapi', conversations: incoming },
    asCopy ? 'copy' : 'merge',
  )
  for (const conversation of plan.conversations) {
    const { messages, ...rest } = conversation
    await store.saveConversation(rest)
    for (const message of messages) {
      await store.saveMessage(message)
    }
  }
  useHarbor.setState({ notice: `${plan.added}:${plan.skipped}` })
  await useHarbor.getState().boot()
  useHarbor.setState({ notice: `${plan.added}:${plan.skipped}`, booted: true })
}

const runTurn = async (text: string, regenerateParent?: string | null, branchFrom?: string | null) => {
  const state = useHarbor.getState()
  const key = state.key
  if (!key) {
    return
  }
  const store = await repository()
  let conversation =
    state.conversations.find((item) => item.id === state.activeId) ??
    blankConversation(state.prefs)
  const created = !state.conversations.some((item) => item.id === conversation.id)
  if (created) {
    conversation = { ...conversation, ...state.prefs }
  }
  const messages = created ? [] : state.messages.slice()
  let parentId = conversation.activeLeafId
  if (regenerateParent !== undefined) {
    parentId = regenerateParent
  } else {
    if (branchFrom !== undefined) {
      parentId = branchFrom
    }
    const user: Message = {
      id: nid(),
      conversationId: conversation.id,
      parentId,
      role: 'user',
      status: 'complete',
      blocks: [
        ...(text ? [{ type: 'text' as const, text }] : []),
        ...state.drafts.flatMap((file) =>
          file.fileId
            ? [
                {
                  type: 'file_ref' as const,
                  fileId: file.fileId,
                  filename: file.filename,
                  media: file.media,
                  purpose: file.purpose,
                  bytes: file.bytes,
                  expiresAt: file.expiresAt,
                },
              ]
            : [],
        ),
      ],
      usage: null,
      errorMessage: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      rev: 1,
      deletedAt: null,
    }
    messages.push(user)
    parentId = user.id
    await store.saveMessage(user)
  }
  const assistant: Message = {
    id: nid(),
    conversationId: conversation.id,
    parentId,
    role: 'assistant',
    status: 'streaming',
    blocks: [],
    usage: null,
    errorMessage: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    rev: 1,
    deletedAt: null,
  }
  messages.push(assistant)
  conversation = stamp({ ...conversation, ...withFixedModel(state.prefs), activeLeafId: assistant.id })
  await store.saveConversation(conversation)
  await store.saveMessage(assistant)
  const conversations = created
    ? [conversation, ...state.conversations]
    : state.conversations.map((item) => (item.id === conversation.id ? conversation : item))
  useHarbor.setState({
    conversations,
    activeId: conversation.id,
    messages,
    streaming: true,
    drafts: [],
    sidebarOpen: false,
  })

  const history = activePath(messages, parentId)
  const body = buildRequest({
    model: DEFAULT_CHAT_MODEL,
    thinking: conversation.thinking,
    search: conversation.search,
    readLink: conversation.readLink,
    effort: DEFAULT_EFFORT,
    safetyLevel: state.settings.safetyLevel,
    requestTitle: history.every((item) => item.role !== 'assistant') && conversation.titleSource !== 'user',
    messages: history,
    locale: state.settings.locale,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  })
  abort = new AbortController()
  let draft = createDraft()
  const clock = createThinkingClock()
  const publish = (patch: Partial<Message>) => {
    const next = { ...assistant, ...patch, updatedAt: nowIso() }
    Object.assign(assistant, next)
    useHarbor.setState({
      messages: useHarbor.getState().messages.map((item) => (item.id === assistant.id ? { ...assistant } : item)),
    })
  }
  const persist = () => {
    void store.saveMessage({ ...assistant })
  }
  try {
    for await (const event of client.streamMessage(key, body, abort.signal)) {
      draft = reduceEvent(draft, event)
      clock.onEvent(event, draft.blocks)
      if (event.type === 'message_delta' && event.delta.title && conversation.titleSource !== 'user') {
        conversation = stamp({ ...conversation, title: event.delta.title, titleSource: 'auto' })
        await store.saveConversation(conversation)
        useHarbor.setState({
          conversations: useHarbor
            .getState()
            .conversations.map((item) => (item.id === conversation.id ? conversation : item)),
        })
      }
      publish({
        blocks: draft.blocks.filter(Boolean),
        usage: draft.usage,
        thinkingSeconds: clock.seconds(),
      })
      window.clearTimeout(persistTimer)
      persistTimer = window.setTimeout(persist, 200)
    }
    if (draft.stopReason === 'refusal') {
      publish({ status: 'refused', blocks: [], usage: draft.usage, errorMessage: null, thinkingSeconds: clock.seconds() })
    } else {
      publish({ status: 'complete', blocks: draft.blocks.filter(Boolean), usage: draft.usage, errorMessage: null, thinkingSeconds: clock.seconds() })
    }
  } catch (error) {
    const aborted = abort.signal.aborted
    publish({
      status: aborted ? 'aborted' : 'error',
      blocks: draft.blocks.filter(Boolean),
      usage: draft.usage,
      errorMessage: aborted ? null : error instanceof Error ? error.message : 'error',
      thinkingSeconds: clock.seconds(),
    })
  } finally {
    window.clearTimeout(persistTimer)
    await store.saveMessage({ ...assistant })
    abort = null
    const usages = []
    for (const item of await store.listConversations()) {
      for (const message of await store.listMessages(item.id)) {
        usages.push(message.usage)
      }
    }
    useHarbor.setState({ streaming: false, totals: sumUsage(usages) })
  }
}

export const conversationCost = (messages: Message[]) =>
  estimateCost(
    sumUsage(messages.map((message) => message.usage)),
    new Date(),
  )

type Setter = (partial: Partial<HarborState>) => void

const reloadLocal = async (set: Setter) => {
  const store = await repository()
  const conversations = (await store.listConversations()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const activeId = conversations[0]?.id ?? null
  const messages = activeId ? await store.listMessages(activeId) : []
  set({ conversations, activeId, messages, serverMode: false })
}

const loadServerChats = async (set: Setter) => {
  const sync = await api<{
    cursor: number
    conversations: Conversation[]
    messages: Message[]
  }>('/api/sync?cursor=0')
  const conversations = [...sync.conversations].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const previous = useHarbor.getState().activeId
  const activeId = conversations.some((item) => item.id === previous) ? previous : (conversations[0]?.id ?? null)
  const messages = activeId ? (await api<{ messages: Message[] }>(`/api/conversations/${activeId}/messages`)).messages : []
  const usages = sync.messages.map((message) => message.usage)
  set({ conversations, activeId, messages, totals: sumUsage(usages), serverMode: true })
}

const probeHost = async (set: Setter, get: () => HarborState) => {
  set({ hosted: true })
  const config = await api<{ setup_required: boolean }>('/api/config')
  if (config.setup_required) {
    set({ setupRequired: true })
    return
  }
  try {
    const me = await api<{ user: ServerUser; csrf: string; quota: ServerQuota }>('/api/me')
    setCsrf(me.csrf)
    const useServer = sessionStorage.getItem('deepapi-mode') !== 'local'
    set({ serverUser: me.user, serverMode: useServer, quota: me.quota, showAdmin: false })
    if (useServer) {
      await loadServerChats(set)
    }
  } catch {
    set({ serverUser: null, serverMode: false })
  }
  void get
}

const runServerTurn = async (text: string, regenerateParent: string | null) => {
  const state = useHarbor.getState()
  if (state.streaming) {
    return
  }
  let conversationId = state.activeId
  if (!conversationId || regenerateParent === null && !state.conversations.some((item) => item.id === conversationId)) {
    conversationId = nid()
    await api('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({ id: conversationId, ...withFixedModel(state.prefs) }),
    })
  }
  const files = state.drafts.filter((file) => file.fileId)
  useHarbor.setState({ streaming: true, drafts: [] })
  const started = await api<{ runId: string; userMessageId: string; assistantMessageId: string }>(
    `/api/conversations/${conversationId}/runs`,
    {
      method: 'POST',
      body: JSON.stringify({
        text,
        parentId: regenerateParent,
        files: files.map((file) => ({
          fileId: file.fileId,
          filename: file.filename,
          media: file.media,
          purpose: file.purpose,
          bytes: file.bytes,
          expiresAt: file.expiresAt,
        })),
        ...withFixedModel(state.prefs),
        locale: state.settings.locale,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    },
  )
  serverRunId = started.runId
  const now = nowIso()
  const userMessage: Message | null = regenerateParent
    ? null
    : {
        id: started.userMessageId,
        conversationId,
        parentId: state.activeId ? state.conversations.find((item) => item.id === conversationId)?.activeLeafId ?? null : null,
        role: 'user',
        status: 'complete',
        blocks: [{ type: 'text', text }],
        usage: null,
        errorMessage: null,
        createdAt: now,
        updatedAt: now,
        rev: 1,
        deletedAt: null,
      }
  const assistant: Message = {
    id: started.assistantMessageId,
    conversationId,
    parentId: regenerateParent ?? started.userMessageId,
    role: 'assistant',
    status: 'streaming',
    blocks: [],
    usage: null,
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
    rev: 1,
    deletedAt: null,
  }
  const conversations = state.conversations.some((item) => item.id === conversationId)
    ? state.conversations.map((item) =>
        item.id === conversationId ? { ...item, activeLeafId: assistant.id, updatedAt: now } : item,
      )
    : [
        {
          id: conversationId,
          title: '',
          titleSource: 'default' as const,
          ...withFixedModel(state.prefs),
          pinned: false,
          archived: false,
          activeLeafId: assistant.id,
          createdAt: now,
          updatedAt: now,
          rev: 1,
          deletedAt: null,
        },
        ...state.conversations,
      ]
  useHarbor.setState({
    conversations,
    activeId: conversationId,
    messages: [...state.messages.filter((item) => item.conversationId === conversationId), ...(userMessage ? [userMessage] : []), assistant],
  })
  serverAbort = new AbortController()
  let draft = createDraft()
  const clock = createThinkingClock()
  try {
    await readRun(
      started.runId,
      (event) => {
        draft = reduceEvent(draft, event)
        clock.onEvent(event, draft.blocks)
        if (event.type === 'message_delta' && event.delta.title) {
          useHarbor.setState({
            conversations: useHarbor.getState().conversations.map((item) =>
              item.id === conversationId && item.titleSource !== 'user'
                ? { ...item, title: event.delta.title ?? item.title, titleSource: 'auto' }
                : item,
            ),
          })
        }
        useHarbor.setState({
          messages: useHarbor.getState().messages.map((item) =>
            item.id === assistant.id
              ? { ...item, blocks: draft.blocks.filter(Boolean), usage: draft.usage, thinkingSeconds: clock.seconds() }
              : item,
          ),
        })
      },
      serverAbort.signal,
    )
    const status = draft.stopReason === 'refusal' ? 'refused' : serverAbort.signal.aborted ? 'aborted' : 'complete'
    useHarbor.setState({
      messages: useHarbor.getState().messages.map((item) =>
        item.id === assistant.id
          ? {
              ...item,
              status,
              blocks: status === 'refused' ? [] : draft.blocks.filter(Boolean),
              usage: draft.usage,
              thinkingSeconds: clock.seconds(),
            }
          : item,
      ),
    })
  } catch (error) {
    useHarbor.setState({
      messages: useHarbor.getState().messages.map((item) =>
        item.id === assistant.id
          ? {
              ...item,
              status: 'error',
              errorMessage: error instanceof Error ? error.message : 'error',
              blocks: draft.blocks.filter(Boolean),
              thinkingSeconds: clock.seconds(),
            }
          : item,
      ),
    })
  } finally {
    serverAbort = null
    serverRunId = null
    const previous = useHarbor.getState().totals
    let quota = useHarbor.getState().quota
    try {
      quota = (await api<{ quota: ServerQuota }>('/api/me')).quota
    } catch {
      // The chat total still updates from the stream if the quota read fails.
    }
    useHarbor.setState({ streaming: false, totals: sumUsage([previous, draft.usage]), quota })
  }
}
