export type ChatModel = 'deepseek-flash' | 'deepseek-v4-pro'

export type SafetyLevel = 'high' | 'low'

export type Effort = 'low' | 'high' | 'max'

/** Request model. Matches the previous settings default and the server column default. */
export const DEFAULT_CHAT_MODEL: ChatModel = 'deepseek-flash'

/** Request reasoning effort. Matches the previous settings default and the server column default. */
export const DEFAULT_EFFORT: Effort = 'high'

export type ThinkingMode = 'enabled' | 'disabled'

/** Server tools exist on deepseek-flash. deepseek-v4-pro is text-only. */
export const modelSupportsServerTools = (model: ChatModel): boolean => model === 'deepseek-flash'

export type TextCitation = {
  type: 'web_search_result_location'
  url: string
  title: string | null
  cited_text: string
  encrypted_index: string
  /** Code units into the text block when the citation arrived. Set locally; the API does not send it. */
  at?: number
}

export type TextBlock = {
  type: 'text'
  text: string
  citations?: TextCitation[]
}

export type ThinkingBlock = {
  type: 'thinking'
  thinking: string
  signature: string
  /** Seconds this fragment took, when the API sends `elapsed_secs`. Absent on the public stream today. */
  elapsed_secs?: number
}

export type ServerToolKind =
  | 'search'
  | 'deep_search'
  | 'read_link'
  | 'image_search'
  | 'deep_image_search'
  | string

export type ServerToolInput =
  | { action: 'search'; query?: string; queries: string[] }
  | { action: 'open_page'; url: string }
  | { action: 'find_in_page'; url: string; pattern: string }
  | { action: 'read_link'; url: string }
  | { action: string; [key: string]: unknown }

export type ServerToolUseBlock = {
  type: 'server_tool_use'
  id: string
  name: string
  input: ServerToolInput
  caller?: { type: string }
  kind?: ServerToolKind
}

export type WebSearchResult = {
  type: 'web_search_result'
  title: string
  url: string
  snippet?: string
  site_name?: string | null
  site_icon?: string | null
  page_age?: string | null
  encrypted_content?: string
  image_url?: string
}

export type WebSearchToolResultError = {
  type: 'web_search_tool_result_error'
  error_code: string
}

export type WebSearchToolResultBlock = {
  type: 'web_search_tool_result'
  tool_use_id: string
  content: Array<WebSearchResult | WebSearchToolResultError>
  kind?: string
}

export type WebFetchResult = {
  type: 'web_fetch_result'
  url: string
  content?: {
    type?: string
    title?: string | null
    source?: { type?: string; media_type?: string; data?: string }
  }
  published_at?: string | null
}

export type WebFetchToolResultError = {
  type: 'web_fetch_tool_result_error'
  error_code: string
}

export type WebFetchToolResultBlock = {
  type: 'web_fetch_tool_result'
  tool_use_id: string
  content: WebFetchResult | WebFetchToolResultError
  kind?: string
  signature?: string
}

/** Local-only attachment reference. Converted to an API file block on send. */
export type FileRefBlock = {
  type: 'file_ref'
  fileId: string
  filename: string
  media: 'image' | 'document'
  purpose: FilePurpose
  bytes: number
  expiresAt: number | null
}

export type ContentBlock =
  | TextBlock
  | ThinkingBlock
  | ServerToolUseBlock
  | WebSearchToolResultBlock
  | WebFetchToolResultBlock
  | FileRefBlock

export type FilePurpose = 'user_data' | 'text_recognition' | 'rich_layout_recognition'

export type StopReason = 'end_turn' | 'max_tokens' | 'tool_use' | 'refusal' | string

export type ServerToolUseCounts = {
  web_search_requests: number
  web_fetch_requests: number
  tool_search: number
  tool_fetch: number
  tool_image_search: number
}

export type Usage = {
  input_tokens: number
  cache_creation_input_tokens: number
  cache_read_input_tokens: number
  output_tokens: number
  service_tier: string
  output_tokens_details?: {
    thinking_tokens?: number
    safety_tokens?: number
  }
  server_tool_use?: ServerToolUseCounts
  /** Present only if a future response includes it. File parsing is otherwise not in message usage. */
  file_pages?: number
}

export type StreamEvent =
  | {
      type: 'message_start'
      message: { id?: string; model?: string; usage?: Usage }
    }
  | {
      type: 'content_block_start'
      index: number
      content_block: ContentBlock
    }
  | {
      type: 'content_block_delta'
      index: number
      delta:
        | { type: 'text_delta'; text: string }
        | { type: 'thinking_delta'; thinking: string }
        | { type: 'signature_delta'; signature: string }
        | { type: 'citations_delta'; citation: TextCitation }
        | { type: 'input_json_delta'; partial_json: string }
    }
  | { type: 'content_block_stop'; index: number; elapsed_secs?: number }
  | {
      type: 'message_delta'
      delta: {
        stop_reason?: StopReason | null
        stop_sequence?: string | null
        title?: string
        /** Total thinking seconds, when the API sends it on message_delta. */
        thinking_elapsed_secs?: number
      }
      usage?: Usage
    }
  | { type: 'message_stop' }
  | { type: 'ping' }

export type BalanceInfo = {
  currency: string
  total_balance: string
  granted_balance: string
  topped_up_balance: string
}

export type Balance = {
  is_available: boolean
  balance_infos: BalanceInfo[]
}

export type ModelInfo = {
  id: string
  object?: string
  owned_by?: string
}

export type UploadedFile = {
  id: string
  bytes: number
  created_at: number
  filename: string
  purpose: string
  expires_at: number | null
}

export type ApiTool =
  | { type: 'deepseek_web_search'; name: 'deepseek_web_search' }
  | { type: 'deepseek_read_url'; name: 'deepseek_read_url' }

export type ApiContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'file'; file_id: string } }
  | { type: 'document'; source: { type: 'file'; file_id: string } }
  | ThinkingBlock
  | ServerToolUseBlock
  | WebSearchToolResultBlock
  | WebFetchToolResultBlock

export type ApiMessage =
  | { role: 'user'; content: string | ApiContentBlock[] }
  | { role: 'assistant'; content: ApiContentBlock[] }

export type CreateMessageBody = {
  model: ChatModel
  stream: true
  system?: string
  messages: ApiMessage[]
  thinking: { type: ThinkingMode }
  tools?: ApiTool[]
  safety_check: { level: SafetyLevel }
  title?: { enabled: boolean }
  output_config?: { effort: Effort }
}
