import type { MessageKey } from '@deepapi/i18n'
import { ASR_MAX_SECONDS } from '@deepapi/types'
import { useSyncExternalStore } from 'react'
import { isSpeechAbort, mapVoiceError } from './mapError.js'
import type { LevelAnalyser, Recording } from './recorder.js'

const WALL_MS = ASR_MAX_SECONDS * 1000

export type VoicePhase = 'idle' | 'recording' | 'transcribing'

export type VoiceSnapshot = {
  phase: VoicePhase
  elapsedMs: number
  analyser: LevelAnalyser | null
  conversationId: string | null
}

export type SelectionRange = { start: number; end: number }

export type VoiceAnchor = {
  conversationId: string | null
  text: string
  start: number
  end: number
}

export const insertTranscript = (text: string, transcript: string, selection: SelectionRange): { text: string; caret: number } => {
  const start = Math.max(0, Math.min(selection.start, selection.end, text.length))
  const end = Math.min(text.length, Math.max(selection.start, selection.end, 0))
  const next = `${text.slice(0, start)}${transcript}${text.slice(end)}`
  return { text: next, caret: start + transcript.length }
}

/**
 * Map a range captured when voice input was armed onto the draft as it is now.
 * An unchanged draft keeps that range, including a collapsed caret.
 * Text inserted or removed only before the saved draft shifts the range with it.
 * A change only before the saved tail, or only after the saved head, keeps the
 * anchored span. Replacing just the selected middle keeps the text outside it.
 * A pure append after a range that already reached the end is not treated as
 * a middle edit. Anything else is ambiguous: return null so the caller leaves
 * the new draft untouched instead of applying stale indexes.
 */
export const resolveVoiceAnchor = (current: string, anchor: Pick<VoiceAnchor, 'text' | 'start' | 'end'>): SelectionRange | null => {
  const length = anchor.text.length
  const rawStart = Number.isFinite(anchor.start) ? anchor.start : length
  const rawEnd = Number.isFinite(anchor.end) ? anchor.end : rawStart
  const start = Math.max(0, Math.min(rawStart, rawEnd, length))
  const end = Math.min(length, Math.max(rawStart, rawEnd, 0))
  if (current === anchor.text) return { start, end }
  // The armed draft was empty, so every character the user added was typed at
  // that caret. The caret now sits after that new text.
  if (length === 0) return { start: current.length, end: current.length }
  const before = anchor.text.slice(0, start)
  const selected = anchor.text.slice(start, end)
  const after = anchor.text.slice(end)
  const tail = `${selected}${after}`
  const head = `${before}${selected}`
  if (current.endsWith(anchor.text)) {
    const delta = current.length - length
    return { start: start + delta, end: end + delta }
  }
  if (tail.length > 0 && current.endsWith(tail)) {
    const nextStart = current.length - tail.length
    return { start: nextStart, end: nextStart + selected.length }
  }
  if (head.length > 0 && current.startsWith(head)) return { start, end }
  if (start === 0 && end === 0 && after.length > 0 && current.startsWith(after)) return { start: 0, end: 0 }
  if (after.length > 0 && current.startsWith(before) && current.endsWith(after)) {
    const middleEnd = current.length - after.length
    if (middleEnd >= before.length) return { start: before.length, end: middleEnd }
  }
  if (after.length === 0 && before.length > 0 && current.startsWith(before) && !current.startsWith(head)) {
    return { start: before.length, end: current.length }
  }
  return null
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
  // The handle is owned by the operation that armed it. A late reject or
  // resolve from an older start must not clear the handle a newer start stored.
  let armingCancel: { op: number; run: () => void } | null = null
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
    // Resume may still be pending, so the Recording object does not exist yet.
    armingCancel?.run()
    armingCancel = null
    idle()
  }

  const tick = () => {
    if (phase !== 'recording') return
    elapsedMs = Math.max(0, deps.now() - startedAt)
    emit()
    // Sample callbacks can stall while the device stays open. The wall clock
    // is independent of onaudioprocess.
    if (elapsedMs >= WALL_MS) hitLimit(operation)
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
    const pending = deps.startRecording(() => hitLimit(op)) as Promise<Recording> & { cancel?: () => void }
    armingCancel = typeof pending.cancel === 'function' ? { op, run: () => pending.cancel?.() } : null
    const releaseArming = () => {
      if (armingCancel?.op === op) armingCancel = null
    }
    void (async () => {
      try {
        const rec = await pending
        if (op !== operation) {
          rec.cancel()
          return
        }
        releaseArming()
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
        // A superseded start can reject or abort after the next one has stored
        // its own cancel handle. Leaving that handle in place is what lets the
        // newer pending recorder still be cancelled.
        releaseArming()
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
