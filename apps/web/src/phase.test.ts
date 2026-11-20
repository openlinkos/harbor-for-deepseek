import { describe, expect, it } from 'vitest'
import type { ContentBlock, Message } from '@deepapi/types'
import { livePhase, phaseOf, stoppedInTitle } from './phase.js'
import { createThinkingClock } from './thinkingClock.js'

const message = (status: Message['status'], blocks: ContentBlock[]): Pick<Message, 'status' | 'blocks'> => ({ status, blocks })
const think = (text = '想'): ContentBlock => ({ type: 'thinking', thinking: text, signature: '' })
const search = (): ContentBlock => ({ type: 'server_tool_use', id: 's', name: 'deepseek_web_search', input: { action: 'search', queries: ['q'] } })
const results = (): ContentBlock => ({
  type: 'web_search_tool_result',
  tool_use_id: 's',
  content: [{ type: 'web_search_result', title: 't', url: 'https://example.com' }],
})
const openPage = (): ContentBlock => ({ type: 'server_tool_use', id: 'f', name: 'deepseek_web_fetch', input: { action: 'open_page', url: 'https://example.com' } })
const find = (): ContentBlock => ({ type: 'server_tool_use', id: 'g', name: 'deepseek_web_fetch', input: { action: 'find_in_page', url: 'https://example.com', pattern: 'x' } })
const answer = (text = '正文'): ContentBlock => ({ type: 'text', text })

describe('phaseOf', () => {
  it('walks pending → thinking → searching → browsing → done, and keeps finding', () => {
    expect(phaseOf(message('streaming', []))).toBe('pending')
    expect(phaseOf(message('streaming', [think()]))).toBe('thinking')
    expect(phaseOf(message('streaming', [think(), search()]))).toBe('searching')
    expect(phaseOf(message('streaming', [think(), search(), results()]))).toBe('searching')
    expect(phaseOf(message('streaming', [think(), search(), results(), openPage()]))).toBe('browsing')
    expect(livePhase('browsing')).toBe(true)
    expect(phaseOf(message('streaming', [think(), find()]))).toBe('finding')
    expect(phaseOf(message('streaming', [think(), answer()]))).toBe('done')
    expect(livePhase('done')).toBe(false)
    expect(phaseOf(message('complete', [think(), answer()]))).toBe('done')
  })

  it('does not call a streaming thought "已思考", even after the thinking block stops', () => {
    const open = message('streaming', [think('第一句')])
    expect(phaseOf(open)).toBe('thinking')
    expect(phaseOf({ ...open, blocks: [think('')] })).toBe('thinking')
    expect(phaseOf(message('streaming', []))).toBe('pending')
    expect(livePhase(phaseOf(open))).toBe(true)
  })

  it('uses 已停止 only when the reply was aborted before any answer', () => {
    const aborted = message('aborted', [think()])
    expect(phaseOf(aborted)).toBe('stopped')
    expect(stoppedInTitle(aborted)).toBe(true)
    expect(stoppedInTitle(message('aborted', []))).toBe(false)
    expect(phaseOf(message('aborted', [think(), answer()]))).toBe('done')
  })
})

describe('thinking clock', () => {
  it('sums thinking fragments and ignores time after the fragment stops', () => {
    let t = 1_000
    const clock = createThinkingClock(() => t)
    const blocks: ContentBlock[] = [think()]
    clock.onEvent({ type: 'content_block_start', index: 0, content_block: blocks[0]! }, blocks)
    t = 4_200
    clock.onEvent({ type: 'content_block_stop', index: 0 }, blocks)
    t = 9_000
    expect(clock.seconds()).toBe(3)
  })

  it('rounds and keeps at least one second', () => {
    let t = 0
    const clock = createThinkingClock(() => t)
    const blocks: ContentBlock[] = [think()]
    clock.onEvent({ type: 'content_block_start', index: 0, content_block: blocks[0]! }, blocks)
    t = 400
    clock.onEvent({ type: 'content_block_stop', index: 0 }, blocks)
    expect(clock.seconds()).toBe(1)
  })

  it('prefers a positive duration the API reports', () => {
    let t = 0
    const clock = createThinkingClock(() => t)
    const blocks: ContentBlock[] = [{ type: 'thinking', thinking: '想', signature: '', elapsed_secs: 3 }]
    clock.onEvent({ type: 'content_block_start', index: 0, content_block: blocks[0]! }, blocks)
    t = 9_000
    clock.onEvent({ type: 'content_block_stop', index: 0 }, blocks)
    clock.onEvent({ type: 'message_delta', delta: { stop_reason: 'end_turn', thinking_elapsed_secs: 3 } }, blocks)
    expect(clock.seconds()).toBe(3)
  })
})
