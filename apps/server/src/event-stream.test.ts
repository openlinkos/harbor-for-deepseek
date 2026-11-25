import { afterEach, describe, expect, it, vi } from 'vitest'
import { pumpRunEvents, type PumpInput, type RunEventRow } from './event-stream.js'

const PING_MS = 15_000

const deferred = () => {
  let resolve!: () => void
  const promise = new Promise<void>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const deadline = async (work: Promise<void>, ms = 250): Promise<'settled' | 'pending'> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  const result = await Promise.race([
    work.then(() => 'settled' as const),
    new Promise<'pending'>((resolve) => {
      timer = setTimeout(() => resolve('pending'), ms)
    }),
  ])
  if (timer !== undefined) {
    clearTimeout(timer)
  }
  return result
}

const trackTimers = () => {
  const pending = new Set<unknown>()
  const origSet = globalThis.setTimeout
  const origClear = globalThis.clearTimeout
  const wrappedSet = ((handler: TimerHandler, ms?: number, ...args: unknown[]) => {
    const handle: unknown = origSet(handler, ms, ...(args as []))
    pending.add(handle)
    return handle
  }) as typeof setTimeout
  const wrappedClear = ((handle: unknown) => {
    pending.delete(handle)
    origClear(handle as never)
  }) as typeof clearTimeout
  globalThis.setTimeout = wrappedSet
  globalThis.clearTimeout = wrappedClear
  return () => {
    globalThis.setTimeout = origSet
    globalThis.clearTimeout = origClear
    for (const handle of pending) {
      origClear(handle as never)
    }
    pending.clear()
  }
}

type Drive = {
  output: string[]
  listeners: Set<() => void>
  maxListeners: number
  notify: () => void
  cancel: () => void
  abort: () => void
  closeCount: () => number
  done: Promise<void>
  input: PumpInput
}

const drive = (
  partial: Partial<PumpInput> & Pick<PumpInput, 'readEvents' | 'readStatus'>,
  listeners = new Set<() => void>(),
): Drive => {
  const output: string[] = []
  let maxListeners = 0
  let closed = false
  let closes = 0
  let cancelWake: (() => void) | null = null
  const controller = new AbortController()
  const note = () => {
    maxListeners = Math.max(maxListeners, listeners.size)
  }
  const input: PumpInput = {
    initialCursor: 0,
    pingMs: PING_MS,
    signal: controller.signal,
    readThinkingSeconds: async () => null,
    send: (chunk) => {
      if (!closed) {
        output.push(chunk)
      }
    },
    isClosed: () => closed,
    close: () => {
      if (closed) {
        return
      }
      closed = true
      closes += 1
    },
    subscribe: (wake) => {
      listeners.add(wake)
      note()
      return () => {
        listeners.delete(wake)
      }
    },
    onCancel: (wake) => {
      cancelWake = wake
      if (closed) {
        wake()
      }
    },
    ...partial,
  }
  const done = pumpRunEvents(input)
  return {
    output,
    listeners,
    get maxListeners() {
      return maxListeners
    },
    notify: () => {
      for (const wake of [...listeners]) {
        wake()
      }
    },
    cancel: () => {
      closed = true
      cancelWake?.()
    },
    abort: () => controller.abort(),
    closeCount: () => closes,
    done,
    input,
  }
}

const stop = async (session: Drive, releaseTimers?: () => void) => {
  session.abort()
  await Promise.race([session.done.catch(() => undefined), sleep(40)])
  releaseTimers?.()
}

