import { ApiClientError, buildRequest, continuationBlocks, createClient, messageUsedWebTool, purposeForFile } from '@deepapi/api-client'
import { HINT_NETWORK, classifyApiError, replyErrorCode } from './errors.js'
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
  type ContentBlock,
  type Conversation,
  type Message,
  type Settings,
  type Usage,
} from '@deepapi/types'
import { create } from 'zustand'
import { readAloudSnapshot, stopReadAloud } from './speech/readAloud.js'
import { cancelVoiceInput } from './speech/voiceSession.js'

const haltSpeech = () => {
  cancelVoiceInput()
  stopReadAloud()
}

const client = createClient()
let repo: Repository | null = null
let abort: AbortController | null = null
let serverAbort: AbortController | null = null
let serverRunId: string | null = null
let persistTimer = 0
let persistDue = 0
let persistFlush: (() => void) | null = null
let persistMessage: Message | null = null
const PERSIST_WAIT = 200
const PERSIST_MAX = 1000
const LIVE_SNAP = 'deepapi-live-snap'

const notePersist = (message: Message) => {
  persistMessage = message
}

/** IndexedDB commits after the page is gone. pagehide writes this snapshot synchronously. */
const writeLiveSnap = () => {
  if (!persistMessage) return
  try {
    sessionStorage.setItem(LIVE_SNAP, JSON.stringify(persistMessage))
  } catch {
    // A full sessionStorage must not block the unload flush.
  }
}

const readLiveSnap = (): Message | null => {
  try {
    const raw = sessionStorage.getItem(LIVE_SNAP)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Message
    if (!parsed || parsed.role !== 'assistant' || typeof parsed.id !== 'string') return null
    return parsed
  } catch {
    return null
  }
}

const clearLiveSnap = () => {
  try {
    sessionStorage.removeItem(LIVE_SNAP)
  } catch {
    // Ignore a storage that is already gone.
  }
}

const bodySize = (message: Message) =>
  message.blocks.reduce((sum, block) => sum + (block.type === 'text' ? block.text.length : block.type === 'thinking' ? block.thinking.length : 0), 0)

const mergeLiveSnap = async (store: Repository, rows: Message[]): Promise<Message[]> => {
  const snap = readLiveSnap()
  if (!snap) return rows
  const next = rows.slice()
  const index = next.findIndex((item) => item.id === snap.id)
  if (index < 0) {
    next.push(snap)
    await store.saveMessage(snap)
  } else if (bodySize(snap) > bodySize(next[index])) {
    const merged = { ...next[index], blocks: snap.blocks, thinkingSeconds: snap.thinkingSeconds ?? next[index].thinkingSeconds, status: next[index].status === 'complete' ? next[index].status : snap.status }
    next[index] = merged
    await store.saveMessage(merged)
  }
  clearLiveSnap()
  return next
}

const flushPersist = () => {
  window.clearTimeout(persistTimer)
  persistTimer = 0
  persistDue = 0
  persistFlush?.()
}

/** Trailing 200ms, but never wait more than 1000ms while events keep arriving. */
const schedulePersist = (flush: () => void) => {
  persistFlush = flush
  const now = Date.now()
  if (!persistDue) persistDue = now + PERSIST_MAX
  const wait = Math.max(0, Math.min(PERSIST_WAIT, persistDue - now))
  window.clearTimeout(persistTimer)
  persistTimer = 0
  if (wait === 0) {
    persistDue = 0
    flush()
    return
  }
  persistTimer = window.setTimeout(() => {
    persistTimer = 0
    persistDue = 0
    flush()
  }, wait)
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    writeLiveSnap()
    flushPersist()
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPersist()
  })
}
/** In-flight assistant. openChat and a refresh must not replace it with a finished title. */
let liveTurn: { conversationId: string; message: Message } | null = null

const rememberLive = (message: Message) => {
  liveTurn = { conversationId: message.conversationId, message: structuredClone(message) }
}

const clearLive = (id: string) => {
  if (liveTurn?.message.id === id) liveTurn = null
}

const withLive = (conversationId: string | null, messages: Message[]): Message[] => {
  const live = liveTurn
  if (!conversationId || !live || live.conversationId !== conversationId) return messages
  const next = live.message
  if (messages.some((item) => item.id === next.id)) {
    return messages.map((item) => (item.id === next.id ? next : item))
  }
  return [...messages, next]
}

/** A local refresh has no fetch left. Persisted "streaming" rows are the stopped state. */
const stopOrphanStreams = async (store: Repository, rows: Message[]): Promise<{ rows: Message[]; orphans: number }> => {
  const next: Message[] = []
  let orphans = 0
  for (const row of rows) {
    if (row.role === 'assistant' && row.status === 'streaming' && liveTurn?.message.id !== row.id) {
      const stopped: Message = { ...row, status: 'aborted', updatedAt: nowIso() }
      await store.saveMessage(stopped)
      next.push(stopped)
      orphans += 1
    } else {
      next.push(row)
    }
  }
  return { rows: next, orphans }
}

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
  /** Original text when this draft came from a long paste. */
  pasteText?: string
  /** Object URL for an image draft. Kept in imagePreviews after upload so the sent card can still show it. */
  previewUrl?: string
}

