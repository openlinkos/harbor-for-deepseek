import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate'
import type { ContentBlock, Conversation, Message } from '@deepapi/types'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export class V3ArchiveError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'V3ArchiveError'
  }
}

type V3Fragment = Record<string, unknown>

type V3Message = {
  id: number
  parent_id: number | null
  role: 'USER' | 'ASSISTANT'
  status: string
  thinking_enabled: boolean
  search_enabled: boolean
  accumulated_token_usage: number
  inserted_at: string
  fragments: V3Fragment[]
}

type V3Session = {
  id: string
  title: string | null
  pinned: boolean
  current_message_id: number
  inserted_at: string
  updated_at: string
  messages: V3Message[]
}

const numberMessages = (messages: Message[]): Map<string, number> => {
  const ids = new Map<string, number>()
  const pending = messages.filter((message) => !message.deletedAt)
  let next = 1
  while (pending.length) {
    const ready = pending.filter((message) => !message.parentId || ids.has(message.parentId))
    if (!ready.length) {
      break
    }
    ready.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    for (const message of ready) {
      ids.set(message.id, next)
      next += 1
      pending.splice(pending.indexOf(message), 1)
    }
  }
  return ids
}

const fragmentsOf = (message: Message): V3Fragment[] => {
  if (message.role === 'user') {
    const text = message.blocks
      .filter((block) => block.type === 'text')
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('\n')
    const files = message.blocks.filter((block) => block.type === 'file_ref')
    const fragments: V3Fragment[] = []
    if (text) {
      fragments.push({ type: 'REQUEST', content: text })
    }
    if (files.length) {
      fragments.push({
        type: 'FILE',
        files: files.flatMap((block) =>
          block.type === 'file_ref'
            ? [
                {
                  id: block.fileId,
                  file_name: block.filename,
                  file_size: block.bytes,
                  token_usage: null,
                  inserted_at: message.createdAt,
                  export_path: null,
                  is_image: block.media === 'image',
                  width: null,
                  height: null,
                },
              ]
            : [],
        ),
      })
    }
    return fragments
  }
  const fragments: V3Fragment[] = []
  for (const block of message.blocks) {
    if (block.type === 'thinking' && block.thinking) {
      fragments.push({ type: 'THINK', content: block.thinking, elapsed_secs: null })
    } else if (block.type === 'text' && block.text) {
      fragments.push({ type: 'RESPONSE', content: block.text })
    } else if (block.type === 'server_tool_use' && block.input.action === 'search') {
      const queries = 'queries' in block.input && Array.isArray(block.input.queries) ? block.input.queries : []
      fragments.push({ type: 'TOOL_SEARCH', queries, results: [], status: 'FINISHED' })
    } else if (block.type === 'web_search_tool_result') {
      const results = block.content.flatMap((item) =>
        item.type === 'web_search_result'
          ? [
              {
                url: item.url,
                title: item.title,
                snippet: item.snippet ?? '',
                published_at: item.page_age ?? null,
                site_name: item.site_name ?? null,
                site_icon: item.site_icon ?? null,
              },
            ]
          : [],
      )
      const previous = fragments.at(-1)
      if (previous?.type === 'TOOL_SEARCH' && Array.isArray(previous.results) && previous.results.length === 0) {
        previous.results = results
      } else {
        fragments.push({ type: 'TOOL_SEARCH', queries: [], results, status: 'FINISHED' })
      }
    } else if (block.type === 'server_tool_use' && block.input.action === 'open_page') {
      fragments.push({
        type: 'TOOL_OPEN',
        status: 'FINISHED',
        url: 'url' in block.input ? block.input.url : null,
        title: null,
        published_at: null,
      })
    } else if (block.type === 'web_fetch_tool_result' && block.kind === 'read_link') {
      const content = block.content
      fragments.push({
        type: 'READ_LINK',
        results: [
          {
            signature: block.signature ?? '',
            url: 'url' in content ? content.url : undefined,
            title: 'content' in content ? (content.content?.title ?? null) : null,
          },
        ],
      })
    }
  }
  return fragments
}

const statusOf = (message: Message): string => {
  if (message.status === 'refused') {
    return 'CONTENT_FILTER'
  }
  if (message.status === 'error') {
    return 'FAILED'
  }
  if (message.status === 'aborted' || message.status === 'streaming') {
    return 'INCOMPLETE'
  }
  return 'FINISHED'
}

