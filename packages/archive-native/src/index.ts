import type { ContentBlock, Conversation, Message, NativeArchive } from '@deepapi/types'
import { NATIVE_ARCHIVE_FORMAT, NATIVE_ARCHIVE_VERSION } from '@deepapi/types'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export class ArchiveError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ArchiveError'
  }
}

const stringField = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || !value) {
    throw new ArchiveError(`missing ${field}`)
  }
  return value
}

const conversationFields = (value: Record<string, unknown>): Conversation => ({
  id: stringField(value.id, 'conversation.id'),
  title: typeof value.title === 'string' ? value.title : '',
  titleSource: value.titleSource === 'user' || value.titleSource === 'auto' ? value.titleSource : 'default',
  model: value.model === 'deepseek-v4-pro' ? 'deepseek-v4-pro' : 'deepseek-flash',
  thinking: value.thinking !== false,
  search: value.search === true,
  readLink: value.readLink === true,
  effort: value.effort === 'low' || value.effort === 'max' ? value.effort : 'high',
  pinned: value.pinned === true,
  archived: value.archived === true,
  activeLeafId: typeof value.activeLeafId === 'string' ? value.activeLeafId : null,
  createdAt: stringField(value.createdAt, 'conversation.createdAt'),
  updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : stringField(value.createdAt, 'createdAt'),
  rev: typeof value.rev === 'number' ? value.rev : 1,
  deletedAt: typeof value.deletedAt === 'string' ? value.deletedAt : null,
})

const messageFields = (value: Record<string, unknown>, conversationId: string): Message => ({
  id: stringField(value.id, 'message.id'),
  conversationId,
  parentId: typeof value.parentId === 'string' ? value.parentId : null,
  role: value.role === 'assistant' ? 'assistant' : 'user',
  status:
    value.status === 'streaming' ||
    value.status === 'error' ||
    value.status === 'aborted' ||
    value.status === 'refused'
      ? value.status
      : 'complete',
  blocks: Array.isArray(value.blocks) ? (value.blocks as ContentBlock[]) : [],
  usage: isRecord(value.usage) ? (value.usage as Message['usage']) : null,
  errorMessage: typeof value.errorMessage === 'string' ? value.errorMessage : null,
  ...(typeof value.thinkingSeconds === 'number' && Number.isFinite(value.thinkingSeconds)
    ? { thinkingSeconds: Math.max(1, Math.round(value.thinkingSeconds)) }
    : {}),
  createdAt: stringField(value.createdAt, 'message.createdAt'),
  updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : stringField(value.createdAt, 'createdAt'),
  rev: typeof value.rev === 'number' ? value.rev : 1,
  deletedAt: typeof value.deletedAt === 'string' ? value.deletedAt : null,
})

export const exportNative = (
  conversations: Array<Conversation & { messages: Message[] }>,
  exportedAt: string,
): NativeArchive => ({
  format: NATIVE_ARCHIVE_FORMAT,
  version: NATIVE_ARCHIVE_VERSION,
  exportedAt,
  app: 'deepapi',
  conversations: conversations
    .filter((conversation) => !conversation.deletedAt)
    .map((conversation) => ({
      ...conversation,
      messages: conversation.messages.filter((message) => !message.deletedAt),
    })),
})

export const readNative = (value: unknown): NativeArchive => {
  if (!isRecord(value)) {
    throw new ArchiveError('archive is not an object')
  }
  if ((value.format !== NATIVE_ARCHIVE_FORMAT && value.format !== 'harbor') || value.version !== NATIVE_ARCHIVE_VERSION) {
    throw new ArchiveError('unsupported archive')
  }
  if (!Array.isArray(value.conversations)) {
    throw new ArchiveError('missing conversations')
  }
  const conversations = value.conversations.map((entry) => {
    if (!isRecord(entry)) {
      throw new ArchiveError('bad conversation')
    }
    const conversation = conversationFields(entry)
    const messages = Array.isArray(entry.messages)
      ? entry.messages.map((message) => {
          if (!isRecord(message)) {
            throw new ArchiveError('bad message')
          }
          return messageFields(message, conversation.id)
        })
      : []
    return { ...conversation, messages }
  })
  return {
    format: 'deepapi',
    version: 1,
    exportedAt: typeof value.exportedAt === 'string' ? value.exportedAt : new Date(0).toISOString(),
    app: 'deepapi',
    conversations,
  }
}

export type ImportMode = 'merge' | 'copy'

export type ImportPlan = {
  conversations: Array<Conversation & { messages: Message[] }>
  added: number
  skipped: number
}

const rewrite = (
  conversation: Conversation & { messages: Message[] },
  id: () => string,
): Conversation & { messages: Message[] } => {
  const conversationId = id()
  const map = new Map<string, string>()
  for (const message of conversation.messages) {
    map.set(message.id, id())
  }
  const messages = conversation.messages.map((message) => ({
    ...message,
    id: map.get(message.id) ?? id(),
    conversationId,
    parentId: message.parentId ? (map.get(message.parentId) ?? null) : null,
  }))
  return {
    ...conversation,
    id: conversationId,
    activeLeafId: conversation.activeLeafId ? (map.get(conversation.activeLeafId) ?? null) : null,
    messages,
  }
}

/** Existing conversation ids are skipped. Copy mode mints new ids instead of skipping. */
export const planNativeImport = (
  existingIds: ReadonlySet<string>,
  archive: NativeArchive,
  mode: ImportMode,
  id: () => string = () => crypto.randomUUID(),
): ImportPlan => {
  const conversations: Array<Conversation & { messages: Message[] }> = []
  let skipped = 0
  for (const conversation of archive.conversations) {
    if (conversation.deletedAt) {
      skipped += 1
      continue
    }
    if (mode === 'merge' && existingIds.has(conversation.id)) {
      skipped += 1
      continue
    }
    conversations.push(mode === 'copy' || existingIds.has(conversation.id) ? rewrite(conversation, id) : conversation)
  }
  return { conversations, added: conversations.length, skipped }
}