export type StatusToastCode =
  | 'msgGeneratingTryLater'
  | 'hintLastMessageIsWIP'
  | 'commonNetworkErrorToast'
  | 'completionNetworkErrorToast'
  | 'completionWipNetworkErrorToast'
  | 'networkToasts'
  | 'alreadyLatest'
  | 'dropUnsupported'
  | 'emptyQuestion'
  | 'filesNeedNoSearch'
  | 'pasteTooLong'
  | 'overCharLimit'
  | 'removeBadFiles'
  | 'sessionDeleted'
  | 'renameFailed'

const imagePreviews = new Map<string, string>()
export const imagePreview = (fileId?: string) => (fileId ? imagePreviews.get(fileId) : undefined)
const rememberImage = (fileId: string | undefined, url: string | undefined) => {
  if (fileId && url) imagePreviews.set(fileId, url)
}

const SUPPORTED_UPLOAD = /\.(pdf|docx?|xlsx?|pptx?|png|jpe?g|gif|webp|bmp|svg|txt|md|csv|json|log|js|jsx|mjs|cjs|ts|tsx|py|go|rs|java|c|h|cpp|cc|hpp|css|html?|sh|bash|zsh|ya?ml|xml|toml|sql|rb|php|vue|kt|swift|cs|lua|r|scala|ini|cfg)$/i
const supportedUpload = (file: File) =>
  file.type.startsWith('image/')
  || file.type.startsWith('text/')
  || file.type === 'application/pdf'
  || file.type === 'application/json'
  || SUPPORTED_UPLOAD.test(file.name)

const FILE_TOO_LONG = 20 * 1024 * 1024
const pasteTextOf = (file: File) => (file as File & { pasteText?: string }).pasteText
const fileErrorCode = (error: unknown): 'parse' | 'policy' | 'tooLong' | 'noText' => {
  const message = error instanceof Error ? error.message : String(error ?? '')
  if (/规范|policy|content.filter|unsafe/i.test(message)) return 'policy'
  if (/过长|too long|context length/i.test(message)) return 'tooLong'
  if (/未提取|no text/i.test(message)) return 'noText'
  return 'parse'
}

type Prefs = Pick<Conversation, 'thinking' | 'search' | 'readLink'>

// SP-CMP-297. Unsent files live in this tab only. Reload drops the map.
const fileDrafts = new Map<string, DraftFile[]>()
const draftKey = (id: string | null | undefined) => id ?? ''
const snapshotFiles = (files: DraftFile[]) => files.map((item) => ({ ...item }))
const stashFiles = (id: string | null | undefined, files: DraftFile[]) => {
  fileDrafts.set(draftKey(id), snapshotFiles(files))
}
const takeFiles = (id: string | null | undefined) => snapshotFiles(fileDrafts.get(draftKey(id)) ?? [])
const ACTIVE_KEY = 'deepapi-active-id'
const rememberActive = (id: string | null) => {
  try {
    if (id) sessionStorage.setItem(ACTIVE_KEY, id)
    else sessionStorage.removeItem(ACTIVE_KEY)
  } catch {
    // Private mode can reject sessionStorage. The in-memory chat still switches.
  }
}

const TOGGLE_KEY = 'deepapi-toggles'

type Toggles = Pick<Prefs, 'thinking' | 'search'>

const defaultPrefs = (): Prefs => ({
  thinking: true,
  search: true,
  readLink: false,
})

// SP-CMP-255 / SP-CMP-256. 昊辰 11/26 00:30: both default on.
// A change stays in this page session (New chat, shortcut, other chats, route changes)
// and a reload returns both to on. Older builds wrote deepapi-toggles; that key must not override the default.
let sessionToggles: Toggles = { thinking: defaultPrefs().thinking, search: defaultPrefs().search }

const dropStaleToggles = () => {
  try {
    localStorage.removeItem(TOGGLE_KEY)
  } catch {
    // Private mode can reject localStorage. The in-memory prefs still apply.
  }
}

const withFixedModel = (prefs: Prefs) => ({
  ...prefs,
  model: DEFAULT_CHAT_MODEL,
  effort: DEFAULT_EFFORT,
})

const readToggles = (): Toggles => {
  dropStaleToggles()
  return { thinking: sessionToggles.thinking, search: sessionToggles.search }
}

