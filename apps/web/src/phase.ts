import type { ContentBlock, Message } from '@deepapi/types'

/** Collapsible title while a reply is in flight, then the settled title. */
export type ThinkPhase = 'pending' | 'thinking' | 'searching' | 'browsing' | 'done' | 'stopped'

/** Fragment kinds in useCollapsibleAreaTitle (main.5a15ff2247.js). */
export type OfficialFragment = {
  type: 'THINK' | 'TIP' | 'TOOL_SEARCH' | 'TOOL_OPEN' | 'TOOL_FIND' | 'SEARCH' | 'OTHER'
  status: 'WIP' | 'FINISHED'
}

const hasAnswer = (blocks: ContentBlock[]) => blocks.some((block) => block.type === 'text' && block.text.trim().length > 0)

/**
 * useCollapsibleAreaTitle from the frozen bundle. Response text wins. Otherwise a
 * message that is no longer WIP is 「已停止」. While WIP, only the last collapsible
 * fragment matters, and TOOL_OPEN / TOOL_FIND / TOOL_SEARCH show their live title
 * only while that fragment's status is still "WIP".
 */
export const officialCollapsibleTitle = (input: {
  wip: boolean
  hasResponse: boolean
  fragments: OfficialFragment[]
}): Exclude<ThinkPhase, 'pending'> => {
  if (input.hasResponse) return 'done'
  if (!input.wip) return 'stopped'
  const last = input.fragments.at(-1)
  if (!last || last.type === 'TIP') return 'thinking'
  switch (last.type) {
    case 'THINK':
      return 'thinking'
    case 'TOOL_SEARCH':
      return last.status === 'WIP' ? 'searching' : 'thinking'
    case 'TOOL_OPEN':
    case 'TOOL_FIND':
      return last.status === 'WIP' ? 'browsing' : 'thinking'
    case 'SEARCH':
      return 'searching'
    default:
      return 'thinking'
  }
}

const fragmentsOf = (blocks: ContentBlock[]): OfficialFragment[] => {
  const fragments: OfficialFragment[] = []
  const byId = new Map<string, OfficialFragment>()
  for (const block of blocks) {
    if (!block || (block.type === 'text' && !block.text.trim())) continue
    if (block.type === 'thinking') {
      fragments.push({ type: 'THINK', status: 'FINISHED' })
      continue
    }
    if (block.type === 'server_tool_use') {
      const action = block.input && typeof block.input === 'object' ? block.input.action : undefined
      const type: OfficialFragment['type'] =
        action === 'search' ? 'TOOL_SEARCH'
        : action === 'open_page' || action === 'read_link' ? 'TOOL_OPEN'
        : action === 'find_in_page' ? 'TOOL_FIND'
        : 'OTHER'
      const fragment: OfficialFragment = { type, status: type === 'OTHER' ? 'FINISHED' : 'WIP' }
      fragments.push(fragment)
      if (block.id) byId.set(block.id, fragment)
      continue
    }
    if (block.type === 'web_search_tool_result') {
      const fragment = byId.get(block.tool_use_id) ?? [...fragments].reverse().find((item) => item.type === 'TOOL_SEARCH' && item.status === 'WIP')
      if (fragment) fragment.status = 'FINISHED'
      continue
    }
    if (block.type === 'web_fetch_tool_result') {
      const fragment = byId.get(block.tool_use_id) ?? [...fragments].reverse().find((item) => (item.type === 'TOOL_OPEN' || item.type === 'TOOL_FIND') && item.status === 'WIP')
      if (fragment) fragment.status = 'FINISHED'
    }
  }
  return fragments
}

export const phaseOf = (message: Pick<Message, 'status' | 'blocks'>): ThinkPhase => {
  const wip = message.status === 'streaming'
  const title = officialCollapsibleTitle({
    wip,
    hasResponse: hasAnswer(message.blocks),
    fragments: fragmentsOf(message.blocks),
  })
  if (title === 'thinking' && wip && message.blocks.length === 0) return 'pending'
  return title
}

export const livePhase = (phase: ThinkPhase) => phase === 'thinking' || phase === 'searching' || phase === 'browsing'

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
