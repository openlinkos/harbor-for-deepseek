import { buildRequest, clampExpireSeconds, createClient, purposeForFile } from '@harbor/api-client'
import { exportNative, planNativeImport, readNative } from '@harbor/archive-native'
import { exportV3, importV3 } from '@harbor/archive-v3'
import { estimateCost, sumUsage } from '@harbor/pricing'
import { createDraft, reduceEvent } from '@harbor/sse'
import { openIndexedRepository, openSecret, sealSecret } from '@harbor/storage'
import type { Repository } from '@harbor/storage'
import {
  activePath,
  childIds,
  defaultSettings,
  type Balance,
  type Conversation,
  type Effort,
  type Message,
  type Settings,
  type Usage,
} from '@harbor/types'
import { create } from 'zustand'

const client = createClient()
let repo: Repository | null = null
let abort: AbortController | null = null
let persistTimer = 0

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

type Prefs = Pick<Conversation, 'model' | 'thinking' | 'search' | 'readLink' | 'effort'>

const defaultPrefs = (): Prefs => ({
  model: 'deepseek-flash',
  thinking: true,
  search: false,
  readLink: false,
  effort: 'high',
})

const nowIso = () => new Date().toISOString()
const nid = () => crypto.randomUUID()

const blankConversation = (prefs: Prefs): Conversation => {
  const now = nowIso()
  return {
    id: nid(),
    title: '',
    titleSource: 'default',
    ...prefs,
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
  rename: (id: string, title: string) => Promise<void>
  removeChat: (id: string) => Promise<void>
  selectSibling: (messageId: string, siblingId: string) => Promise<void>
  send: (text: string) => Promise<void>
  regenerate: (assistantId: string) => Promise<void>
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
  prefs: defaultPrefs(),
  drafts: [],

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
      prefs: conversations[0]
        ? {
            model: conversations[0].model,
            thinking: conversations[0].thinking,
            search: conversations[0].search,
            readLink: conversations[0].readLink,
            effort: conversations[0].effort,
          }
        : defaultPrefs(),
    })
    if (key) {
      void get().refreshBalance()
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
    if (prefs.model !== 'deepseek-flash') {
      prefs.search = false
      prefs.readLink = false
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
    set({ activeId: null, messages: [], drafts: [], sidebarOpen: false, prefs: defaultPrefs() })
  },

  async openChat(id) {
    const store = await repository()
    const messages = await store.listMessages(id)
    const conversation = get().conversations.find((item) => item.id === id)
    set({
      activeId: id,
      messages,
      sidebarOpen: false,
      drafts: [],
      prefs: conversation
        ? {
            model: conversation.model,
            thinking: conversation.thinking,
            search: conversation.search,
            readLink: conversation.readLink,
            effort: conversation.effort,
          }
        : get().prefs,
    })
  },

  async rename(id, title) {
    const store = await repository()
    const current = get().conversations.find((item) => item.id === id)
    if (!current) {
      return
    }
    const next = stamp({ ...current, title: title.trim(), titleSource: 'user' as const })
    await store.saveConversation(next)
    set({ conversations: get().conversations.map((item) => (item.id === id ? next : item)) })
  },

  async removeChat(id) {
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
    await (await repository()).saveConversation(next)
    set({
      conversations: get().conversations.map((item) => (item.id === next.id ? next : item)),
    })
    void messageId
  },

  async send(text) {
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
    if (!assistant || get().streaming || !get().key) {
      return
    }
    await runTurn('', assistant.parentId)
  },

  stop() {
    abort?.abort()
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
    const key = get().key
    const settings = get().settings
    if (!key || get().prefs.model !== 'deepseek-flash') {
      return
    }
    const seconds = clampExpireSeconds(settings.fileExpireDays)
    for (const file of files) {
      const localId = nid()
      const mapped = purposeForFile(file.name, file.type, settings.documentPurpose)
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
        const uploaded = await client.uploadFile(key, file, file.name, mapped.purpose, seconds)
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
      `harbor-${payload.exportedAt.slice(0, 10)}.json`,
      new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
    )
  },

  async exportZip() {
    const bytes = exportV3(await collect())
    download(`harbor-${nowIso().slice(0, 10)}.zip`, new Blob([bytes], { type: 'application/zip' }))
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
    { format: 'harbor', version: 1, exportedAt: nowIso(), app: 'harbor', conversations: incoming },
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

const runTurn = async (text: string, regenerateParent?: string | null) => {
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
  conversation = stamp({ ...conversation, ...state.prefs, activeLeafId: assistant.id })
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
    model: conversation.model,
    thinking: conversation.thinking,
    search: conversation.search,
    readLink: conversation.readLink,
    effort: conversation.effort as Effort,
    safetyLevel: state.settings.safetyLevel,
    requestTitle: conversation.titleSource !== 'user',
    messages: history,
  })
  abort = new AbortController()
  let draft = createDraft()
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
      })
      window.clearTimeout(persistTimer)
      persistTimer = window.setTimeout(persist, 200)
    }
    if (draft.stopReason === 'refusal') {
      publish({ status: 'refused', blocks: [], usage: draft.usage, errorMessage: null })
    } else {
      publish({ status: 'complete', blocks: draft.blocks.filter(Boolean), usage: draft.usage, errorMessage: null })
    }
  } catch (error) {
    const aborted = abort.signal.aborted
    publish({
      status: aborted ? 'aborted' : 'error',
      blocks: draft.blocks.filter(Boolean),
      usage: draft.usage,
      errorMessage: aborted ? null : error instanceof Error ? error.message : 'error',
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