const writeToggles = (toggles: Toggles) => {
  sessionToggles = { thinking: toggles.thinking, search: toggles.search }
  dropStaleToggles()
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

const hasStreamOutput = (blocks: ContentBlock[]): boolean =>
  blocks.some((block) => {
    if (block.type === 'text') return block.text.trim().length > 0
    if (block.type === 'thinking') return block.thinking.trim().length > 0
    return block.type === 'server_tool_use' || block.type === 'web_search_tool_result' || block.type === 'web_fetch_tool_result'
  })

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
  /** SP-CV-369/370/418/419. A toast key, or networkToasts for the two network sentences. */
  statusToast: StatusToastCode | null
  dismissStatusToast: () => void
  prefs: Prefs
  drafts: DraftFile[]
  /** SP-CMP-296. Per-chat composer text for this tab. Key '' is the landing page. Not stored. */
  textDrafts: Record<string, string>
  setComposerText: (id: string | null, value: string) => void
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
  /** Resend a user turn whose completion never started. */
  resend: (userId: string) => Promise<void>
  continueReply: (assistantId: string) => Promise<void>
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
  statusToast: null,
  dismissStatusToast: () => set({ statusToast: null }),
  prefs: withToggles(defaultPrefs()),
  drafts: [],
  textDrafts: {},
  setComposerText(id, value) {
    const key = draftKey(id)
    set({ textDrafts: { ...get().textDrafts, [key]: value } })
  },
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
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('deepapi-boot-hold') === '1') {
      await new Promise<void>((resolve) => {
        window.addEventListener('deepapi-boot-release', () => resolve(), { once: true })
      })
    }
    const previousKey = get().key
    const store = await repository()
    const settings = await store.loadSettings()
    const secret = await store.readSecret()
    const conversations = (await store.listConversations()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    const usages: Array<Usage | null> = []
    let messages: Message[] = []
    let orphanStreams = 0
    let storedActive: string | null = null
    try {
      storedActive = sessionStorage.getItem(ACTIVE_KEY)
    } catch {
      storedActive = null
    }
    let pathId: string | null = null
    if (typeof location !== 'undefined') {
      const match = location.pathname.match(/^\/a\/chat\/s\/([^/]+)\/?$/)
      if (match) {
        try { pathId = decodeURIComponent(match[1]) } catch { pathId = match[1] }
      }
    }
    const pathKnown = Boolean(pathId && conversations.some((item) => item.id === pathId))
    const sessionMissing = Boolean(pathId && !pathKnown)
    const activeId = pathKnown
      ? pathId
      : sessionMissing
        ? null
        : storedActive && conversations.some((item) => item.id === storedActive) ? storedActive : (conversations[0]?.id ?? null)
    for (const conversation of conversations) {
      const rows = await store.listMessages(conversation.id)
      for (const row of rows) {
        usages.push(row.usage)
      }
      if (conversation.id === activeId) {
        const stopped = await stopOrphanStreams(store, await mergeLiveSnap(store, rows))
        orphanStreams += stopped.orphans
        messages = withLive(activeId, stopped.rows)
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
      prefs: prefsFor(conversations.find((item) => item.id === activeId), defaultPrefs()),
      statusToast: sessionMissing ? 'sessionDeleted' : orphanStreams > 0 ? 'hintLastMessageIsWIP' : null,
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
    haltSpeech()
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
    // SP-SB-630. Already on an empty new chat: say so, don't reset again.
    // A recording or an in-flight transcription on that landing is still a live
    // attempt. Stop it the same way as the path below: no transcript inserted,
    // microphone tracks released, voice back to idle. The toast stays.
    const idle = get()
    const idleText = (idle.textDrafts[draftKey(idle.activeId)] ?? '').trim()
    if (!idle.activeId && idle.messages.length === 0 && idle.drafts.length === 0 && !idleText) {
      haltSpeech()
      set({ statusToast: 'alreadyLatest' })
      return
    }
    haltSpeech()
    // SP-CMP-296 / SP-CMP-297. Keep the chat we left. The landing composer starts empty.
    stashFiles(get().activeId, get().drafts)
    fileDrafts.delete('')
    rememberActive(null)
    set({
      activeId: null,
      messages: [],
      drafts: [],
      textDrafts: { ...get().textDrafts, '': '' },
      sidebarOpen: false,
      prefs: withToggles(defaultPrefs()),
    })
  },

  async openChat(id) {
    haltSpeech()
    const leaving = get().activeId
    // Re-opening the chat already on screen keeps the cards added since the last stash.
    if (leaving !== id) stashFiles(leaving, get().drafts)
    const restored = leaving === id ? get().drafts : takeFiles(id)
    rememberActive(id)
    if (get().serverMode) {
      const data = await api<{ messages: Message[]; liveRun?: { id: string; messageId: string } | null }>(`/api/conversations/${id}/messages`)
      const conversation = get().conversations.find((item) => item.id === id)
      set({
        activeId: id,
        messages: withLive(id, data.messages),
        sidebarOpen: false,
        drafts: restored,
        prefs: prefsFor(conversation, get().prefs),
      })
      if (data.liveRun && serverRunId !== data.liveRun.id) void followServerRun(data.liveRun.id, data.liveRun.messageId)
      return
    }
    const store = await repository()
    const stopped = await stopOrphanStreams(store, await store.listMessages(id))
    const messages = withLive(id, stopped.rows)
    const conversation = get().conversations.find((item) => item.id === id)
    set({
      activeId: id,
      messages,
      sidebarOpen: false,
      drafts: restored,
      prefs: prefsFor(conversation, get().prefs),
      ...(stopped.orphans ? { statusToast: 'hintLastMessageIsWIP' as const } : {}),
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
    try {
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
        set({ statusToast: 'renameFailed' })
        return
      }
      const next = stamp({ ...current, title: title.trim(), titleSource: 'user' as const })
      await store.saveConversation(next)
      set({ conversations: get().conversations.map((item) => (item.id === id ? next : item)) })
    } catch {
      set({ statusToast: 'renameFailed' })
    }
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
    if (get().activeId === id) haltSpeech()
    if (get().serverMode) {
      await api(`/api/conversations/${id}`, { method: 'DELETE' })
      const wasActive = get().activeId === id
      const conversations = get().conversations.filter((item) => item.id !== id)
      const next = wasActive ? (conversations[0]?.id ?? null) : get().activeId
      set({ conversations, messages: wasActive ? [] : get().messages })
      if (wasActive && next) await get().openChat(next)
      else if (wasActive) {
        set({ activeId: null, drafts: [] })
        rememberActive(null)
      }
      fileDrafts.delete(id)
      return
    }
    const store = await repository()
    await store.deleteConversation(id)
    const conversations = get().conversations.filter((item) => item.id !== id)
    if (get().activeId !== id) {
      set({ conversations })
      fileDrafts.delete(id)
      return
    }
    const next = conversations[0]?.id ?? null
    // Leave activeId on the deleted chat so openChat treats this as a switch and restores the next chat's cards.
    set({ conversations, messages: [] })
    if (next) await get().openChat(next)
    else {
      set({ activeId: null, drafts: [] })
      rememberActive(null)
    }
    fileDrafts.delete(id)
  },

  async selectSibling(messageId, siblingId) {
    const messages = get().messages
    if (!messages.some((item) => item.id === siblingId)) {
      return
    }
    const leaf = leafUnder(messages, siblingId)
    const playing = readAloudSnapshot()
    if (playing.status !== 'idle' && playing.messageId && !activePath(messages, leaf).some((item) => item.id === playing.messageId)) {
      stopReadAloud()
    }
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
    haltSpeech()
    if (get().serverMode) {
      await runServerTurn(text.trim(), null)
      return
    }
    const trimmed = text.trim()
    const { drafts, streaming, key } = get()
    if (!key) {
      return
    }
    if (streaming) {
      set({ statusToast: 'msgGeneratingTryLater' })
      return
    }
    if (!trimmed && drafts.every((file) => !file.fileId)) {
      set({ statusToast: 'emptyQuestion' })
      return
    }
    if (trimmed.length > 100_000) {
      set({ statusToast: 'overCharLimit' })
      return
    }
    if (drafts.some((file) => file.error)) {
      set({ statusToast: 'removeBadFiles' })
      return
    }
    if (drafts.some((file) => file.busy || !file.fileId)) {
      return
    }
    await runTurn(trimmed)
  },

  async regenerate(assistantId) {
    haltSpeech()
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

  async resend(userId) {
    haltSpeech()
    const user = get().messages.find((item) => item.id === userId)
    if (!user || user.role !== 'user' || get().streaming) return
    if (get().serverMode) {
      await runServerTurn('', user.id)
      return
    }
    if (!get().key) return
    const cleared: Message = { ...user, errorMessage: null, updatedAt: nowIso() }
    await (await repository()).saveMessage(cleared)
    set({ messages: get().messages.map((item) => (item.id === user.id ? cleared : item)) })
    await runTurn('', user.id)
  },

  async continueReply(assistantId) {
    haltSpeech()
    const assistant = get().messages.find((item) => item.id === assistantId)
    if (!assistant || assistant.role !== 'assistant' || get().streaming) return
    const snapshot = {
      blocks: structuredClone(assistant.blocks),
      thinkingSeconds: assistant.thinkingSeconds,
    }
    const usedWeb = messageUsedWebTool(assistant)
    if (get().serverMode) {
      await runServerTurn('', null, assistantId)
    } else {
      if (!get().key) return
      await runContinuation(assistantId)
    }
    const after = get().messages.find((item) => item.id === assistantId)
    if (!(usedWeb && after?.errorMessage === 'upstream 400')) return
    const restored: Message = {
      ...after,
      status: 'aborted',
      blocks: snapshot.blocks,
      thinkingSeconds: snapshot.thinkingSeconds ?? after.thinkingSeconds,
      errorMessage: null,
      updatedAt: nowIso(),
    }
    if (!get().serverMode) await (await repository()).saveMessage(restored)
    set({ messages: get().messages.map((item) => (item.id === assistantId ? restored : item)) })
    await get().regenerate(assistantId)
  },

  async editUser(messageId, text) {
    haltSpeech()
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
    haltSpeech()
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
    if (get().prefs.search) {
      set({ statusToast: 'filesNeedNoSearch' })
      return
    }
    // SP-CMP-280. Unsupported drops toast and are not added. PDF, Office, images, text, and code stay.
    const incoming = files.filter((file) => supportedUpload(file))
    if (incoming.length !== files.length) set({ statusToast: 'dropUnsupported' })
    if (!incoming.length) return
    files = incoming
    // SP-CMP-297. A late upload result stays on the chat that received the file.
    const writeDrafts = (owner: string | null, mutate: (rows: DraftFile[]) => DraftFile[]) => {
      if (get().activeId === owner) {
        set({ drafts: mutate(get().drafts) })
        return
      }
      const key = draftKey(owner)
      fileDrafts.set(key, mutate(snapshotFiles(fileDrafts.get(key) ?? [])))
    }
    const staged = (file: File, localId: string, mapped: ReturnType<typeof purposeForFile>, previewUrl: string | undefined) => {
      const pasteText = pasteTextOf(file)
      const base = { localId, filename: file.name, media: mapped.media, purpose: mapped.purpose, bytes: file.size, expiresAt: null as number | null, previewUrl, pasteText }
      if (file.size === 0) return { ...base, busy: false, error: 'noText' as const }
      if (file.size > FILE_TOO_LONG) return { ...base, busy: false, error: 'tooLong' as const }
      return { ...base, busy: true }
    }
    if (get().serverMode) {
      for (const file of files) {
        const owner = get().activeId
        const localId = nid()
        const mapped = purposeForFile(file.name, file.type)
        const previewUrl = mapped.media === 'image' ? URL.createObjectURL(file) : undefined
        const row = staged(file, localId, mapped, previewUrl)
        writeDrafts(owner, (rows) => [...rows, row])
        if (!row.busy) continue
        try {
          const form = new FormData()
          form.set('purpose', mapped.purpose)
          form.set('file', file)
          const uploaded = await api<{ id: string; expires_at: number | null }>('/api/files', { method: 'POST', body: form })
          writeDrafts(owner, (rows) => rows.map((item) => {
            if (item.localId !== localId) return item
            rememberImage(uploaded.id, item.previewUrl)
            return { ...item, busy: false, fileId: uploaded.id, expiresAt: uploaded.expires_at }
          }))
        } catch (error) {
          writeDrafts(owner, (rows) => rows.map((item) =>
            item.localId === localId ? { ...item, busy: false, error: fileErrorCode(error) } : item,
          ))
        }
      }
      return
    }
    const key = get().key
    if (!key) {
      return
    }
    for (const file of files) {
      const owner = get().activeId
      const localId = nid()
      const mapped = purposeForFile(file.name, file.type)
      const previewUrl = mapped.media === 'image' ? URL.createObjectURL(file) : undefined
      const row = staged(file, localId, mapped, previewUrl)
      writeDrafts(owner, (rows) => [...rows, row])
      if (!row.busy) continue
      try {
        const uploaded = await client.uploadFile(key, file, file.name, mapped.purpose)
        writeDrafts(owner, (rows) => rows.map((item) => {
          if (item.localId !== localId) return item
          rememberImage(uploaded.id, item.previewUrl)
          return { ...item, busy: false, fileId: uploaded.id, expiresAt: uploaded.expires_at }
        }))
      } catch (error) {
        writeDrafts(owner, (rows) => rows.map((item) =>
          item.localId === localId ? { ...item, busy: false, error: fileErrorCode(error) } : item,
        ))
      }
    }
  },

  removeDraft(localId) {
    const item = get().drafts.find((row) => row.localId === localId)
    if (item?.previewUrl && !(item.fileId && imagePreviews.get(item.fileId) === item.previewUrl)) {
      URL.revokeObjectURL(item.previewUrl)
    }
    set({ drafts: get().drafts.filter((row) => row.localId !== localId) })
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
    haltSpeech()
    const archive = readNative(JSON.parse(await file.text()) as unknown)
    await applyImport(archive.conversations, asCopy)
  },

  async importZip(file, asCopy) {
    haltSpeech()
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
    haltSpeech()
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
    haltSpeech()
    sessionStorage.setItem('deepapi-mode', 'server')
    set({ serverMode: true })
    await loadServerChats(set)
  },

  async enterLocalMode() {
    haltSpeech()
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

const runContinuation = async (assistantId: string) => {
  const state = useHarbor.getState()
  const key = state.key
  const current = state.messages.find((item) => item.id === assistantId)
  if (!key || !current) return
  const store = await repository()
  const original = current.blocks.filter(Boolean)
  const folded = continuationBlocks(original)
  const usedWeb = messageUsedWebTool(current)
  const assistant: Message = { ...current, status: 'streaming', errorMessage: null, blocks: original, updatedAt: nowIso() }
  const history = activePath(state.messages, assistantId).map((item) =>
    item.id === assistantId ? { ...item, status: 'aborted' as const, blocks: folded } : item,
  )
  useHarbor.setState({
    messages: state.messages.map((item) => (item.id === assistantId ? assistant : item)),
    streaming: true,
  })
  const conversation = state.conversations.find((item) => item.id === assistant.conversationId)
  const attempt = async (dropThinking: boolean) => {
    const body = buildRequest({
      model: DEFAULT_CHAT_MODEL,
      thinking: conversation?.thinking ?? defaultPrefs().thinking,
      search: conversation?.search ?? defaultPrefs().search,
      dropWebSearch: usedWeb,
      readLink: conversation?.readLink ?? false,
      effort: DEFAULT_EFFORT,
      safetyLevel: state.settings.safetyLevel,
      requestTitle: false,
      messages: history,
      locale: state.settings.locale,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      dropThinking,
    })
    abort = new AbortController()
    let draft = createDraft()
    const publish = () => {
      const next: Message = {
        ...assistant,
        status: 'streaming',
        blocks: [...original, ...draft.blocks.filter(Boolean)],
        usage: draft.usage,
        updatedAt: nowIso(),
      }
      Object.assign(assistant, next)
      rememberLive(assistant)
      notePersist(assistant)
      useHarbor.setState({
        messages: useHarbor.getState().messages.map((item) => (item.id === assistant.id ? { ...assistant } : item)),
      })
      schedulePersist(() => {
        void store.saveMessage(structuredClone(assistant))
      })
    }
    for await (const event of client.streamMessage(key, body, abort.signal)) {
      draft = reduceEvent(draft, event)
      publish()
    }
    const done: Message = {
      ...assistant,
      status: draft.stopReason === 'refusal' ? 'refused' : 'complete',
      blocks: draft.stopReason === 'refusal' ? [] : [...original, ...draft.blocks.filter(Boolean)],
      usage: draft.usage,
      errorMessage: null,
      updatedAt: nowIso(),
    }
    Object.assign(assistant, done)
    useHarbor.setState({
      messages: useHarbor.getState().messages.map((item) => (item.id === assistant.id ? { ...assistant } : item)),
    })
  }
  try {
    try {
      await attempt(false)
    } catch (error) {
      const thinking = original.some((block) => block.type === 'thinking')
      if (thinking && error instanceof ApiClientError && error.status === 400 && !abort?.signal.aborted) {
        await attempt(true)
      } else {
        throw error
      }
    }
  } catch (error) {
    const aborted = abort?.signal.aborted
    Object.assign(assistant, {
      status: aborted ? 'aborted' : 'error',
      errorMessage: aborted ? null : error instanceof ApiClientError && error.status === 400 ? 'upstream 400' : replyErrorCode(error),
      updatedAt: nowIso(),
    })
    useHarbor.setState({
      messages: useHarbor.getState().messages.map((item) => (item.id === assistant.id ? { ...assistant } : item)),
    })
  } finally {
    window.clearTimeout(persistTimer)
    persistTimer = 0
    persistDue = 0
    persistFlush = null
    await store.saveMessage({ ...assistant })
    clearLiveSnap()
    persistMessage = null
    clearLive(assistant.id)
    abort = null
    useHarbor.setState({ streaming: false })
  }
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
  const leafBefore = parentId
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
  for (const file of state.drafts) rememberImage(file.fileId, file.previewUrl)
  fileDrafts.delete(conversation.id)
  fileDrafts.delete('')
  rememberActive(conversation.id)
  useHarbor.setState({
    conversations,
    activeId: conversation.id,
    messages,
    streaming: true,
    drafts: [],
    sidebarOpen: false,
    textDrafts: { ...useHarbor.getState().textDrafts, [conversation.id]: '', '': '' },
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
  let dropEmptyNetwork = false
  let hintedUser: Message | null = null
  let restoreLeaf: string | null = parentId
  const publish = (patch: Partial<Message>) => {
    const next = { ...assistant, ...patch, updatedAt: nowIso() }
    Object.assign(assistant, next)
    rememberLive(assistant)
    notePersist(assistant)
    useHarbor.setState({
      messages: useHarbor.getState().messages.map((item) => (item.id === assistant.id ? { ...assistant } : item)),
    })
  }
  const persist = () => {
    void store.saveMessage(structuredClone(assistant))
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
      schedulePersist(persist)
    }
    if (draft.stopReason === 'refusal') {
      publish({ status: 'refused', blocks: [], usage: draft.usage, errorMessage: null, thinkingSeconds: clock.seconds() })
    } else {
      publish({ status: 'complete', blocks: draft.blocks.filter(Boolean), usage: draft.usage, errorMessage: null, thinkingSeconds: clock.seconds() })
    }
  } catch (error) {
    const aborted = abort.signal.aborted
    const blocks = draft.blocks.filter(Boolean)
    if (!aborted && classifyApiError(error) === 'network' && !hasStreamOutput(blocks)) {
      dropEmptyNetwork = true
      const user = useHarbor.getState().messages.find((item) => item.id === parentId)
      if (user) {
        hintedUser = { ...user, errorMessage: HINT_NETWORK, updatedAt: nowIso() }
        await store.saveMessage(hintedUser)
      }
      useHarbor.setState({ statusToast: 'networkToasts' })
      restoreLeaf = regenerateParent !== undefined ? (leafBefore ?? parentId) : parentId
      conversation = stamp({ ...conversation, activeLeafId: restoreLeaf })
      await store.saveConversation(conversation)
    } else {
      publish({
        status: aborted ? 'aborted' : 'error',
        blocks,
        usage: draft.usage,
        errorMessage: aborted ? null : (classifyApiError(error) === 'network' && hasStreamOutput(blocks) ? 'code:wip-network' : replyErrorCode(error)),
        thinkingSeconds: clock.seconds(),
      })
    }
  } finally {
    window.clearTimeout(persistTimer)
    persistTimer = 0
    persistDue = 0
    persistFlush = null
    if (dropEmptyNetwork) {
      await store.saveMessage({ ...assistant, status: 'error', errorMessage: null, deletedAt: nowIso(), updatedAt: nowIso() })
    } else {
      await store.saveMessage({ ...assistant })
    }
    clearLiveSnap()
    persistMessage = null
    clearLive(assistant.id)
    abort = null
    const usages = []
    for (const item of await store.listConversations()) {
      for (const message of await store.listMessages(item.id)) {
        usages.push(message.usage)
      }
    }
    if (dropEmptyNetwork) {
      useHarbor.setState({
        messages: useHarbor
          .getState()
          .messages.filter((item) => item.id !== assistant.id)
          .map((item) => (hintedUser && item.id === hintedUser.id ? hintedUser : item)),
        conversations: useHarbor.getState().conversations.map((item) =>
          item.id === conversation.id ? { ...conversation, activeLeafId: restoreLeaf } : item,
        ),
        streaming: false,
        totals: sumUsage(usages),
      })
    } else {
      useHarbor.setState({ streaming: false, totals: sumUsage(usages) })
    }
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
  const stopped = activeId ? await stopOrphanStreams(store, await mergeLiveSnap(store, await store.listMessages(activeId))) : null
  const messages = activeId && stopped ? withLive(activeId, stopped.rows) : []
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
  const loaded = activeId
    ? await api<{ messages: Message[]; liveRun?: { id: string; messageId: string } | null }>(`/api/conversations/${activeId}/messages`)
    : { messages: [] as Message[], liveRun: null }
  const usages = sync.messages.map((message) => message.usage)
  set({ conversations, activeId, messages: loaded.messages, totals: sumUsage(usages), serverMode: true })
  if (loaded.liveRun && serverRunId !== loaded.liveRun.id) void followServerRun(loaded.liveRun.id, loaded.liveRun.messageId)
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

const followServerRun = async (runId: string, assistantId: string) => {
  if (serverRunId === runId && serverAbort) return
  serverRunId = runId
  serverAbort = new AbortController()
  useHarbor.setState({ streaming: true })
  let draft = createDraft()
  const storedSeconds = () => useHarbor.getState().messages.find((item) => item.id === assistantId)?.thinkingSeconds
  // Freeze once thinking ends. Later body events must not recompute now-minus-start.
  let frozen = storedSeconds()
  const remember = (value: number | undefined) => {
    if (frozen !== undefined) return
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) frozen = Math.max(1, Math.round(value))
  }
  const publish = (patch: Partial<Message>) => {
    const thinkingSeconds = frozen ?? patch.thinkingSeconds ?? storedSeconds()
    useHarbor.setState({
      messages: useHarbor.getState().messages.map((item) => (item.id === assistantId ? { ...item, ...patch, thinkingSeconds } : item)),
    })
    const current = useHarbor.getState().messages.find((item) => item.id === assistantId)
    if (current) rememberLive(current)
  }
  try {
    const ended = await readRun(
      runId,
      (event) => {
        draft = reduceEvent(draft, event)
        if (event.type === 'content_block_stop' && draft.blocks[event.index]?.type === 'thinking') remember(event.elapsed_secs)
        if (event.type === 'message_delta' && event.delta.title) {
          const title = event.delta.title
          const conversationId = useHarbor.getState().messages.find((item) => item.id === assistantId)?.conversationId
          useHarbor.setState({
            conversations: useHarbor.getState().conversations.map((item) =>
              item.id === conversationId && item.titleSource !== 'user' ? { ...item, title, titleSource: 'auto' } : item,
            ),
          })
        }
        publish({
          status: 'streaming',
          blocks: draft.blocks.filter(Boolean),
          usage: draft.usage,
          thinkingSeconds: frozen,
        })
      },
      serverAbort.signal,
    )
    const aborted = serverAbort.signal.aborted || ended.status === 'aborted'
    const status = draft.stopReason === 'refusal' ? 'refused' : aborted ? 'aborted' : ended.status === 'error' ? 'error' : 'complete'
    remember(ended.thinkingSeconds)
    publish({
      status,
      blocks: status === 'refused' ? [] : draft.blocks.filter(Boolean),
      usage: draft.usage,
      thinkingSeconds: frozen,
      errorMessage: status === 'error' ? 'interrupted' : null,
    })
  } catch (error) {
    const aborted = serverAbort?.signal.aborted
    publish({
      status: aborted ? 'aborted' : 'error',
      errorMessage: aborted ? null : error instanceof Error ? error.message : 'error',
      blocks: draft.blocks.filter(Boolean),
      thinkingSeconds: storedSeconds(),
    })
  } finally {
    if (serverRunId === runId) {
      serverAbort = null
      serverRunId = null
    }
    clearLive(assistantId)
    useHarbor.setState({ streaming: false })
  }
}

const runServerTurn = async (text: string, regenerateParent: string | null, continueMessageId?: string | null) => {
  const state = useHarbor.getState()
  if (state.streaming) {
    return
  }
  const continued = continueMessageId ? state.messages.find((item) => item.id === continueMessageId) : undefined
  const priorBlocks = continued?.blocks.filter(Boolean) ?? []
  let conversationId = state.activeId
  if (!conversationId || regenerateParent === null && !state.conversations.some((item) => item.id === conversationId)) {
    conversationId = nid()
    await api('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({ id: conversationId, ...withFixedModel(state.prefs) }),
    })
  }
  const files = state.drafts.filter((file) => file.fileId)
  for (const file of files) rememberImage(file.fileId, file.previewUrl)
  fileDrafts.delete(conversationId)
  fileDrafts.delete('')
  rememberActive(conversationId)
  useHarbor.setState({
    streaming: true,
    drafts: [],
    textDrafts: { ...useHarbor.getState().textDrafts, [conversationId]: '', '': '' },
  })
  const started = await api<{ runId: string; userMessageId: string; assistantMessageId: string }>(
    `/api/conversations/${conversationId}/runs`,
    {
      method: 'POST',
      body: JSON.stringify({
        text,
        parentId: regenerateParent,
        continueMessageId: continueMessageId || undefined,
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
  const userMessage: Message | null = regenerateParent || continueMessageId
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
  const assistant: Message = continued
    ? { ...continued, status: 'streaming', errorMessage: null, updatedAt: now }
    : {
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
    messages: continued
      ? state.messages.map((item) => (item.id === continued.id ? assistant : item))
      : [...state.messages.filter((item) => item.conversationId === conversationId), ...(userMessage ? [userMessage] : []), assistant],
  })
  serverAbort = new AbortController()
  let draft = createDraft()
  const clock = createThinkingClock()
  const streamedBlocks = () => (continued ? [...priorBlocks, ...draft.blocks.filter(Boolean)] : draft.blocks.filter(Boolean))
  try {
    const outcome = await readRun(
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
              ? { ...item, blocks: streamedBlocks(), usage: draft.usage, thinkingSeconds: continued?.thinkingSeconds ?? (Math.max(clock.seconds(), item.thinkingSeconds ?? 0) || clock.seconds()) }
              : item,
          ),
        })
        const current = useHarbor.getState().messages.find((item) => item.id === assistant.id)
        if (current) rememberLive(current)
      },
      serverAbort.signal,
    )
    const failed = outcome.status === 'error'
    const status = draft.stopReason === 'refusal' ? 'refused' : serverAbort.signal.aborted ? 'aborted' : failed ? 'error' : 'complete'
    const seconds = continued?.thinkingSeconds ?? (Math.max(clock.seconds(), outcome.thinkingSeconds ?? 0) || undefined)
    useHarbor.setState({
      messages: useHarbor.getState().messages.map((item) =>
        item.id === assistant.id
          ? {
              ...item,
              status,
              blocks: status === 'refused' ? [] : streamedBlocks(),
              usage: draft.usage,
              errorMessage: failed ? 'upstream 400' : null,
              thinkingSeconds: seconds,
            }
          : item,
      ),
    })
  } catch (error) {
    const aborted = serverAbort?.signal.aborted
    useHarbor.setState({
      messages: useHarbor.getState().messages.map((item) =>
        item.id === assistant.id
          ? {
              ...item,
              status: aborted ? 'aborted' : 'error',
              errorMessage: aborted ? null : error instanceof Error ? error.message : 'error',
              blocks: streamedBlocks(),
              thinkingSeconds: Math.max(clock.seconds(), item.thinkingSeconds ?? 0) || item.thinkingSeconds,
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
    clearLive(assistant.id)
    useHarbor.setState({ streaming: false, totals: sumUsage([previous, draft.usage]), quota })
  }
}
