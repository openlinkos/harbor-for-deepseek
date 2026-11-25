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
   * The previous loop did not wake on cancel; it only noticed `closed` on the next iteration.
   */
  onCancel: (wake: () => void) => void
}

export const formatRunEvent = (seq: number, payload: unknown): string =>
  `id: ${seq}\ndata: ${JSON.stringify(payload)}\n\n`

export const formatRunEnd = (status: string | undefined, thinkingSeconds: number | null | undefined): string =>
  `event: end\ndata: ${JSON.stringify({ status: status ?? 'error', thinkingSeconds: thinkingSeconds ?? undefined })}\n\n`

export const formatRunPing = (): string => `: ping\n\n`

/**
 * Previous wait protocol, extracted unchanged: both reads finish before the
 * wake listener exists. A notify during either read is dropped.
 */
export const pumpRunEvents = async (input: PumpInput): Promise<void> => {
  let cursor = input.initialCursor
  input.onCancel(() => undefined)
  while (!input.signal.aborted && !input.isClosed()) {
    const rows = await input.readEvents(cursor)
    for (const row of rows) {
      cursor = row.seq
      input.send(formatRunEvent(row.seq, row.payload))
    }
    const status = await input.readStatus()
    if (status !== 'streaming') {
      const thinkingSeconds = await input.readThinkingSeconds()
      input.send(formatRunEnd(status, thinkingSeconds))
      input.close()
      return
    }
    await new Promise<void>((resolve) => {
      let settled = false
      let timer: ReturnType<typeof setTimeout> | undefined
      let unsubscribe = () => {}
      const finish = () => {
        if (settled) {
          return
        }
        settled = true
        if (timer) {
          clearTimeout(timer)
        }
        input.signal.removeEventListener('abort', onAbort)
        unsubscribe()
        resolve()
      }
      const wake = () => finish()
      unsubscribe = input.subscribe(wake)
      timer = setTimeout(() => {
        input.send(formatRunPing())
        finish()
      }, input.pingMs)
      const onAbort = () => finish()
      input.signal.addEventListener('abort', onAbort, { once: true })
    })
  }
  input.close()
}