describe('run event pump', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('delivers an already terminal run once, including thinking seconds', async () => {
    const session = drive({
      readEvents: async () => [{ seq: 1, payload: { text: 'only' } }],
      readStatus: async () => 'complete',
      readThinkingSeconds: async () => 4,
    })
    await session.done
    const text = session.output.join('')
    expect(text).toContain('id: 1\n')
    expect(text).toContain('"text":"only"')
    expect(text).toContain('event: end\ndata: {"status":"complete","thinkingSeconds":4}\n\n')
    expect(text.match(/event: end/g)).toHaveLength(1)
    expect(session.listeners.size).toBe(0)
    expect(session.closeCount()).toBe(1)
  })

  it('omits thinking seconds when the column is null', async () => {
    const session = drive({
      readEvents: async () => [],
      readStatus: async () => 'error',
      readThinkingSeconds: async () => null,
    })
    await session.done
    expect(session.output.join('')).toContain('event: end\ndata: {"status":"error"}\n\n')
    expect(session.listeners.size).toBe(0)
  })

  it('replays from the cursor in sequence order and does not resend earlier rows', async () => {
    const rows: RunEventRow[] = [
      { seq: 1, payload: { n: 1 } },
      { seq: 2, payload: { n: 2 } },
      { seq: 3, payload: { n: 3 } },
    ]
    const session = drive({
      initialCursor: 1,
      readEvents: async (cursor) => rows.filter((row) => row.seq > cursor),
      readStatus: async () => 'complete',
    })
    await session.done
    const text = session.output.join('')
    expect(text.startsWith('id: 2\n')).toBe(true)
    expect(text).not.toContain('"n":1')
    expect(text.indexOf('"n":2')).toBeLessThan(text.indexOf('"n":3'))
    expect(text.indexOf('"n":3')).toBeLessThan(text.indexOf('event: end'))
    expect(text.match(/event: end/g)).toHaveLength(1)
  })

  it('writes the heartbeat comment at 15000ms and not sooner, then reads again', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
    let reads = 0
    const session = drive({
      readEvents: async () => [],
      readStatus: async () => {
        reads += 1
        return 'streaming'
      },
    })
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(14_999)
    expect(session.output.join('')).not.toContain(': ping')
    await vi.advanceTimersByTimeAsync(1)
    expect(session.output.join('')).toContain(': ping\n\n')
    expect(reads).toBeGreaterThanOrEqual(2)
    session.abort()
    await session.done
  })

  it('abort while the pump is waiting removes the listener and does not send end', async () => {
    const session = drive({
      readEvents: async () => [],
      readStatus: async () => 'streaming',
    })
    for (let i = 0; i < 20 && session.listeners.size === 0; i += 1) {
      await Promise.resolve()
    }
    expect(session.listeners.size).toBe(1)
    session.abort()
    await session.done
    expect(session.listeners.size).toBe(0)
    expect(session.output.join('')).not.toContain('event: end')
    expect(session.closeCount()).toBe(1)
  })

  it('an already-aborted signal settles without reading or leaving a listener', async () => {
    let reads = 0
    const controller = new AbortController()
    controller.abort()
    const session = drive({
      signal: controller.signal,
      readEvents: async () => {
        reads += 1
        return []
      },
      readStatus: async () => 'streaming',
    })
    const outcome = await deadline(session.done, 200)
    expect(outcome).toBe('settled')
    expect(reads).toBe(0)
    expect(session.listeners.size).toBe(0)
    expect(session.output.join('')).toBe('')
  })

  it('does not lose a terminal notification that arrives while the streaming status read is still in flight', async () => {
    const releaseTimers = trackTimers()
    const entered = deferred()
    const gate = deferred()
    let statusReads = 0
    let live = 'streaming'
    let subscribersAtNotify = -1
    const session = drive({
      readEvents: async () => [],
      readStatus: async () => {
        statusReads += 1
        if (statusReads === 1) {
          entered.resolve()
          await gate.promise
          return 'streaming'
        }
        return live
      },
    })
    try {
      await entered.promise
      live = 'error'
      subscribersAtNotify = session.listeners.size
      session.notify()
      gate.resolve()
      const outcome = await deadline(session.done, 250)
      const text = session.output.join('')
      expect(outcome).toBe('settled')
      expect(subscribersAtNotify).toBe(1)
      expect(text).toContain('event: end\ndata: {"status":"error"}\n\n')
      expect(text).not.toContain(': ping')
      expect(text.match(/event: end/g)).toHaveLength(1)
      expect(session.listeners.size).toBe(0)
    } finally {
      gate.resolve()
      await stop(session, releaseTimers)
    }
  })

  it('does not lose an event appended and notified before the wait is registered', async () => {
    const releaseTimers = trackTimers()
    const entered = deferred()
    const gate = deferred()
    const events: RunEventRow[] = []
    let firstEvents = true
    let subscribersAtNotify = -1
    const session = drive({
      readEvents: async (cursor) => {
        const snapshot = events.filter((row) => row.seq > cursor)
        if (firstEvents) {
          firstEvents = false
          entered.resolve()
          await gate.promise
          return snapshot
        }
        return events.filter((row) => row.seq > cursor)
      },
      readStatus: async () => 'streaming',
    })
    try {
      await entered.promise
      events.push({ seq: 1, payload: { text: 'appended-before-wait' } })
      subscribersAtNotify = session.listeners.size
      session.notify()
      gate.resolve()
      for (let i = 0; i < 30; i += 1) {
        await Promise.resolve()
      }
      const text = session.output.join('')
      expect(text).toContain('"text":"appended-before-wait"')
      expect(subscribersAtNotify).toBe(1)
      expect(text).not.toContain(': ping')
      expect(session.listeners.size).toBeLessThanOrEqual(1)
    } finally {
      gate.resolve()
      await stop(session, releaseTimers)
    }
  })

  it('abort during the status read settles without a heartbeat or a leaked listener', async () => {
    const releaseTimers = trackTimers()
    const entered = deferred()
    const gate = deferred()
    const session = drive({
      readEvents: async () => [],
      readStatus: async () => {
        entered.resolve()
        await gate.promise
        return 'streaming'
      },
    })
    try {
      await entered.promise
      const subscribedDuringRead = session.listeners.size
      session.abort()
      gate.resolve()
      const outcome = await deadline(session.done, 250)
      expect({
        subscribedDuringRead,
        outcome,
        listeners: session.listeners.size,
        ping: session.output.join('').includes(': ping'),
        end: session.output.join('').includes('event: end'),
        closes: session.closeCount(),
      }).toEqual({
        subscribedDuringRead: 1,
        outcome: 'settled',
        listeners: 0,
        ping: false,
        end: false,
        closes: 1,
      })
    } finally {
      gate.resolve()
      await stop(session, releaseTimers)
    }
  })

  it('reader cancel while waiting settles, drops the listener, and closes once', async () => {
    const releaseTimers = trackTimers()
    const session = drive({
      readEvents: async () => [],
      readStatus: async () => 'streaming',
    })
    try {
      for (let i = 0; i < 20 && session.listeners.size === 0; i += 1) {
        await Promise.resolve()
      }
      expect(session.listeners.size).toBe(1)
      session.cancel()
      const outcome = await deadline(session.done, 250)
      expect(outcome).toBe('settled')
      expect(session.listeners.size).toBe(0)
      expect(session.output.join('')).not.toContain(': ping')
      expect(session.closeCount()).toBeLessThanOrEqual(1)
    } finally {
      await stop(session, releaseTimers)
    }
  })

  it('a query failure after the listener is registered does not leak it or send end', async () => {
    const listeners = new Set<() => void>()
    let subscribedDuringRead = false
    const session = drive({
      readEvents: async () => {
        subscribedDuringRead = listeners.size > 0
        throw new Error('db read failed')
      },
      readStatus: async () => 'streaming',
    }, listeners)
    await expect(session.done).rejects.toThrow('db read failed')
    expect(subscribedDuringRead).toBe(true)
    expect(listeners.size).toBe(0)
    expect(session.output.join('')).not.toContain('event: end')
  })

  it('a status query failure cleans up the listener', async () => {
    const listeners = new Set<() => void>()
    let subscribedDuringStatus = false
    const session = drive({
      readEvents: async () => [{ seq: 1, payload: { text: 'partial' } }],
      readStatus: async () => {
        subscribedDuringStatus = listeners.size > 0
        throw new Error('status failed')
      },
    }, listeners)
    await expect(session.done).rejects.toThrow('status failed')
    expect(subscribedDuringStatus).toBe(true)
    expect(listeners.size).toBe(0)
    expect(session.output.join('')).not.toContain('event: end')
  })

  it('a final append that lands after the events snapshot and before the terminal status is sent before end', async () => {
    const events: RunEventRow[] = [{ seq: 1, payload: { text: 'head' } }]
    let status = 'streaming'
    let eventsCalls = 0
    const session = drive({
      readEvents: async (cursor) => {
        eventsCalls += 1
        const snapshot = events.filter((row) => row.seq > cursor).map((row) => ({ ...row }))
        return snapshot
      },
      readStatus: async () => {
        if (status === 'streaming') {
          events.push({ seq: 2, payload: { text: 'tail-final' } })
          status = 'error'
          session.notify()
          return 'error'
        }
        return status
      },
    })
    await session.done
    const text = session.output.join('')
    expect(eventsCalls).toBeGreaterThanOrEqual(2)
    expect(text).toContain('"text":"head"')
    expect(text).toContain('"text":"tail-final"')
    expect(text.indexOf('"text":"tail-final"')).toBeLessThan(text.indexOf('event: end'))
    expect(text).toContain('event: end\ndata: {"status":"error"}\n\n')
    expect(text.match(/event: end/g)).toHaveLength(1)
    expect(text.match(/id: 2\n/g)).toHaveLength(1)
    expect(session.listeners.size).toBe(0)
  })

  it('a drain failure does not send end and does not leak the listener', async () => {
    let calls = 0
    const session = drive({
      readEvents: async () => {
        calls += 1
        if (calls >= 2) {
          throw new Error('drain failed')
        }
        return [{ seq: 1, payload: { text: 'kept' } }]
      },
      readStatus: async () => 'error',
    })
    await expect(session.done).rejects.toThrow('drain failed')
    expect(calls).toBeGreaterThanOrEqual(2)
    expect(session.listeners.size).toBe(0)
    expect(session.output.join('')).toContain('"text":"kept"')
    expect(session.output.join('')).not.toContain('event: end')
  })
})
