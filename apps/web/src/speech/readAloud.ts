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
      host.resume()
    } catch {
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
    let stream: ReadableStream<Uint8Array>
    try {
      const pending = deps.synthesize(readable, voice, abort.signal)
      if (gen !== generation || abort.signal.aborted) {
        abandon(pending)
        return
      }
      stream = await pending
    } catch (error) {
      if (gen !== generation || isSpeechAbort(error) || abort.signal.aborted) return
      current.stop()
      deps.onError(mapTtsError(error))
      if (gen === generation) emit(IDLE)
      return
    }
    if (gen !== generation || abort.signal.aborted) {
      await stream.cancel().catch(() => undefined)
      return
    }
    try {
      let played = false
      for await (const frame of consumePcm(stream, abort.signal)) {
        if (gen !== generation) return
        if (frame.kind === 'aborted') return
        if (frame.kind === 'dangling-byte') {
          current.stop()
          deps.onError('ttsDangling')
          if (gen === generation) emit(IDLE)
          return
        }
        if (frame.kind === 'error') {
          current.stop()
          deps.onError('ttsStreamError')
          if (gen === generation) emit(IDLE)
          return
        }
        if (frame.kind === 'eof') {
          if (!played) {
            current.stop()
            if (gen === generation) emit(IDLE)
            return
          }
          current.endStream()
          await current.whenDrained()
          if (gen !== generation) return
          current.stop()
          emit(IDLE)
          return
        }
        current.schedule(frame.samples)
        played = true
        if (gen === generation && snapshot.status === 'loading') {
          emit({ status: 'playing', messageId, conversationId })
        }
      }
    } catch (error) {
      if (gen !== generation || isSpeechAbort(error) || abort.signal.aborted) {
        current.stop()
        return
      }
      current.stop()
      deps.onError(mapTtsError(error))
      if (gen === generation) emit(IDLE)
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
