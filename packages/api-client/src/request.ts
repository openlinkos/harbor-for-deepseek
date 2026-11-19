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

/** Minimum and maximum file lifetime accepted by POST /files. */
export const FILE_EXPIRE_MIN_SECONDS = 3600
export const FILE_EXPIRE_MAX_SECONDS = 2_592_000
export const DEFAULT_FILE_EXPIRE_SECONDS = 7 * 24 * 3600

export const clampExpireSeconds = (days: number): number => {
  const seconds = Math.round(days * 24 * 3600)
  return Math.min(FILE_EXPIRE_MAX_SECONDS, Math.max(FILE_EXPIRE_MIN_SECONDS, seconds))
}

export const HARBOR_SYSTEM_PROMPT = ''

const ZH_SYSTEM_PROMPT = ''

const timeZoneOrDefault = (timeZone: string | undefined): string => {
  if (!timeZone) {
    return 'Asia/Shanghai'
  }
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date())
    return timeZone
  } catch {
    return 'Asia/Shanghai'
  }
}

/** Date and time go in the system prompt so “today” is not a guess. Chinese UI gets a Chinese prompt. */
export const harborSystemPrompt = (input: { locale?: string; timeZone?: string; now?: Date } = {}): string => {
  const timeZone = timeZoneOrDefault(input.timeZone)
  const now = input.now ?? new Date()
  const stamp = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(now)
  const base = input.locale === 'zh' ? ZH_SYSTEM_PROMPT : HARBOR_SYSTEM_PROMPT
  const clock = `Current date and time: ${stamp} (${timeZone}).`
  return base ? `${base} ${clock}` : clock
}

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

/** Full blocks are stored locally and sent back, including signatures. Refusals and errors stay out. */
export const toApiMessages = (messages: Message[]): ApiMessage[] => {
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
    const content = replayAssistant(message)
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
  return {
    model: options.model,
    stream: true,
    system: harborSystemPrompt({ locale: options.locale, timeZone: options.timeZone, now: options.now }),
    messages: toApiMessages(options.messages),
    thinking: { type: options.thinking ? 'enabled' : 'disabled' },
    ...(tools.length ? { tools } : {}),
    safety_check: { level: options.safetyLevel },
    ...(options.requestTitle ? { title: { enabled: true } } : {}),
    output_config: { effort: options.effort },
  }
}

export const purposeForFile = (
  filename: string,
  mime: string,
  documentPurpose: FilePurpose,
): { purpose: FilePurpose; media: 'image' | 'document' } => {
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(filename)) {
    return { purpose: 'user_data', media: 'image' }
  }
  if (/\.(txt|md|csv|json|log)$/i.test(filename) || mime.startsWith('text/')) {
    return { purpose: 'user_data', media: 'document' }
  }
  const purpose = documentPurpose === 'text_recognition' ? 'text_recognition' : 'rich_layout_recognition'
  return { purpose, media: 'document' }
}