export const exportV3 = (conversations: Array<Conversation & { messages: Message[] }>): Uint8Array => {
  const entries: Record<string, Uint8Array> = {
    'manifest.json': strToU8(JSON.stringify({ export_format_version: 3 })),
  }
  const index = []
  for (const conversation of conversations) {
    if (conversation.deletedAt) {
      continue
    }
    const numbers = numberMessages(conversation.messages)
    const messages: V3Message[] = conversation.messages
      .filter((message) => numbers.has(message.id))
      .map((message): V3Message => ({
        id: numbers.get(message.id) ?? 0,
        parent_id: message.parentId ? (numbers.get(message.parentId) ?? null) : null,
        role: message.role === 'assistant' ? 'ASSISTANT' : 'USER',
        status: statusOf(message),
        thinking_enabled: conversation.thinking,
        search_enabled: conversation.search,
        accumulated_token_usage: message.usage
          ? message.usage.input_tokens + message.usage.cache_read_input_tokens + message.usage.output_tokens
          : 0,
        inserted_at: message.createdAt,
        fragments: fragmentsOf(message),
      }))
      .sort((a, b) => a.id - b.id)
    const current =
      (conversation.activeLeafId && numbers.get(conversation.activeLeafId)) || messages.at(-1)?.id || 0
    const session: V3Session = {
      id: conversation.id,
      title: conversation.title || null,
      pinned: conversation.pinned,
      current_message_id: current,
      inserted_at: conversation.createdAt,
      updated_at: conversation.updatedAt,
      messages,
    }
    entries[`chat_sessions/${conversation.id}.json`] = strToU8(JSON.stringify(session))
    index.push({
      id: conversation.id,
      title: conversation.title || null,
      pinned: conversation.pinned,
      message_count: messages.length,
      inserted_at: conversation.createdAt,
      updated_at: conversation.updatedAt,
    })
  }
  entries['chat_session_index.json'] = strToU8(JSON.stringify(index))
  return zipSync(entries)
}

const blocksFromFragments = (fragments: V3Fragment[]): ContentBlock[] => {
  const blocks: ContentBlock[] = []
  for (const fragment of fragments) {
    const type = fragment.type
    if (type === 'REQUEST' || type === 'RESPONSE') {
      blocks.push({ type: 'text', text: typeof fragment.content === 'string' ? fragment.content : '' })
    } else if (type === 'THINK') {
      blocks.push({
        type: 'thinking',
        thinking: typeof fragment.content === 'string' ? fragment.content : '',
        signature: '',
      })
    } else if (type === 'TOOL_SEARCH') {
      const queries = Array.isArray(fragment.queries) ? fragment.queries.filter((item) => typeof item === 'string') : []
      const results = Array.isArray(fragment.results) ? fragment.results : []
      blocks.push({
        type: 'server_tool_use',
        id: `v3-search-${blocks.length}`,
        name: 'deepseek_web_search',
        input: { action: 'search', queries: queries as string[] },
        caller: { type: 'direct' },
        kind: 'search',
      })
      blocks.push({
        type: 'web_search_tool_result',
        tool_use_id: `v3-search-${blocks.length - 1}`,
        kind: 'search',
        content: results.flatMap((item) => {
          if (!isRecord(item) || typeof item.url !== 'string') {
            return []
          }
          return [
            {
              type: 'web_search_result' as const,
              title: typeof item.title === 'string' ? item.title : item.url,
              url: item.url,
              snippet: typeof item.snippet === 'string' ? item.snippet : '',
              site_name: typeof item.site_name === 'string' ? item.site_name : null,
              site_icon: typeof item.site_icon === 'string' ? item.site_icon : null,
              page_age: typeof item.published_at === 'string' ? item.published_at : null,
            },
          ]
        }),
      })
    } else if (type === 'TOOL_OPEN') {
      blocks.push({
        type: 'server_tool_use',
        id: `v3-open-${blocks.length}`,
        name: 'deepseek_web_search',
        input: { action: 'open_page', url: typeof fragment.url === 'string' ? fragment.url : '' },
        kind: 'deep_search',
      })
    } else if (type === 'READ_LINK' && Array.isArray(fragment.results)) {
      for (const result of fragment.results) {
        if (!isRecord(result)) {
          continue
        }
        const url = typeof result.url === 'string' ? result.url : ''
        blocks.push({
          type: 'server_tool_use',
          id: `v3-read-${blocks.length}`,
          name: 'deepseek_read_url',
          input: { action: 'read_link', url },
          kind: 'read_link',
        })
        blocks.push({
          type: 'web_fetch_tool_result',
          tool_use_id: `v3-read-${blocks.length - 1}`,
          kind: 'read_link',
          signature: typeof result.signature === 'string' ? result.signature : '',
          content: {
            type: 'web_fetch_result',
            url,
            content: { title: typeof result.title === 'string' ? result.title : null },
          },
        })
      }
    } else if (type === 'FILE' && Array.isArray(fragment.files)) {
      for (const file of fragment.files) {
        if (!isRecord(file)) {
          continue
        }
        blocks.push({
          type: 'file_ref',
          fileId: typeof file.id === 'string' ? file.id : `v3-file-${blocks.length}`,
          filename: typeof file.file_name === 'string' ? file.file_name : 'file',
          media: file.is_image === true ? 'image' : 'document',
          purpose: 'user_data',
          bytes: typeof file.file_size === 'number' ? file.file_size : 0,
          expiresAt: null,
        })
      }
    }
  }
  return blocks
}

