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

type TextSplice = { at: number; remove: number; insert: string }

export type VoiceEditResult =
  | { status: 'applied'; text: string; start: number; end: number }
  | { status: 'rejected' }
  | { status: 'unexplained' }

const sharedPrefix = (left: string, right: string, limit: number) => {
  const max = Math.min(limit, left.length, right.length)
  let index = 0
  while (index < max && left.charCodeAt(index) === right.charCodeAt(index)) index += 1
  return index
}

const sharedSuffix = (left: string, right: string, limit: number) => {
  const max = Math.min(limit, left.length, right.length)
  let index = 0
  while (index < max && left.charCodeAt(left.length - 1 - index) === right.charCodeAt(right.length - 1 - index)) index += 1
  return index
}

/** One contiguous explanation of how `before` became `after`. Prefix-first and suffix-first can disagree when the added text repeats. */
const prefixFirstSplice = (before: string, after: string): TextSplice => {
  const head = sharedPrefix(before, after, before.length)
  const tail = sharedSuffix(before, after, Math.min(before.length - head, after.length - head))
  return { at: head, remove: before.length - tail - head, insert: after.slice(head, after.length - tail) }
}

const suffixFirstSplice = (before: string, after: string): TextSplice => {
  const tail = sharedSuffix(before, after, before.length)
  const head = sharedPrefix(before, after, Math.min(before.length - tail, after.length - tail))
  return { at: head, remove: before.length - tail - head, insert: after.slice(head, after.length - tail) }
}

const sameSplice = (left: TextSplice, right: TextSplice) => left.at === right.at && left.remove === right.remove && left.insert === right.insert

/**
 * Move a saved range across one splice whose location is already known.
 * An edit strictly before the range shifts it. An edit strictly after it,
 * including a suffix typed at a caret that was already at the end, leaves it.
 * An edit inside the range grows or shrinks that range. An edit that crosses
 * the range boundary returns null so the new user text stays.
 */
const mapSplice = (start: number, end: number, oldLength: number, splice: TextSplice): SelectionRange | null => {
  const editStart = splice.at
  const editEnd = splice.at + splice.remove
  const delta = splice.insert.length - splice.remove
  if (editEnd <= start) {
    if (start === end && start === oldLength && editStart === start && splice.remove === 0) return { start, end }
    return { start: start + delta, end: end + delta }
  }
  if (editStart >= end) return { start, end }
  if (editStart >= start && editEnd <= end) return { start, end: end + delta }
  return null
}

const normalizeRange = (text: string, start: number, end: number) => {
  const length = text.length
  const rawStart = Number.isFinite(start) ? start : length
  const rawEnd = Number.isFinite(end) ? end : rawStart
  return {
    start: Math.max(0, Math.min(rawStart, rawEnd, length)),
    end: Math.min(length, Math.max(rawStart, rawEnd, 0)),
  }
}

/**
 * Map a range captured when voice input was armed onto the draft as it is now.
 * An unchanged draft keeps that range, including a collapsed caret.
 * An empty armed draft puts the caret after whatever the user has typed.
 * Any other draft is mapped only when the longest common prefix and the
 * longest common suffix describe the same single splice. A repeated token can
 * make a prepend and an append the same string; those disagree and return null.
 * The caller then leaves the new draft untouched instead of using a stale index.
 * A splice that crosses the saved range also returns null.
 * Equality with the armed string is not an authorization identity. A deleted span
 * that was typed again must not be restored from this function. Delivery uses the
 * observed edit stack in selectionAuth.ts and does not call this as a fallback.
 */
export const resolveVoiceAnchor = (current: string, anchor: Pick<VoiceAnchor, 'text' | 'start' | 'end'>): SelectionRange | null => {
  const length = anchor.text.length
  const range = normalizeRange(anchor.text, anchor.start, anchor.end)
  if (current === anchor.text) return range
  if (length === 0) return { start: current.length, end: current.length }
  const forward = prefixFirstSplice(anchor.text, current)
  const backward = suffixFirstSplice(anchor.text, current)
  if (!sameSplice(forward, backward)) return null
  return mapSplice(range.start, range.end, length, forward)
}

/**
 * Apply one textarea edit whose caret was observed. `editStart`/`editEnd` are
 * the selection before the input, in the same UTF-16 indexes as the draft.
 * `rejected` means the edit crossed the saved range. `unexplained` means that
 * caret does not account for the new string, so the caller must not guess.
 */
export const applyVoiceEdit = (
  anchor: Pick<VoiceAnchor, 'text' | 'start' | 'end'>,
  nextText: string,
  editStart: number,
  editEnd: number,
): VoiceEditResult => {
  const range = normalizeRange(anchor.text, anchor.start, anchor.end)
  const edit = normalizeRange(anchor.text, editStart, editEnd)
  const removed = edit.end - edit.start
  const insertedLen = nextText.length - (anchor.text.length - removed)
  if (insertedLen < 0) return { status: 'unexplained' }
  const inserted = nextText.slice(edit.start, edit.start + insertedLen)
  if (`${anchor.text.slice(0, edit.start)}${inserted}${anchor.text.slice(edit.end)}` !== nextText) return { status: 'unexplained' }
  const mapped = mapSplice(range.start, range.end, anchor.text.length, { at: edit.start, remove: removed, insert: inserted })
  if (!mapped) return { status: 'rejected' }
  return { status: 'applied', text: nextText, start: mapped.start, end: mapped.end }
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
  generation: () => number
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
    generation: () => operation,
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

export const currentVoiceGeneration = (): number => active?.generation() ?? 0

export const useVoiceInput = (): VoiceSnapshot =>
  useSyncExternalStore(
    (listener) => active?.subscribe(listener) ?? (() => undefined),
    voiceSnapshot,
    () => IDLE,
  )

export const deliverTranscript = (text: string, conversationId: string | null, generation: number) => {
  deliver?.(text, conversationId, generation)
}
