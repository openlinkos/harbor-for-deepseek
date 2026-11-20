import type { ContentBlock, StreamEvent, TextBlock, ThinkingBlock, Usage } from '@deepapi/types'

export type AssistantDraft = {
  requestId: string | null
  model: string | null
  blocks: ContentBlock[]
  /** Usage from message_delta. message_start usage is ignored on purpose. */
  usage: Usage | null
  /** The early usage, kept only so tests can prove it was not promoted. */
  startedUsage: Usage | null
  stopReason: string | null
  title: string | null
  stopped: boolean
}

export const createDraft = (): AssistantDraft => ({
  requestId: null,
  model: null,
  blocks: [],
  usage: null,
  startedUsage: null,
  stopReason: null,
  title: null,
  stopped: false,
})

const asText = (block: ContentBlock | undefined): TextBlock =>
  block && block.type === 'text' ? block : { type: 'text', text: '' }

const asThinking = (block: ContentBlock | undefined): ThinkingBlock =>
  block && block.type === 'thinking' ? block : { type: 'thinking', thinking: '', signature: '' }

export const reduceEvent = (draft: AssistantDraft, event: StreamEvent): AssistantDraft => {
  switch (event.type) {
    case 'message_start':
      return {
        ...draft,
        requestId: event.message.id ?? draft.requestId,
        model: event.message.model ?? draft.model,
        startedUsage: event.message.usage ?? draft.startedUsage,
      }
    case 'content_block_start': {
      const blocks = draft.blocks.slice()
      blocks[event.index] = structuredClone(event.content_block)
      return { ...draft, blocks }
    }
    case 'content_block_delta': {
      const blocks = draft.blocks.slice()
      const current = blocks[event.index]
      if (event.delta.type === 'text_delta') {
        const text = asText(current)
        blocks[event.index] = { ...text, text: text.text + event.delta.text }
      } else if (event.delta.type === 'thinking_delta') {
        const thinking = asThinking(current)
        blocks[event.index] = { ...thinking, thinking: thinking.thinking + event.delta.thinking }
      } else if (event.delta.type === 'signature_delta') {
        const thinking = asThinking(current)
        blocks[event.index] = { ...thinking, signature: event.delta.signature }
      } else if (event.delta.type === 'citations_delta') {
        const text = asText(current)
        const citation = { ...event.delta.citation, at: text.text.length }
        blocks[event.index] = {
          ...text,
          citations: [...(text.citations ?? []), citation],
        }
      }
      return { ...draft, blocks }
    }
    case 'content_block_stop':
      return draft
    case 'message_delta':
      return {
        ...draft,
        stopReason: event.delta.stop_reason ?? draft.stopReason,
        title: event.delta.title ?? draft.title,
        usage: event.usage ?? draft.usage,
      }
    case 'message_stop':
      return { ...draft, stopped: true }
    case 'ping':
      return draft
    default:
      return draft
  }
}

export const reduceEvents = (events: StreamEvent[]): AssistantDraft =>
  events.reduce(reduceEvent, createDraft())
