import type { ContentBlock, Message } from '@deepapi/types'

/** Collapsible title while a reply is in flight, then the settled title. */
export type ThinkPhase = 'pending' | 'thinking' | 'searching' | 'browsing' | 'finding' | 'done' | 'stopped'

const hasAnswer = (blocks: ContentBlock[]) => blocks.some((block) => block.type === 'text' && block.text.trim().length > 0)

const toolAction = (block: ContentBlock) =>
  block.type === 'server_tool_use' && block.input && typeof block.input === 'object' ? block.input.action : undefined

/**
 * Official order (useCollapsibleAreaTitle), keyed off the last fragment while the message is still streaming:
 * thinking → searching → browsing (open/read) or finding (find_in_page) → done once answer text exists.
 * Stopped, with no answer, is its own state even if that frame is short.
 */
export const phaseOf = (message: Pick<Message, 'status' | 'blocks'>): ThinkPhase => {
  if (message.status === 'aborted' && !hasAnswer(message.blocks)) return 'stopped'
  if (message.status !== 'streaming' || hasAnswer(message.blocks)) return 'done'
  if (message.blocks.length === 0) return 'pending'
  for (let index = message.blocks.length - 1; index >= 0; index -= 1) {
    const block = message.blocks[index]
    if (!block || (block.type === 'text' && !block.text.trim())) continue
    const action = toolAction(block)
    if (action === 'find_in_page') return 'finding'
    if (action === 'open_page' || action === 'read_link' || block.type === 'web_fetch_tool_result') return 'browsing'
    if (action === 'search' || block.type === 'web_search_tool_result') return 'searching'
    if (block.type === 'thinking') return 'thinking'
  }
  return 'thinking'
}

export const livePhase = (phase: ThinkPhase) =>
  phase === 'thinking' || phase === 'searching' || phase === 'browsing' || phase === 'finding'

/** The stopped title replaces the separate hint once the collapsible header is on screen. */
export const stoppedInTitle = (message: Pick<Message, 'status' | 'blocks'>) => {
  if (phaseOf(message) !== 'stopped') return false
  return message.blocks.some(
    (block) =>
      block.type === 'thinking' ||
      block.type === 'server_tool_use' ||
      block.type === 'web_search_tool_result' ||
      block.type === 'web_fetch_tool_result',
  )
}
