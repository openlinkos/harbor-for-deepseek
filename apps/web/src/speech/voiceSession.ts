import type { MessageKey } from '@deepapi/i18n'
import { useSyncExternalStore } from 'react'
import { isSpeechAbort, mapVoiceError } from './mapError.js'
import type { LevelAnalyser, Recording } from './recorder.js'

export type VoicePhase = 'idle' | 'recording' | 'transcribing'

export type VoiceSnapshot = {
  phase: VoicePhase
  elapsedMs: number
  analyser: LevelAnalyser | null
  conversationId: string | null
}

export type SelectionRange = { start: number; end: number }

export const insertTranscript = (text: string, transcript: string, selection: SelectionRange): { text: string; caret: number } => {
  const start = Math.max(0, Math.min(selection.start, selection.end, text.length))
  const end = Math.min(text.length, Math.max(selection.start, selection.end, 0))
  const next = `${text.slice(0, start)}${transcript}${text.slice(end)}`
  return { text: next, caret: start + transcript.length }
}

const IDLE: VoiceSnapshot = { phase: 'idle', elapsedMs: 0, analyser: null, conversationId: null }

export type VoiceDeps = {
  now: () => number
  startRecording: (onLimit: () => void) => Promise<Recording>
  transcribe: (file: Blob, signal: AbortSignal) => Promise<string>
  secure: () => boolean
  gate: () => { ok: true } | { ok: false; key: MessageKey }
  onError: (key: MessageKey) => void
  onText: (text: string, conversationId: string | null, generation: number) => void
  activeConversationId: () => string | null
}

export type VoiceController = {
  getSnapshot: () => VoiceSnapshot
  subscribe: (listener: () => void) => () => void
  toggle: () => void
  cancel: () => void
  tick: () => void
}

export const createVoiceInput = (deps: VoiceDeps): VoiceController => {
  let operation = 0
  let phase: VoicePhase = 'idle'
  let elapsedMs = 0
  let analyser: LevelAnalyser | null = null
  let conversationId: string | null = null
  let recording: Recording | null = null
  let abort: AbortController | null = null
  let stopping = false
  let arming = false
  let pendingLimit = false
  let startedAt = 0
  let timer: ReturnType<typeof setInterval> | null = null
  let snap = IDLE
  const listeners = new Set<() => void>()

  const emit = () => {
    const next: VoiceSnapshot = { phase, elapsedMs, analyser, conversationId }
    if (snap.phase === next.phase && snap.elapsedMs === next.elapsedMs && snap.analyser === next.analyser && snap.conversationId === next.conversationId) return
    snap = next
    for (const listener of listeners) listener()
  }

  const clearTimer = () => {
    if (timer !== null) {
      clearInterval(timer)
      timer = null
    }
  }

  const idle = () => {
    stopping = false
    arming = false
    pendingLimit = false
    phase = 'idle'
    elapsedMs = 0
    analyser = null
    conversationId = null
    recording = null
    abort = null
    clearTimer()
    emit()
  }

  const cancel = () => {
    operation += 1
    abort?.abort()
    recording?.cancel()
    idle()
  }

  const tick = () => {
    if (phase !== 'recording') return
    elapsedMs = Math.max(0, deps.now() - startedAt)
    emit()
  }

  const fail = (key: MessageKey, op: number) => {
    if (op !== operation) return
    deps.onError(key)
    idle()
  }

  const finish = () => {
    if (phase !== 'recording' || !recording || stopping) return
    stopping = true
    const op = operation
    const conv = conversationId
    const current = recording
    recording = null
    analyser = null
    clearTimer()
    phase = 'transcribing'
    emit()
    const controller = new AbortController()
    abort = controller
    void (async () => {
      try {
        const wav = await current.stop()
        if (op !== operation) return
        if (!wav || wav.size <= 44) {
          fail('voiceInputEmpty', op)
          return
        }
        const text = (await deps.transcribe(wav, controller.signal)).trim()
        if (op !== operation) return
        if (deps.activeConversationId() !== conv) {
          idle()
          return
        }
        if (!text) {
          fail('voiceInputEmpty', op)
          return
        }
        deps.onText(text, conv, op)
        if (op === operation) idle()
      } catch (error) {
        if (op !== operation || isSpeechAbort(error)) {
          if (op === operation) idle()
          return
        }
        fail(mapVoiceError(error), op)
      }
    })()
  }

  const hitLimit = (op: number) => {
    if (op !== operation) return
    if (phase !== 'recording') {
      pendingLimit = true
      return
    }
    deps.onError('voiceInputTooLong')
    finish()
  }

  const begin = () => {
    const gate = deps.gate()
    if (!gate.ok) {
      deps.onError(gate.key)
      return
    }
    if (!deps.secure()) {
      deps.onError('voiceInputRequiresHttps')
      return
    }
    const op = operation
    arming = true
    conversationId = deps.activeConversationId()
    emit()
    void (async () => {
      try {
        const rec = await deps.startRecording(() => hitLimit(op))
        if (op !== operation) {
          rec.cancel()
          return
        }
        recording = rec
        analyser = rec.analyser
        arming = false
        phase = 'recording'
        startedAt = deps.now()
        elapsedMs = 0
        timer = setInterval(tick, 500)
        emit()
        if (pendingLimit) hitLimit(op)
      } catch (error) {
        if (op !== operation) return
        arming = false
        fail(mapVoiceError(error), op)
      }
    })()
  }

  return {
    getSnapshot: () => snap,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    toggle() {
      if (phase === 'recording') {
        finish()
        return
      }
      if (phase === 'transcribing' || arming) {
        cancel()
        return
      }
      begin()
    },
    cancel,
    tick,
  }
}

let active: VoiceController | null = null
let deliver: ((text: string, conversationId: string | null, generation: number) => void) | null = null

export const installVoiceInput = (session: VoiceController) => {
  active = session
}

export const bindVoiceInserter = (fn: typeof deliver) => {
  deliver = fn
}

export const cancelVoiceInput = () => active?.cancel()

export const toggleVoiceInput = () => active?.toggle()

export const voiceSnapshot = (): VoiceSnapshot => active?.getSnapshot() ?? IDLE

export const useVoiceInput = (): VoiceSnapshot =>
  useSyncExternalStore(
    (listener) => active?.subscribe(listener) ?? (() => undefined),
    voiceSnapshot,
    () => IDLE,
  )

export const deliverTranscript = (text: string, conversationId: string | null, generation: number) => {
  deliver?.(text, conversationId, generation)
}
