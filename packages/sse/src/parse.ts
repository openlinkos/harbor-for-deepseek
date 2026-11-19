import type { ContentBlock, StreamEvent, TextCitation, Usage } from '@deepapi/types'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const num = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0)

export const readUsage = (value: unknown): Usage | undefined => {
  if (!isRecord(value)) {
    return undefined
  }
  const details = isRecord(value.output_tokens_details) ? value.output_tokens_details : undefined
  const tools = isRecord(value.server_tool_use) ? value.server_tool_use : undefined
  return {
    input_tokens: num(value.input_tokens),
    cache_creation_input_tokens: num(value.cache_creation_input_tokens),
    cache_read_input_tokens: num(value.cache_read_input_tokens),
    output_tokens: num(value.output_tokens),
    service_tier: typeof value.service_tier === 'string' ? value.service_tier : 'standard',
    ...(details
      ? {
          output_tokens_details: {
            thinking_tokens: num(details.thinking_tokens),
            safety_tokens: num(details.safety_tokens),
          },
        }
      : {}),
    ...(tools
      ? {
          server_tool_use: {
            web_search_requests: num(tools.web_search_requests),
            web_fetch_requests: num(tools.web_fetch_requests),
            tool_search: num(tools.tool_search),
            tool_fetch: num(tools.tool_fetch),
            tool_image_search: num(tools.tool_image_search),
          },
        }
      : {}),
    ...(typeof value.file_pages === 'number' ? { file_pages: num(value.file_pages) } : {}),
  }
}

const readCitation = (value: unknown): TextCitation | null => {
  if (!isRecord(value)) {
    return null
  }
  return {
    type: 'web_search_result_location',
    url: typeof value.url === 'string' ? value.url : '',
    title: typeof value.title === 'string' ? value.title : null,
    cited_text: typeof value.cited_text === 'string' ? value.cited_text : '',
    encrypted_index: typeof value.encrypted_index === 'string' ? value.encrypted_index : '',
  }
}

/** Accept a stream JSON object. Unknown frames return null so the caller can skip them. */
export const readStreamEvent = (value: unknown): StreamEvent | null => {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return null
  }
  switch (value.type) {
    case 'message_start': {
      const message = isRecord(value.message) ? value.message : {}
      return {
        type: 'message_start',
        message: {
          id: typeof message.id === 'string' ? message.id : undefined,
          model: typeof message.model === 'string' ? message.model : undefined,
          usage: readUsage(message.usage),
        },
      }
    }
    case 'content_block_start': {
      if (!isRecord(value.content_block) || typeof value.content_block.type !== 'string') {
        return null
      }
      return {
        type: 'content_block_start',
        index: num(value.index),
        content_block: value.content_block as ContentBlock,
      }
    }
    case 'content_block_delta': {
      if (!isRecord(value.delta) || typeof value.delta.type !== 'string') {
        return null
      }
      const delta = value.delta
      if (delta.type === 'text_delta') {
        return {
          type: 'content_block_delta',
          index: num(value.index),
          delta: { type: 'text_delta', text: typeof delta.text === 'string' ? delta.text : '' },
        }
      }
      if (delta.type === 'thinking_delta') {
        return {
          type: 'content_block_delta',
          index: num(value.index),
          delta: {
            type: 'thinking_delta',
            thinking: typeof delta.thinking === 'string' ? delta.thinking : '',
          },
        }
      }
      if (delta.type === 'signature_delta') {
        return {
          type: 'content_block_delta',
          index: num(value.index),
          delta: {
            type: 'signature_delta',
            signature: typeof delta.signature === 'string' ? delta.signature : '',
          },
        }
      }
      if (delta.type === 'citations_delta') {
        const citation = readCitation(delta.citation)
        if (!citation) {
          return null
        }
        return {
          type: 'content_block_delta',
          index: num(value.index),
          delta: { type: 'citations_delta', citation },
        }
      }
      if (delta.type === 'input_json_delta') {
        return {
          type: 'content_block_delta',
          index: num(value.index),
          delta: {
            type: 'input_json_delta',
            partial_json: typeof delta.partial_json === 'string' ? delta.partial_json : '',
          },
        }
      }
      return null
    }
    case 'content_block_stop':
      return { type: 'content_block_stop', index: num(value.index) }
    case 'message_delta': {
      const delta = isRecord(value.delta) ? value.delta : {}
      return {
        type: 'message_delta',
        delta: {
          stop_reason: typeof delta.stop_reason === 'string' ? delta.stop_reason : null,
          stop_sequence: typeof delta.stop_sequence === 'string' ? delta.stop_sequence : null,
          ...(typeof delta.title === 'string' ? { title: delta.title } : {}),
        },
        usage: readUsage(value.usage),
      }
    }
    case 'message_stop':
      return { type: 'message_stop' }
    case 'ping':
      return { type: 'ping' }
    default:
      return null
  }
}

export type ApiErrorBody = { message: string; type?: string }

export const readApiError = (value: unknown): ApiErrorBody | null => {
  if (!isRecord(value) || !isRecord(value.error) || typeof value.error.message !== 'string') {
    return null
  }
  return {
    message: value.error.message,
    type: typeof value.error.type === 'string' ? value.error.type : undefined,
  }
}
