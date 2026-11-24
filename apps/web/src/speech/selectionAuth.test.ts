import { describe, expect, it } from 'vitest'
import { resolveVoiceAnchor } from './voiceSession.js'
import {
  applyHistory,
  applyObservedEdit,
  armSelectionAuth,
  decideDelivery,
  historyStepText,
  noteSelectionMove,
  noteUnobserved,
  recoverTranscriptAtCaret,
  resolveEditSpan,
  type SelectionAuth,
} from './selectionAuth.js'

const arm = (text: string, start: number, end: number, generation = 1) =>
  armSelectionAuth({ conversationId: 'c1', text, start, end }, generation)

const outside = (text: string, start: number, end: number) => ({
  before: text.slice(0, start),
  after: text.slice(end),
})

const expectSpanSurvives = (text: string, start: number, end: number, transcript: string) => {
  const kept = outside(text, start, end)
  const next = `${kept.before}${transcript}${kept.after}`
  expect(next.startsWith(kept.before)).toBe(true)
  expect(next.endsWith(kept.after)).toBe(true)
  expect(kept.before + kept.after).toBe(text.slice(0, start) + text.slice(end))
  return next
}

describe('selection authorization', () => {
  it('keeps an observed multi-edit sequence when the final string looks like one append', () => {
    let auth: SelectionAuth = arm('abcabc', 0, 3)
    auth = applyObservedEdit(auth, 'abcabcX', 6, 6)
    expect(auth).toMatchObject({ status: 'live', text: 'abcabcX', start: 0, end: 3 })
    auth = applyObservedEdit(auth, 'abcabcabcX', 0, 0)
    expect(auth).toMatchObject({ status: 'live', id: (auth as { id: number }).id, text: 'abcabcabcX', start: 3, end: 6 })
    const decision = decideDelivery(auth, 'abcabcabcX', 'c1', 1)
    expect(decision).toEqual({ action: 'insert', range: { start: 3, end: 6 } })
    if (decision.action !== 'insert') return
    expect(expectSpanSurvives('abcabcabcX', decision.range.start, decision.range.end, '转写结果')).toBe('abc转写结果abcX')
    expect(resolveVoiceAnchor('abcabcabcX', { text: 'abcabc', start: 0, end: 3 })).toEqual({ start: 0, end: 3 })
  })

  it('does not revive a deleted span when later typing restores the same characters', () => {
    const armed = arm('abcabc', 0, 3)
    let auth: SelectionAuth = applyObservedEdit(armed, 'abc', 0, 3)
    expect(auth).toMatchObject({ status: 'live', text: 'abc', start: 0, end: 0 })
    expect(armed).toMatchObject({ text: 'abcabc', start: 0, end: 3 })
    auth = applyObservedEdit(auth, 'abcabc', 3, 3)
    expect(auth).toMatchObject({ status: 'live', text: 'abcabc', start: 0, end: 0 })
    expect(auth.status === 'live' && auth.id).toBe(armed.id)
    const decision = decideDelivery(auth, 'abcabc', 'c1', 1)
    expect(decision).toEqual({ action: 'insert', range: { start: 0, end: 0 } })
    expect(resolveVoiceAnchor('abcabc', { text: 'abcabc', start: 0, end: 3 })).toEqual({ start: 0, end: 3 })
    if (decision.action !== 'insert') return
    expect(expectSpanSurvives('abcabc', decision.range.start, decision.range.end, '转写结果')).toBe('转写结果abcabc')
  })

  it('maps edits before, inside, and after the span without dropping outside characters', () => {
    let auth: SelectionAuth = arm('0123456789', 4, 6)
    auth = applyObservedEdit(auth, '0123ZZ6789', 4, 6)
    auth = applyObservedEdit(auth, 'A0123ZZ6789', 0, 0)
    auth = applyObservedEdit(auth, 'A0123ZZ6789B', 11, 11)
    expect(auth).toMatchObject({ status: 'live', text: 'A0123ZZ6789B', start: 5, end: 7 })
    const decision = decideDelivery(auth, 'A0123ZZ6789B', 'c1', 1)
    expect(decision).toEqual({ action: 'insert', range: { start: 5, end: 7 } })
    if (decision.action !== 'insert') return
    expect(expectSpanSurvives('A0123ZZ6789B', 5, 7, '转写结果')).toBe('A0123转写结果6789B')
  })

  it('shifts a surrogate pair and keeps surrounding spaces when the edit is outside it', () => {
    const emoji = '😀'
    const initial = `a b ${emoji} c`
    const emojiAt = initial.indexOf(emoji)
    let auth: SelectionAuth = arm(initial, emojiAt, emojiAt + emoji.length)
    auth = applyObservedEdit(auth, `前${initial}`, 0, 0)
    const withTail = `前${initial}后`
    auth = applyObservedEdit(auth, withTail, withTail.length - 1, withTail.length - 1)
    expect(auth.status).toBe('live')
    if (auth.status !== 'live') return
    expect(withTail.slice(auth.start, auth.end)).toBe(emoji)
    const decision = decideDelivery(auth, withTail, 'c1', 1)
    expect(decision).toEqual({ action: 'insert', range: { start: auth.start, end: auth.end } })
    if (decision.action !== 'insert') return
    const next = expectSpanSurvives(withTail, auth.start, auth.end, '转写结果')
    expect(next.startsWith('前a b ')).toBe(true)
    expect(next.endsWith(' c后')).toBe(true)
    expect(next).not.toContain(emoji)
  })

  it('restores the step identity on undo and redo, not another step with the same letters', () => {
    let auth: SelectionAuth = arm('abcabc', 0, 3)
    auth = applyObservedEdit(auth, 'abc', 0, 3)
    auth = applyObservedEdit(auth, 'abcabc', 3, 3)
    expect(historyStepText(auth, 'historyUndo')).toBe('abc')
    auth = applyHistory(auth, 'historyUndo', 'abc')
    expect(auth).toMatchObject({ status: 'live', text: 'abc', start: 0, end: 0 })
    auth = applyHistory(auth, 'historyUndo', 'abcabc')
    expect(auth).toMatchObject({ status: 'live', text: 'abcabc', start: 0, end: 3 })
    auth = applyHistory(auth, 'historyRedo', 'abc')
    expect(auth).toMatchObject({ status: 'live', text: 'abc', start: 0, end: 0 })
    const redone = applyHistory(auth, 'historyRedo', 'abcabc')
    expect(redone).toMatchObject({ status: 'live', text: 'abcabc', start: 0, end: 0 })
    expect(decideDelivery(redone, 'abcabc', 'c1', 1)).toEqual({ action: 'insert', range: { start: 0, end: 0 } })
  })

  it('undoes an invalidating edit back to the last live step and does not search by string', () => {
    let auth: SelectionAuth = arm('你好世界', 2, 4)
    auth = applyObservedEdit(auth, '完全不同', 0, 4)
    expect(auth).toMatchObject({ status: 'invalid', reason: 'crossed' })
    expect(noteUnobserved(auth, '你好世界')).toBe(auth)
    auth = applyHistory(auth, 'historyUndo', '你好世界')
    expect(auth).toMatchObject({ status: 'live', text: '你好世界', start: 2, end: 4 })
    const retyped = applyObservedEdit(arm('你好世界', 2, 4), '完全不同', 0, 4)
    expect(decideDelivery(retyped, '你好世界', 'c1', 1).action).toBe('recover')
  })

  it('keeps a whole typing run inside the selection and stops at a caret move', () => {
    let auth: SelectionAuth = arm('你好世界', 2, 4)
    auth = applyObservedEdit(auth, '你好大', 2, 4)
    expect(auth).toMatchObject({ status: 'live', text: '你好大', start: 2, end: 3, extendAtEnd: true })
    auth = applyObservedEdit(auth, '你好大家', 3, 3)
    expect(auth).toMatchObject({ status: 'live', text: '你好大家', start: 2, end: 4 })
    expect(decideDelivery(auth, '你好大家', 'c1', 1)).toEqual({ action: 'insert', range: { start: 2, end: 4 } })
    const stopped = applyObservedEdit(noteSelectionMove(applyObservedEdit(arm('你好世界', 2, 4), '你好大', 2, 4)), '你好大家', 3, 3)
    expect(stopped).toMatchObject({ status: 'live', text: '你好大家', start: 2, end: 3 })
    expect(expectSpanSurvives('你好大家', 2, 3, '转写结果')).toBe('你好转写结果家')
    const moved = noteSelectionMove(arm('你好世界', 2, 4))
    const after = applyObservedEdit(moved, '你好世界家', 4, 4)
    expect(after).toMatchObject({ status: 'live', text: '你好世界家', start: 2, end: 4 })
    expect(expectSpanSurvives('你好世界家', 2, 4, '转写结果')).toBe('你好转写结果家')
  })

  it('leaves the span in place when the caret moves and refuses a crossed or missing edit', () => {
    const auth = arm('abcd', 1, 3)
    expect(noteSelectionMove(auth)).toBe(auth)
    expect(applyObservedEdit(auth, 'abcdX', 4, 4)).toMatchObject({ status: 'live', start: 1, end: 3, text: 'abcdX' })
    expect(applyObservedEdit(auth, 'Zabcd', 0, 0)).toMatchObject({ status: 'live', start: 2, end: 4, text: 'Zabcd' })
    expect(applyObservedEdit(auth, 'Zd', 0, 3)).toMatchObject({ status: 'invalid', reason: 'crossed' })
    expect(applyObservedEdit(auth, 'zzz', 0, 0)).toMatchObject({ status: 'invalid', reason: 'unexplained' })
    const missed = noteUnobserved(auth, 'abcd!')
    expect(missed).toMatchObject({ status: 'invalid', reason: 'unobserved' })
    expect(decideDelivery(missed, 'abcd!', 'c1', 1)).toEqual({ action: 'recover', reason: 'unobserved' })
    expect(decideDelivery(auth, 'abcd', 'other', 1)).toEqual({ action: 'drop' })
    expect(decideDelivery(auth, 'abcd', 'c1', 2)).toEqual({ action: 'drop' })
    expect(decideDelivery(null, 'abcd', 'c1', 1)).toEqual({ action: 'drop' })
    expect(decideDelivery(auth, 'abcd?', 'c1', 1)).toEqual({ action: 'recover', reason: 'diverged' })
  })

  it('tracks a selection delete and each retyped character without reviving the old span', () => {
    let auth: SelectionAuth = arm('abcabc', 0, 3)
    const deleted = resolveEditSpan('abcabc', 'abc', 0, 3, 'deleteContentBackward')
    expect(deleted).toEqual({ start: 0, end: 3 })
    auth = applyObservedEdit(auth, 'abc', deleted?.start ?? 0, deleted?.end ?? 0)
    const typed = ['abca', 'abcab', 'abcabc']
    for (let index = 0; index < typed.length; index += 1) {
      const next = typed[index] ?? ''
      const at = 3 + index
      const before = auth.status === 'live' ? auth.text : ''
      const span = resolveEditSpan(before, next, at, at, 'insertText')
      expect(span).toEqual({ start: at, end: at })
      auth = applyObservedEdit(auth, next, span?.start ?? at, span?.end ?? at)
    }
    expect(auth).toMatchObject({ status: 'live', text: 'abcabc', start: 0, end: 0 })
    expect(decideDelivery(auth, 'abcabc', 'c1', 1)).toEqual({ action: 'insert', range: { start: 0, end: 0 } })
    if (auth.status !== 'live') return
    expect(expectSpanSurvives(auth.text, auth.start, auth.end, '转写结果')).toBe('转写结果abcabc')
  })

  it('resolves a collapsed deletion beside the caret, including a surrogate pair', () => {
    expect(resolveEditSpan('abcabc', 'abcab', 6, 6, 'deleteContentBackward')).toEqual({ start: 5, end: 6 })
    expect(resolveEditSpan('abcabc', 'bcabc', 0, 0, 'deleteContentForward')).toEqual({ start: 0, end: 1 })
    const emoji = '😀'
    const before = `a${emoji}b`
    const caret = 1 + emoji.length
    expect(resolveEditSpan(before, 'ab', caret, caret, 'deleteContentBackward')).toEqual({ start: 1, end: caret })
    expect(resolveEditSpan('abcd', 'abXcd', 2, 2, 'insertText')).toEqual({ start: 2, end: 2 })
    expect(resolveEditSpan('abcd', 'acd', 2, 2, '')).toBeNull()
    expect(resolveEditSpan('abcd', 'acd', 2, 2, 'deleteContentBackward')).toEqual({ start: 1, end: 2 })
    let auth: SelectionAuth = arm('你好世界', 2, 4)
    auth = applyObservedEdit(auth, '你好大', 2, 4)
    const span = resolveEditSpan('你好大', '你好', 3, 3, 'deleteContentBackward')
    expect(span).toEqual({ start: 2, end: 3 })
    auth = applyObservedEdit(auth, '你好', span?.start ?? 0, span?.end ?? 0)
    expect(auth).toMatchObject({ status: 'live', text: '你好', start: 2, end: 2, extendAtEnd: false })
    expect(decideDelivery(auth, '你好', 'c1', 1)).toEqual({ action: 'insert', range: { start: 2, end: 2 } })
  })

  it('inserts a recovered transcript at the caret and deletes nothing', () => {
    const next = recoverTranscriptAtCaret('完全不同', '转写结果', 2)
    expect(next).toEqual({ text: '完全转写结果不同', caret: 6 })
    expect(next.text.slice(0, 2)).toBe('完全')
    expect(next.text.slice(6)).toBe('不同')
    const end = recoverTranscriptAtCaret('完全不同', '转写结果', 99)
    expect(end.text).toBe('完全不同转写结果')
    expect(end.text.startsWith('完全不同')).toBe(true)
  })

  it('follows historyUndo and historyRedo one adjacent step at a time', () => {
    let auth: SelectionAuth = arm('abcabc', 0, 3)
    const deleted = resolveEditSpan('abcabc', 'abc', 0, 3, 'deleteContentBackward')
    expect(deleted).toEqual({ start: 0, end: 3 })
    auth = applyObservedEdit(auth, 'abc', deleted?.start ?? 0, deleted?.end ?? 0)
    for (const [next, at] of [['abca', 3], ['abcab', 4], ['abcabc', 5]] as const) {
      const before = auth.status === 'live' ? auth.text : ''
      const span = resolveEditSpan(before, next, at, at, 'insertText')
      expect(span).toEqual({ start: at, end: at })
      auth = applyObservedEdit(auth, next, span?.start ?? at, span?.end ?? at)
    }
    expect(auth).toMatchObject({ status: 'live', text: 'abcabc', start: 0, end: 0 })
    for (const next of ['abcab', 'abca', 'abc', 'abcabc']) {
      expect(historyStepText(auth, 'historyUndo')).toBe(next)
      auth = applyHistory(auth, 'historyUndo', next)
      expect(auth).toMatchObject({ status: 'live', text: next })
    }
    expect(auth).toMatchObject({ status: 'live', text: 'abcabc', start: 0, end: 3 })
    for (const next of ['abc', 'abca']) {
      expect(historyStepText(auth, 'historyRedo')).toBe(next)
      auth = applyHistory(auth, 'historyRedo', next)
      expect(auth).toMatchObject({ status: 'live', text: next })
    }
    expect(decideDelivery(auth, 'abca', 'c1', 1)).toEqual({ action: 'insert', range: { start: 0, end: 0 } })
  })

  it('does not walk to an older step just because the undone text repeats it', () => {
    let auth: SelectionAuth = arm('abcabc', 0, 3)
    auth = applyObservedEdit(auth, 'abc', 0, 3)
    auth = applyObservedEdit(auth, 'abca', 3, 3)
    auth = applyObservedEdit(auth, 'abcab', 4, 4)
    auth = applyObservedEdit(auth, 'abcabc', 5, 5)
    expect(auth).toMatchObject({ status: 'live', text: 'abcabc', start: 0, end: 0 })
    expect(historyStepText(auth, 'historyUndo')).toBe('abcab')
    const missed = applyHistory(auth, 'historyUndo', 'abcabc')
    expect(missed).toMatchObject({ status: 'invalid', reason: 'history-mismatch' })
    expect(decideDelivery(missed, 'abcabc', 'c1', 1)).toEqual({ action: 'recover', reason: 'history-mismatch' })
    const stepped = applyHistory(auth, 'historyUndo', 'abcab')
    expect(stepped).toMatchObject({ status: 'live', text: 'abcab', start: 0, end: 0 })
    expect(decideDelivery(stepped, 'abcab', 'c1', 1)).toEqual({ action: 'insert', range: { start: 0, end: 0 } })
  })

  it('keeps edits made after invalidation out of the undo snapshot', () => {
    const initial = 'L TARGET R'
    let auth: SelectionAuth = arm(initial, 2, 8)
    const first = resolveEditSpan(initial, 'N', 0, initial.length, 'insertText')
    expect(first).toEqual({ start: 0, end: initial.length })
    auth = applyObservedEdit(auth, 'N', first?.start ?? 0, first?.end ?? 0)
    expect(auth).toMatchObject({ status: 'invalid', reason: 'crossed' })
    expect(historyStepText(auth, 'historyUndo')).toBeNull()
    expect(historyStepText(auth, 'historyRedo')).toBeNull()
    expect(auth.status === 'invalid' && auth.steps[auth.cursor]?.text).toBe(initial)
    expect(applyObservedEdit(auth, 'NEW-DRAFT', 1, 1)).toBe(auth)
    expect(noteSelectionMove(auth)).toBe(auth)
    expect(applyObservedEdit(auth, 'NEW-DRAFXT', 8, 8)).toBe(auth)
    const undone = applyHistory(auth, 'historyUndo', 'NEW-DRAFT')
    expect(undone).toBe(auth)
    const redone = applyHistory(undone, 'historyRedo', 'NEW-DRAFXT')
    expect(redone).toBe(auth)
    expect(decideDelivery(redone, 'NEW-DRAFXT', 'c1', 1)).toEqual({ action: 'recover', reason: 'crossed' })
    const recovered = recoverTranscriptAtCaret('NEW-DRAFXT', '转写结果', 'NEW-DRAFXT'.length)
    expect(recovered.text).toBe('NEW-DRAFXT转写结果')
    expect(recovered.text.startsWith('NEW-DRAFXT')).toBe(true)
    const revived = applyHistory(auth, 'historyUndo', initial)
    expect(revived).toMatchObject({ status: 'live', text: initial, start: 2, end: 8 })
    const diverged = applyHistory(revived, 'historyRedo', 'NEW-DRAFXT')
    expect(diverged).toMatchObject({ status: 'invalid', reason: 'history-mismatch' })
    expect(decideDelivery(diverged, 'NEW-DRAFXT', 'c1', 1)).toEqual({ action: 'recover', reason: 'history-mismatch' })
    expect(decideDelivery(diverged, 'NEW-DRAFXT', 'other', 1)).toEqual({ action: 'drop' })
  })
})
