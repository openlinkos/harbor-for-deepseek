import { BRAND, modelSupportsServerTools } from '@deepapi/types'
import type {
  ApiContentBlock,
  ApiMessage,
  ApiTool,
  ChatModel,
  CreateMessageBody,
  Effort,
  FilePurpose,
  Message,
  SafetyLevel,
} from '@deepapi/types'

export const API_ORIGIN = BRAND.apiOrigin
export const FILES_BETA = 'files-api-2025-04-14'

/** Official web chat does not send a client persona or a clock. */
export const HARBOR_SYSTEM_PROMPT = ''

/** Official web chat does not inject a client clock or persona. */
export const harborSystemPrompt = (_input: { locale?: string; timeZone?: string; now?: Date } = {}): string => ''

export type TurnOptions = {
  model: ChatModel
  thinking: boolean
  search: boolean
  readLink: boolean
  effort: Effort
  safetyLevel: SafetyLevel
  requestTitle: boolean
  messages: Message[]
  locale?: 'zh' | 'en'
  timeZone?: string
  now?: Date
  /** Continuation retry: the partial assistant thinking block made upstream return 400. */
  dropThinking?: boolean
}

const replayAssistant = (message: Message): ApiContentBlock[] => {
  const blocks: ApiContentBlock[] = []
  for (const block of message.blocks) {
    if (block.type === 'text') {
      if (block.text) {
        blocks.push({ type: 'text', text: block.text })
      }
    } else if (block.type === 'thinking') {
      blocks.push({ type: 'thinking', thinking: block.thinking, signature: block.signature })
    } else if (
      block.type === 'server_tool_use' ||
      block.type === 'web_search_tool_result' ||
      block.type === 'web_fetch_tool_result'
    ) {
      blocks.push(block)
    }
  }
  return blocks
}

const replayUser = (message: Message): ApiMessage | null => {
  const files = message.blocks.filter((block) => block.type === 'file_ref')
  const text = message.blocks
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim()
  if (files.length === 0) {
    return text ? { role: 'user', content: text } : null
  }
  const content: ApiContentBlock[] = []
  if (text) {
    content.push({ type: 'text', text })
  }
  for (const file of files) {
    if (file.type !== 'file_ref' || !file.fileId.startsWith('file-')) {
      continue
    }
    content.push({
      type: file.media === 'image' ? 'image' : 'document',
      source: { type: 'file', file_id: file.fileId },
    })
  }
  return content.length ? { role: 'user', content } : null
}

/** A partial reply that called web search or read-url cannot be continued (the API returns 400). */
export const messageUsedWebTool = (message: Pick<Message, 'blocks'>): boolean =>
  message.blocks.some(
    (block) =>
      block.type === 'server_tool_use' ||
      block.type === 'web_search_tool_result' ||
      block.type === 'web_fetch_tool_result',
  )

/** Full blocks are stored locally and sent back, including signatures. Refusals and errors stay out. */
export const toApiMessages = (messages: Message[], options?: { dropThinking?: boolean }): ApiMessage[] => {
  const api: ApiMessage[] = []
  for (const message of messages) {
    if (message.deletedAt || message.status === 'refused' || message.status === 'error') {
      continue
    }
    if (message.status === 'streaming') {
      continue
    }
    if (message.role === 'user') {
      const replay = replayUser(message)
      if (replay) {
        api.push(replay)
      }
      continue
    }
    const content = replayAssistant(message).filter((block) => !(options?.dropThinking && block.type === 'thinking'))
    if (content.length) {
      api.push({ role: 'assistant', content })
    }
  }
  return api
}

export const buildRequest = (options: TurnOptions): CreateMessageBody => {
  const tools: ApiTool[] = []
  if (modelSupportsServerTools(options.model)) {
    if (options.search) {
      tools.push({ type: 'deepseek_web_search', name: 'deepseek_web_search' })
    }
    if (options.readLink) {
      tools.push({ type: 'deepseek_read_url', name: 'deepseek_read_url' })
    }
  }
  const system = harborSystemPrompt({ locale: options.locale, timeZone: options.timeZone, now: options.now })
  return {
    model: options.model,
    stream: true,
    ...(system ? { system } : {}),
    messages: toApiMessages(options.messages, { dropThinking: options.dropThinking }),
    thinking: { type: options.thinking ? 'enabled' : 'disabled' },
    ...(tools.length ? { tools } : {}),
    safety_check: { level: options.safetyLevel },
    ...(options.requestTitle ? { title: { enabled: true } } : {}),
    output_config: { effort: options.effort },
  }
}

/** Images and plain text stay `user_data`. PDF, Office, and other parsed files always use rich layout. */
export const purposeForFile = (
  filename: string,
  mime: string,
): { purpose: FilePurpose; media: 'image' | 'document' } => {
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(filename)) {
    return { purpose: 'user_data', media: 'image' }
  }
  if (/\.(txt|md|csv|json|log)$/i.test(filename) || mime.startsWith('text/')) {
    return { purpose: 'user_data', media: 'document' }
  }
  return { purpose: 'rich_layout_recognition', media: 'document' }
}
