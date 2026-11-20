import type { ChatModel, ContentBlock, Effort, Usage } from './api.js'

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
  /**
   * Rounded thinking seconds for 「用时 N 秒」.
   * The API total when the stream reports one; otherwise the summed thinking-fragment time.
   */
  thinkingSeconds?: number
  /** Server clock when the first thinking block opened. Reconnect uses this instead of a partial duration. */
  thinkingStartedAt?: string
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
  acknowledgedKeyRisk: boolean
  deviceId: string
}

export const defaultSettings = (deviceId: string): Settings => ({
  locale: 'zh',
  safetyLevel: 'high',
  acknowledgedKeyRisk: false,
  deviceId,
})

export type SealedSecret =
  | { v: 1; enc: false; value: string }
  | { v: 1; enc: true; salt: string; iv: string; ciphertext: string; iterations: number }

export type NativeArchive = {
  format: 'deepapi'
  version: 1
  exportedAt: string
  app: string
  conversations: Array<Conversation & { messages: Message[] }>
}
