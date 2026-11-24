import { applyVoiceEdit, insertTranscript, type VoiceAnchor } from './voiceSession.js'

/**
 * Authorization for one voice-input attempt.
 * The span is an identity carried through observed edits. A later draft that
 * happens to equal an older string is a different step unless undo/redo moves
 * the cursor on this stack. String equality never revives a deleted span.
 */
export type AuthStep = { text: string; start: number; end: number; extendAtEnd: boolean }

export type InvalidReason = 'crossed' | 'unexplained' | 'unobserved' | 'history-mismatch'

type AuthBase = {
  id: number
  conversationId: string | null
  generation: number
  steps: AuthStep[]
  cursor: number
}

export type LiveAuth = AuthBase & {
  status: 'live'
  text: string
  start: number
  end: number
  /** True only while the user is still typing inside a non-collapsed span, with no caret move in between. */
  extendAtEnd: boolean
}

export type InvalidAuth = AuthBase & {
  status: 'invalid'
  reason: InvalidReason
}

export type SelectionAuth = LiveAuth | InvalidAuth

export type DeliveryDecision =
  | { action: 'insert'; range: { start: number; end: number } }
  | { action: 'recover'; reason: InvalidReason | 'diverged' }
  | { action: 'drop' }

let nextAuthId = 1

const clampRange = (text: string, start: number, end: number) => {
  const length = text.length
  const rawStart = Number.isFinite(start) ? start : length
  const rawEnd = Number.isFinite(end) ? end : rawStart
  return {
    start: Math.max(0, Math.min(rawStart, rawEnd, length)),
    end: Math.min(length, Math.max(rawStart, rawEnd, 0)),
  }
}

const invalidate = (auth: SelectionAuth, reason: InvalidReason): InvalidAuth => {
  if (auth.status === 'invalid') return auth
  return {
    status: 'invalid',
    id: auth.id,
    conversationId: auth.conversationId,
    generation: auth.generation,
    reason,
    steps: auth.steps,
    cursor: auth.cursor,
  }
}

const liveAt = (auth: SelectionAuth, cursor: number): SelectionAuth => {
  const step = auth.steps[cursor]
  if (!step) return invalidate(auth, 'history-mismatch')
  return {
    status: 'live',
    id: auth.id,
    conversationId: auth.conversationId,
    generation: auth.generation,
    text: step.text,
    start: step.start,
    end: step.end,
    extendAtEnd: step.extendAtEnd,
    steps: auth.steps,
    cursor,
  }
}

export const armSelectionAuth = (
  armed: Pick<VoiceAnchor, 'conversationId' | 'text' | 'start' | 'end'>,
  generation: number,
): LiveAuth => {
  const range = clampRange(armed.text, armed.start, armed.end)
  const step = { text: armed.text, start: range.start, end: range.end, extendAtEnd: false }
  const id = nextAuthId
  nextAuthId += 1
  return {
    status: 'live',
    id,
    conversationId: armed.conversationId,
    generation,
    text: armed.text,
    start: range.start,
    end: range.end,
    extendAtEnd: false,
    steps: [step],
    cursor: 0,
  }
}

const pushStep = (auth: LiveAuth, step: AuthStep): LiveAuth => {
  const steps = auth.steps.slice(0, auth.cursor + 1)
  steps.push(step)
  return {
    status: 'live',
    id: auth.id,
    conversationId: auth.conversationId,
    generation: auth.generation,
    text: step.text,
    start: step.start,
    end: step.end,
    extendAtEnd: step.extendAtEnd,
    steps,
    cursor: steps.length - 1,
  }
}

/**
 * A caret move that does not change the draft does not retarget the span.
 * It does stop a typing run from treating the next character as still inside that span.
 */
export const noteSelectionMove = (auth: SelectionAuth): SelectionAuth => {
  if (auth.status !== 'live' || !auth.extendAtEnd) return auth
  const steps = auth.steps.slice()
  const current = steps[auth.cursor]
  if (!current) return auth
  steps[auth.cursor] = { ...current, extendAtEnd: false }
  return { ...auth, extendAtEnd: false, steps }
}

/**
 * One textarea edit whose pre-edit selection was observed.
 * `rejected` (the edit crossed the span) and `unexplained` (the caret does not
 * account for the new string) invalidate. They do not fall back to a whole-string guess.
 */
export const applyObservedEdit = (
  auth: SelectionAuth,
  nextText: string,
  editStart: number,
  editEnd: number,
): SelectionAuth => {
  if (auth.status !== 'live') return auth
  if (nextText === auth.text) return auth
  const edit = clampRange(auth.text, editStart, editEnd)
  // The keystrokes after the first one in a selection replacement land at the
  // span's end. They stay inside it. A caret move clears this, so a later
  // character typed after the span is not swallowed.
  if (auth.extendAtEnd && auth.start !== auth.end && edit.start === auth.end && edit.end === auth.end) {
    const insertedLen = nextText.length - auth.text.length
    if (insertedLen < 0) return invalidate(auth, 'unexplained')
    const inserted = nextText.slice(auth.end, auth.end + insertedLen)
    if (`${auth.text.slice(0, auth.end)}${inserted}${auth.text.slice(auth.end)}` !== nextText) return invalidate(auth, 'unexplained')
    return pushStep(auth, { text: nextText, start: auth.start, end: auth.end + insertedLen, extendAtEnd: true })
  }
  const mapped = applyVoiceEdit(auth, nextText, editStart, editEnd)
  if (mapped.status === 'rejected') return invalidate(auth, 'crossed')
  if (mapped.status === 'unexplained') return invalidate(auth, 'unexplained')
  const inside = edit.start >= auth.start && edit.end <= auth.end
  return pushStep(auth, {
    text: mapped.text,
    start: mapped.start,
    end: mapped.end,
    extendAtEnd: inside && mapped.start !== mapped.end,
  })
}