const harborStatus = (status: string): Message['status'] => {
  if (status === 'CONTENT_FILTER') {
    return 'refused'
  }
  if (status === 'FAILED' || status === 'TIMEOUT' || status === 'CONTEXT_LENGTH_EXCEEDED') {
    return 'error'
  }
  if (status === 'INCOMPLETE' || status === 'WIP') {
    return 'aborted'
  }
  return 'complete'
}

export type V3Import = {
  conversations: Array<Conversation & { messages: Message[] }>
}

export const importV3 = (bytes: Uint8Array): V3Import => {
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(bytes)
  } catch {
    throw new V3ArchiveError('not a zip archive')
  }
  const manifestBytes = files['manifest.json']
  if (!manifestBytes) {
    throw new V3ArchiveError('missing manifest')
  }
  const manifest = JSON.parse(strFromU8(manifestBytes)) as unknown
  if (!isRecord(manifest) || manifest.export_format_version !== 3) {
    throw new V3ArchiveError('unsupported export format')
  }
  const conversations: Array<Conversation & { messages: Message[] }> = []
  for (const [path, raw] of Object.entries(files)) {
    if (!path.startsWith('chat_sessions/') || !path.endsWith('.json')) {
      continue
    }
    const session = JSON.parse(strFromU8(raw)) as unknown
    if (!isRecord(session) || typeof session.id !== 'string' || !Array.isArray(session.messages)) {
      throw new V3ArchiveError(`bad session ${path}`)
    }
    const conversationId = `v3:${session.id}`
    const idOf = new Map<number, string>()
    const messages: Message[] = []
    const sorted = [...session.messages].sort((a, b) => {
      const left = isRecord(a) && typeof a.id === 'number' ? a.id : 0
      const right = isRecord(b) && typeof b.id === 'number' ? b.id : 0
      return left - right
    })
    for (const item of sorted) {
      if (!isRecord(item) || typeof item.id !== 'number') {
        continue
      }
      const id = `${conversationId}:${item.id}`
      idOf.set(item.id, id)
    }
    for (const item of sorted) {
      if (!isRecord(item) || typeof item.id !== 'number') {
        continue
      }
      const id = idOf.get(item.id) ?? `${conversationId}:${item.id}`
      const parentId = typeof item.parent_id === 'number' ? (idOf.get(item.parent_id) ?? null) : null
      const inserted = typeof item.inserted_at === 'string' ? item.inserted_at : new Date(0).toISOString()
      messages.push({
        id,
        conversationId,
        parentId,
        role: item.role === 'ASSISTANT' ? 'assistant' : 'user',
        status: harborStatus(typeof item.status === 'string' ? item.status : 'FINISHED'),
        blocks: blocksFromFragments(Array.isArray(item.fragments) ? (item.fragments as V3Fragment[]) : []),
        usage: null,
        errorMessage: null,
        createdAt: inserted,
        updatedAt: inserted,
        rev: 1,
        deletedAt: null,
      })
    }
    const current =
      typeof session.current_message_id === 'number' ? (idOf.get(session.current_message_id) ?? null) : null
    const inserted = typeof session.inserted_at === 'string' ? session.inserted_at : new Date(0).toISOString()
    const updated = typeof session.updated_at === 'string' ? session.updated_at : inserted
    conversations.push({
      id: conversationId,
      title: typeof session.title === 'string' ? session.title : '',
      titleSource: session.title ? 'auto' : 'default',
      model: 'deepseek-flash',
      thinking: true,
      search: false,
      readLink: false,
      effort: 'high',
      pinned: session.pinned === true,
      archived: false,
      activeLeafId: current ?? messages.at(-1)?.id ?? null,
      createdAt: inserted,
      updatedAt: updated,
      rev: 1,
      deletedAt: null,
      messages,
    })
  }
  return { conversations }
}
