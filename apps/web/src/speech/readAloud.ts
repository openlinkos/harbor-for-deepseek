import type { MessageKey } from '@deepapi/i18n'
import type { TtsVoice } from '@deepapi/types'
import { useSyncExternalStore } from 'react'
import { isSpeechAbort, mapTtsError } from './mapError.js'
import { consumePcm } from './pcm.js'
import { createPcmPlayer, type PcmAudioHost } from './player.js'

export type ReadAloudStatus = 'idle' | 'loading' | 'playing'

export type ReadAloudSnapshot = {
  status: ReadAloudStatus
  messageId: string | null
  conversationId: string | null
}

const IDLE: ReadAloudSnapshot = { status: 'idle', messageId: null, conversationId: null }

export type ReadAloudDeps = {
  synthesize: (text: string, voice: TtsVoice, signal: AbortSignal) => Promise<ReadableStream<Uint8Array>>
  createContext: () => PcmAudioHost
  getVoice: () => TtsVoice
  onError: (key: MessageKey) => void
  canSpeak: () => { ok: true } | { ok: false; key: MessageKey }
}

export type ReadAloud = {
  getSnapshot: () => ReadAloudSnapshot
  subscribe: (listener: () => void) => () => void
  toggle: (messageId: string, conversationId: string, text: string) => void
  stop: () => void
}

export const createReadAloud = (deps: ReadAloudDeps): ReadAloud => {
  let snapshot = IDLE
  let generation = 0
  let controller: AbortController | null = null
  let player: ReturnType<typeof createPcmPlayer> | null = null
  const listeners = new Set<() => void>()

  const emit = (next: ReadAloudSnapshot) => {
    if (snapshot.status === next.status && snapshot.messageId === next.messageId && snapshot.conversationId === next.conversationId) return
    snapshot = next
    for (const listener of listeners) listener()
  }

  const stop = () => {
    generation += 1
    controller?.abort()
    controller = null
    player?.stop()
    player = null
    emit(IDLE)
  }

  const closeHost = (host: PcmAudioHost) => {
    try {
      void Promise.resolve(host.close()).catch(() => undefined)
    } catch {
      // The host is already closed.
    }
  }

  const dropStream = (stream: ReadableStream<Uint8Array> | null) => {
    if (!stream) return
    void stream.cancel().catch(() => undefined)
  }

  /** Stops this attempt's audio and aborts its request without touching a newer generation. */
  const finishAttempt = (
    gen: number,
    abort: AbortController,
    current: ReturnType<typeof createPcmPlayer>,
    stream: ReadableStream<Uint8Array> | null,
    errorKey?: MessageKey,
  ) => {
    const ownsPlayer = player === current
    if (ownsPlayer && controller === abort) controller = null
    if (!abort.signal.aborted) abort.abort()
    current.stop()
    if (ownsPlayer) player = null
    dropStream(stream)
    if (gen !== generation) return
    if (errorKey) deps.onError(errorKey)
    emit(IDLE)
  }

  const toggle = (messageId: string, conversationId: string, text: string) => {
    const same = snapshot.messageId === messageId && snapshot.status !== 'idle'
    stop()
    if (same) return
    const gate = deps.canSpeak()
    if (!gate.ok) {
      deps.onError(gate.key)
      return
    }
    const readable = text.trim()
    if (!readable) {
      deps.onError('ttsUnavailable')
      return
    }
    let host: PcmAudioHost
    try {
      host = deps.createContext()
    } catch {
      deps.onError('ttsFailed')
      return
    }
    let resumed: void | Promise<void>
    try {
      resumed = host.resume()
    } catch {
      closeHost(host)
      deps.onError('ttsFailed')
      return
    }
    const gen = generation
    const abort = new AbortController()
    controller = abort
    const current = createPcmPlayer(host)
    player = current
    // Read the voice at the gesture. A later toggle in the same turn must not
    // observe a voice mutation that the first request makes while it starts.
    const voice = deps.getVoice()
    emit({ status: 'loading', messageId, conversationId })
    if (resumed && typeof resumed.then === 'function') {
      void resumed.then(() => undefined, () => {
        // Closing the context rejects a resume that is still pending. That is
        // not a device failure when this attempt already left the controller.
        if (gen !== generation || controller !== abort) return
        stop()
        deps.onError('ttsFailed')
      })
    }
    queueMicrotask(() => {
      void runPlayback(gen, abort, current, voice, readable, messageId, conversationId)
    })
  }

  const runPlayback = async (
    gen: number,
    abort: AbortController,
    current: ReturnType<typeof createPcmPlayer>,
    voice: TtsVoice,
    readable: string,
    messageId: string,
    conversationId: string,
  ) => {
    const abandon = (pending: Promise<ReadableStream<Uint8Array>>) => {
      void pending.then(
        (stream) => { void stream.cancel().catch(() => undefined) },
        () => undefined,
      )
    }
    let stream: ReadableStream<Uint8Array> | null = null
    try {
      const pending = deps.synthesize(readable, voice, abort.signal)
      if (gen !== generation || abort.signal.aborted) {
        abandon(pending)
        return
      }
      stream = await pending
    } catch (error) {
      // A newer playback owns the shared player. This attempt must not idle it.
      if (gen !== generation) return
      // AbortError only changes the notice. The current attempt still has to
      // drop its context when this controller did not abort the request itself.
      const ownAbort = abort.signal.aborted || isSpeechAbort(error)
      finishAttempt(gen, abort, current, null, ownAbort ? undefined : mapTtsError(error))
      return
    }
    if (gen !== generation || abort.signal.aborted) {
      dropStream(stream)
      if (player === current) current.stop()
      return
    }
    try {
      let played = false
      for await (const frame of consumePcm(stream, abort.signal)) {
        if (gen !== generation || frame.kind === 'aborted') {
          finishAttempt(gen, abort, current, stream)
          return
        }
        if (frame.kind === 'dangling-byte') {
          finishAttempt(gen, abort, current, stream, 'ttsDangling')
          return
        }
        if (frame.kind === 'error') {
          finishAttempt(gen, abort, current, stream, 'ttsStreamError')
          return
        }
        if (frame.kind === 'eof') {
          if (!played) {
            finishAttempt(gen, abort, current, stream)
            return
          }
          current.endStream()
          await current.whenDrained()
          if (gen !== generation) return
          if (controller === abort) controller = null
          current.stop()
          if (player === current) player = null
          emit(IDLE)
          return
        }
        try {
          current.schedule(frame.samples)
        } catch (error) {
          finishAttempt(gen, abort, current, stream, mapTtsError(error))
          return
        }
        played = true
        if (gen === generation && snapshot.status === 'loading') {
          emit({ status: 'playing', messageId, conversationId })
        }
      }
    } catch (error) {
      if (gen !== generation || isSpeechAbort(error) || abort.signal.aborted) {
        finishAttempt(gen, abort, current, stream)
        return
      }
      finishAttempt(gen, abort, current, stream, mapTtsError(error))
    }
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    toggle,
    stop,
  }
}

let active: ReadAloud | null = null

export const installReadAloud = (session: ReadAloud) => {
  active = session
}

export const stopReadAloud = () => active?.stop()

export const toggleReadAloud = (messageId: string, conversationId: string, text: string) => {
  active?.toggle(messageId, conversationId, text)
}

export const readAloudSnapshot = (): ReadAloudSnapshot => active?.getSnapshot() ?? IDLE

export const useReadAloud = (): ReadAloudSnapshot =>
  useSyncExternalStore(
    (listener) => active?.subscribe(listener) ?? (() => undefined),
    readAloudSnapshot,
    () => IDLE,
  )
