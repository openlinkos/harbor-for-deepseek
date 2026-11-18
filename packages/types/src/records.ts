import type { ChatModel, ContentBlock, Effort, FilePurpose, Usage } from './api.js'

export type MessageStatus = 'complete' | 'streaming' | 'error' | 'aborted' | 'refused'

export type MessageRole = 'user' | 'assistant'

/** Fields a later sync backend can merge without a second schema. */
export type SyncFields = {
  rev: number
  updatedAt: string
  deletedAt: string | null
}

export type Conversation = SyncFields & {
  id: string
  title: string
  /** user: renamed locally. auto: filled from the API title. default: still untitled. */
  titleSource: 'user' | 'auto' | 'default'
  model: ChatModel
  thinking: boolean
  search: boolean
  readLink: boolean
  effort: Effort
  pinned: boolean
  archived: boolean
  activeLeafId: string | null
  createdAt: string
}

export type Message = SyncFields & {
  id: string
  conversationId: string
  parentId: string | null
  role: MessageRole
  status: MessageStatus
  blocks: ContentBlock[]
  /** Final usage from message_delta only. Never message_start. */
  usage: Usage | null
  errorMessage: string | null
  createdAt: string
}

export type Tombstone = {
  key: string
  entity: 'conversation' | 'message'
  id: string
  rev: number
  deletedAt: string
}

export type Settings = {
  locale: 'zh' | 'en'
  safetyLevel: 'high' | 'low'
  /** Whole days. The API allows 3600–2592000 seconds; the client clamps. */
  fileExpireDays: number
  documentPurpose: Extract<FilePurpose, 'rich_layout_recognition' | 'text_recognition'>
  acknowledgedKeyRisk: boolean
  deviceId: string
}

export const DEFAULT_FILE_EXPIRE_DAYS = 7

export const defaultSettings = (deviceId: string): Settings => ({
  locale: 'zh',
  safetyLevel: 'high',
  fileExpireDays: DEFAULT_FILE_EXPIRE_DAYS,
  documentPurpose: 'rich_layout_recognition',
  acknowledgedKeyRisk: false,
  deviceId,
})

export type SealedSecret =
  | { v: 1; enc: false; value: string }
  | { v: 1; enc: true; salt: string; iv: string; ciphertext: string; iterations: number }

export type NativeArchive = {
  format: 'harbor'
  version: 1
  exportedAt: string
  app: 'harbor'
  conversations: Array<Conversation & { messages: Message[] }>
}