const explainsSpan = (before: string, next: string, start: number, end: number) => {
  if (start < 0 || end < start || end > before.length) return false
  const removed = end - start
  const insertedLen = next.length - (before.length - removed)
  if (insertedLen < 0) return false
  const inserted = next.slice(start, start + insertedLen)
  return `${before.slice(0, start)}${inserted}${before.slice(end)}` === next
}

const BACKWARD_DELETE = new Set([
  'deleteContentBackward',
  'deleteWordBackward',
  'deleteSoftLineBackward',
  'deleteHardLineBackward',
  'deleteEntireSoftLine',
])

const FORWARD_DELETE = new Set([
  'deleteContentForward',
  'deleteWordForward',
  'deleteSoftLineForward',
  'deleteHardLineForward',
])

/**
 * The pre-edit range a textarea input actually replaced.
 * A non-collapsed selection is that range when it explains the new string.
 * A collapsed Backspace or Delete does not: the caret sits beside the
 * characters that disappeared, and those characters can be a whole surrogate
 * pair. The span is the contiguous slice next to the caret that accounts for
 * the new string. Anything else returns null so the caller does not guess.
 */
export const resolveEditSpan = (
  before: string,
  next: string,
  selStart: number,
  selEnd: number,
  inputType: string,
): { start: number; end: number } | null => {
  const length = before.length
  const start = Math.max(0, Math.min(Number.isFinite(selStart) ? selStart : length, Number.isFinite(selEnd) ? selEnd : length, length))
  const end = Math.min(length, Math.max(Number.isFinite(selStart) ? selStart : 0, Number.isFinite(selEnd) ? selEnd : 0, 0))
  if (explainsSpan(before, next, start, end)) return { start, end }
  const delta = before.length - next.length
  if (delta <= 0 || start !== end) return null
  if (BACKWARD_DELETE.has(inputType)) {
    const from = start - delta
    if (from >= 0 && explainsSpan(before, next, from, start) && next === `${before.slice(0, from)}${before.slice(start)}`) {
      return { start: from, end: start }
    }
  }
  if (FORWARD_DELETE.has(inputType)) {
    const to = start + delta
    if (to <= length && explainsSpan(before, next, start, to) && next === `${before.slice(0, start)}${before.slice(to)}`) {
      return { start, end: to }
    }
  }
  return null
}

/** The draft changed with no observed caret. Keep the new characters and drop automatic insertion. */
export const noteUnobserved = (auth: SelectionAuth, nextText: string): SelectionAuth => {
  if (auth.status !== 'live') return auth
  if (nextText === auth.text) return auth
  return invalidate(auth, 'unobserved')
}

/**
 * Text of the adjacent observed step while this authorization is live.
 * An invalid draft is not a step. Null tells the caller to leave the browser's
 * undo or redo result alone. The last live snapshot is not that result, and
 * text equality with it must not be used to overwrite the draft.
 */
export const historyStepText = (auth: SelectionAuth, direction: 'historyUndo' | 'historyRedo'): string | null => {
  if (auth.status !== 'live') return null
  if (direction === 'historyUndo') {
    if (auth.cursor <= 0) return null
    return auth.steps[auth.cursor - 1]?.text ?? null
  }
  return auth.steps[auth.cursor + 1]?.text ?? null
}

/**
 * Move along the observed stack when `nextText` is already the browser's undo
 * or redo result. The caller does not replace the draft with a snapshot.
 * The next text must be the adjacent step. Searching the stack for any equal
 * string is intentionally not done: a retyped copy of an older draft is a new
 * step, not the old span. An invalidated draft becomes live again only when
 * this undo landed on the step that was left, not when a later draft happens
 * to contain the same characters.
 */
export const applyHistory = (
  auth: SelectionAuth,
  direction: 'historyUndo' | 'historyRedo',
  nextText: string,
): SelectionAuth => {
  if (direction === 'historyUndo') {
    if (auth.status === 'invalid') {
      const step = auth.steps[auth.cursor]
      if (step && step.text === nextText) return liveAt(auth, auth.cursor)
      return auth
    }
    if (auth.cursor <= 0) return nextText === auth.text ? auth : invalidate(auth, 'history-mismatch')
    const step = auth.steps[auth.cursor - 1]
    if (!step || step.text !== nextText) return invalidate(auth, 'history-mismatch')
    return liveAt(auth, auth.cursor - 1)
  }
  if (auth.status !== 'live') return auth
  const step = auth.steps[auth.cursor + 1]
  if (!step || step.text !== nextText) return invalidate(auth, 'history-mismatch')
  return liveAt(auth, auth.cursor + 1)
}

export const decideDelivery = (
  auth: SelectionAuth | null,
  currentText: string,
  conversationId: string | null,
  generation: number,
): DeliveryDecision => {
  if (!auth) return { action: 'drop' }
  if (auth.conversationId !== conversationId || auth.generation !== generation) return { action: 'drop' }
  if (auth.status === 'invalid') return { action: 'recover', reason: auth.reason }
  if (auth.text !== currentText) return { action: 'recover', reason: 'diverged' }
  return { action: 'insert', range: { start: auth.start, end: auth.end } }
}

/** Insert without removing any character that is already in the draft. */
export const recoverTranscriptAtCaret = (text: string, transcript: string, caret: number) => {
  const at = Number.isFinite(caret) ? Math.max(0, Math.min(Math.trunc(caret), text.length)) : text.length
  return insertTranscript(text, transcript, { start: at, end: at })
}
