import { expect, it } from 'vitest'
import { pumpRunEvents, type PumpInput } from './event-stream.js'

for (const boundary of ['tail replay', 'thinking seconds'] as const) {
  it(`abort while awaiting terminal ${boundary} suppresses late frames and disposes the subscription`, async () => {
    let enter!: () => void
    let release!: () => void
    const entered = new Promise<void>((resolve) => { enter = resolve })
    const gate = new Promise<void>((resolve) => { release = resolve })
    const abort = new AbortController()
    const listeners = new Set<() => void>()
    const frames: string[] = []
    let reads = 0
    let closed = false
    const input: PumpInput = {
      initialCursor: 0,
      readEvents: async () => {
        if (++reads === 1) return []
        if (boundary === 'tail replay') {
          enter()
          await gate
          return [{ seq: 1, payload: { text: 'late tail' } }]
        }
        return []
      },
      readStatus: async () => 'error',
      readThinkingSeconds: async () => {
        if (boundary === 'thinking seconds') {
          enter()
          await gate
        }
        return null
      },
      subscribe: (wake) => {
        listeners.add(wake)
        return () => { listeners.delete(wake) }
      },
      signal: abort.signal,
      pingMs: 15_000,
      send: (frame) => { frames.push(frame) },
      isClosed: () => closed,
      close: () => { closed = true },
      onCancel: () => undefined,
    }
    const work = pumpRunEvents(input)
    await entered
    abort.abort()
    release()
    await work
    expect(frames).toEqual([])
    expect(listeners.size).toBe(0)
    expect(closed).toBe(true)
  })
}
