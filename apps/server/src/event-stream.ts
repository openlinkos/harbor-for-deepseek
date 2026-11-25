export type RunEventRow = {
  seq: number
  payload: unknown
}

export type PumpInput = {
  initialCursor: number
  readEvents: (cursor: number) => Promise<RunEventRow[]>
  readStatus: () => Promise<string | undefined>
  readThinkingSeconds: () => Promise<number | null | undefined>
  /** Registers one wake callback. The returned function removes it. */
  subscribe: (wake: () => void) => () => void
  signal: AbortSignal
  /** Interval for the `: ping` comment. Production passes 15000. */
  pingMs: number
  send: (chunk: string) => void
  isClosed: () => boolean
  close: () => void
  /**
   * The caller invokes the registered function when the reader cancels.
   * Cancel wakes the pump so the listener and heartbeat timer are dropped.
   */
  onCancel: (wake: () => void) => void
}

export const formatRunEvent = (seq: number, payload: unknown): string =>
  `id: ${seq}\ndata: ${JSON.stringify(payload)}\n\n`

export const formatRunEnd = (status: string | undefined, thinkingSeconds: number | null | undefined): string =>
  `event: end\ndata: ${JSON.stringify({ status: status ?? 'error', thinkingSeconds: thinkingSeconds ?? undefined })}\n\n`

export const formatRunPing = (): string => `: ping\n\n`

/**
 * Register one latched wake before either read. A notify during a query, or
 * after the query returns and before the wait is armed, sets `pending` and
 * cannot be lost. After a terminal status, events are read again: that read
 * starts only once the terminal commit is visible, and every append for the
 * run is committed before finishRun.
 */
export const pumpRunEvents = async (input: PumpInput): Promise<void> => {
  let cursor = input.initialCursor
  let pending = false
  let resolveWait: (() => void) | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  const clearTimer = () => {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
  }
  const wake = () => {
    pending = true
    resolveWait?.()
  }
  const unsubscribe = input.subscribe(wake)
  const onAbort = () => {
    resolveWait?.()
  }
  input.signal.addEventListener('abort', onAbort)
  input.onCancel(() => {
    resolveWait?.()
  })
  try {
    if (input.signal.aborted || input.isClosed()) {
      input.close()
      return
    }
    while (!input.signal.aborted && !input.isClosed()) {
      const rows = await input.readEvents(cursor)
      if (input.signal.aborted || input.isClosed()) {
        break
      }
      for (const row of rows) {
        cursor = row.seq
        input.send(formatRunEvent(row.seq, row.payload))
        if (input.isClosed()) {
          break
        }
      }
      if (input.signal.aborted || input.isClosed()) {
        break
      }
      const status = await input.readStatus()
      if (input.signal.aborted || input.isClosed()) {
        break
      }
      if (status !== 'streaming') {
        const tail = await input.readEvents(cursor)
        if (input.signal.aborted || input.isClosed()) {
          input.close()
          return
        }
        for (const row of tail) {
          if (input.signal.aborted || input.isClosed()) {
            break
          }
          cursor = row.seq
          input.send(formatRunEvent(row.seq, row.payload))
        }
        if (!input.signal.aborted && !input.isClosed()) {
          const thinkingSeconds = await input.readThinkingSeconds()
          if (!input.signal.aborted && !input.isClosed()) {
            input.send(formatRunEnd(status, thinkingSeconds))
          }
        }
        input.close()
        return
      }
      if (pending) {
        pending = false
        continue
      }
      await new Promise<void>((resolve) => {
        let settled = false
        const finish = () => {
          if (settled) {
            return
          }
          settled = true
          clearTimer()
          resolveWait = null
          resolve()
        }
        timer = setTimeout(() => {
          if (!input.isClosed()) {
            input.send(formatRunPing())
          }
          finish()
        }, input.pingMs)
        resolveWait = finish
        if (pending || input.signal.aborted || input.isClosed()) {
          finish()
        }
      })
      pending = false
    }
    input.close()
  } finally {
    clearTimer()
    resolveWait = null
    input.signal.removeEventListener('abort', onAbort)
    unsubscribe()
  }
}
