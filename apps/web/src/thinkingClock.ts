import type { ContentBlock, StreamEvent } from '@deepapi/types'

/**
 * 「用时 N 秒」.
 * Prefer a positive duration the API reports itself:
 * - `message_delta.thinking_elapsed_secs` or `message_delta.elapsed_secs` (a total, wins)
 * - `thinking.elapsed_secs` on content_block_start
 * - `elapsed_secs` on content_block_stop of a thinking block
 * The public DeepSeek stream does not send those fields today. The fallback is the same
 * formula the official client uses for fragment elapsedSecs: sum each thinking block from
 * content_block_start to content_block_stop, round, and keep at least 1. Search, browse,
 * and answer time are not included.
 */
export const createThinkingClock = (now: () => number = () => performance.now()) => {
  let measured = 0
  let openAt: number | null = null
  let reported: number | null = null
  let locked = false

  const add = (value: number) => {
    if (locked || !(value > 0) || !Number.isFinite(value)) return
    reported = (reported ?? 0) + value
  }
  const total = (value: number) => {
    if (!(value > 0) || !Number.isFinite(value)) return
    reported = value
    locked = true
  }

  return {
    onEvent(event: StreamEvent, blocks: Array<ContentBlock | undefined>) {
      if (event.type === 'content_block_start' && event.content_block.type === 'thinking') {
        if (typeof event.content_block.elapsed_secs === 'number') add(event.content_block.elapsed_secs)
        if (openAt === null) openAt = now()
      }
      if (event.type === 'content_block_stop' && blocks[event.index]?.type === 'thinking') {
        if (typeof event.elapsed_secs === 'number') add(event.elapsed_secs)
        if (openAt !== null) {
          measured += now() - openAt
          openAt = null
        }
      }
      if (event.type === 'message_delta' && typeof event.delta.thinking_elapsed_secs === 'number') {
        total(event.delta.thinking_elapsed_secs)
      }
    },
    seconds() {
      if (reported !== null) return Math.max(1, Math.round(reported))
      const live = openAt === null ? 0 : now() - openAt
      return Math.max(1, Math.round((measured + live) / 1000))
    },
  }
}
