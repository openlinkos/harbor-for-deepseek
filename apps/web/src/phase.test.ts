import { describe, expect, it } from 'vitest'
import type { ContentBlock, Message } from '@deepapi/types'
import { livePhase, officialCollapsibleTitle, phaseOf, stoppedInTitle } from './phase.js'
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
const readLink = (): ContentBlock => ({ type: 'server_tool_use', id: 'r', name: 'deepseek_web_fetch', input: { action: 'read_link', url: 'https://example.com' } })
const find = (): ContentBlock => ({ type: 'server_tool_use', id: 'g', name: 'deepseek_web_fetch', input: { action: 'find_in_page', url: 'https://example.com', pattern: 'x' } })
const fetched = (id: string): ContentBlock => ({
  type: 'web_fetch_tool_result',
  tool_use_id: id,
  content: { type: 'web_fetch_result', url: 'https://example.com' },
})
const answer = (text = '正文'): ContentBlock => ({ type: 'text', text })

describe('phaseOf', () => {
  it('walks pending → thinking → searching → browsing → done', () => {
    expect(phaseOf(message('streaming', []))).toBe('pending')
    expect(phaseOf(message('streaming', [think()]))).toBe('thinking')
    expect(phaseOf(message('streaming', [think(), search()]))).toBe('searching')
    expect(phaseOf(message('streaming', [think(), search(), results()]))).toBe('thinking')
    expect(phaseOf(message('streaming', [think(), search(), results(), openPage()]))).toBe('browsing')
    expect(livePhase('browsing')).toBe(true)
    expect(phaseOf(message('streaming', [think(), find()]))).toBe('browsing')
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

describe('official useCollapsibleAreaTitle', () => {
  // Frozen main.5a15ff2247.js useCollapsibleAreaTitle. One row per branch.
  // SEARCH has no separate public block: a WIP web-search tool is that title.
  // TIP has no public block: no fragment and THINK both return 正在思考.
  const rows: Array<{ name: string; status: Message['status']; blocks: ContentBlock[]; phase: ReturnType<typeof phaseOf> }> = [
    { name: 'response fragment while streaming → 已思考', status: 'streaming', blocks: [think(), answer()], phase: 'done' },
    { name: 'response fragment when complete → 已思考', status: 'complete', blocks: [think(), answer()], phase: 'done' },
    { name: 'error with answer still → 已思考', status: 'error', blocks: [think(), answer()], phase: 'done' },
    { name: 'aborted, no answer → 已停止', status: 'aborted', blocks: [think()], phase: 'stopped' },
    { name: 'error, no answer → 已停止', status: 'error', blocks: [think()], phase: 'stopped' },
    { name: 'finished, thinking only → 已停止', status: 'complete', blocks: [think()], phase: 'stopped' },
    { name: 'WIP, no fragment → 正在思考', status: 'streaming', blocks: [], phase: 'pending' },
    { name: 'WIP THINK → 正在思考', status: 'streaming', blocks: [think()], phase: 'thinking' },
    { name: 'WIP TOOL_SEARCH → 正在搜索', status: 'streaming', blocks: [think(), search()], phase: 'searching' },
    { name: 'TOOL_SEARCH result back → 正在思考', status: 'streaming', blocks: [think(), search(), results()], phase: 'thinking' },
    { name: 'WIP TOOL_OPEN → 正在浏览网页', status: 'streaming', blocks: [think(), openPage()], phase: 'browsing' },
    { name: 'WIP read_link is TOOL_OPEN → 正在浏览网页', status: 'streaming', blocks: [think(), readLink()], phase: 'browsing' },
    { name: 'TOOL_OPEN result back → 正在思考', status: 'streaming', blocks: [think(), openPage(), fetched('f')], phase: 'thinking' },
    { name: 'WIP TOOL_FIND → 正在浏览网页', status: 'streaming', blocks: [think(), find()], phase: 'browsing' },
    { name: 'TOOL_FIND result back → 正在思考', status: 'streaming', blocks: [think(), find(), fetched('g')], phase: 'thinking' },
    { name: 'unknown fragment → 正在思考', status: 'streaming', blocks: [think(), { type: 'server_tool_use', id: 'u', name: 'x', input: { action: 'other' } }], phase: 'thinking' },
  ]
  it.each(rows)('$name', ({ status, blocks, phase }) => {
    expect(phaseOf(message(status, blocks))).toBe(phase)
  })

  it('SEARCH stays 正在搜索 and TIP falls back to 正在思考', () => {
    expect(officialCollapsibleTitle({ wip: true, hasResponse: false, fragments: [{ type: 'SEARCH', status: 'FINISHED' }] })).toBe('searching')
    expect(officialCollapsibleTitle({ wip: true, hasResponse: false, fragments: [{ type: 'TIP', status: 'FINISHED' }] })).toBe('thinking')
    expect(officialCollapsibleTitle({ wip: true, hasResponse: false, fragments: [{ type: 'OTHER', status: 'FINISHED' }] })).toBe('thinking')
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
