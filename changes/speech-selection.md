# Speech selection and late-operation ownership

## Saved selection

Root cause of the UTC full-run failure (`speech.spec.ts` expected `你好转写结果`, received `你好世界转写结果`):

The fixture did select `世界` (`selectionStart=2`, `selectionEnd=4`) on the same composer node. Production `focusComposer` schedules `requestAnimationFrame`, then focuses the composer and calls `setSelectionRange(value.length, value.length)`. Under a delayed frame (background/full-run load, reproduced by holding that frame until after the selection), the callback runs after the selection and collapses it to the end. The inserter then read the live caret at result time and appended. The same collapse happens when Escape calls `focusComposer` after a valid range exists. Isolated runs pass because the mount frame usually fires before the test selects. Evidence: `tasks/speech-domain/checks4-executor/selection-probe-before.json`. The minified frame is `focusComposer` (`fr` in the 821c125 bundle).

Policy, in `resolveVoiceAnchor` and `applyVoiceEdit`:

- The mic pointer-down saves `{conversationId, text, start, end}` before focus leaves the composer. Keyboard activation reads the current range if there was no pointer. That saved anchor is not replaced by a later suffix match.
- An unchanged draft keeps that range, including a collapsed caret.
- An empty armed draft puts the caret after text typed since, because that text was entered at the only caret.
- Any other string change is accepted only when the longest common prefix and the longest common suffix describe the same splice. The splice then moves the range: an edit before the range shifts it, an edit after it leaves it, and an edit inside it replaces that span. A suffix typed at a caret that was already at the end stays after the transcript.
- A repeated token can make a prepend and an append the same characters (`abcabc` plus another `abc` is `abcabcabc` either way). The two splices disagree, so the string mapper returns null. Before this check it treated every `endsWith(old draft)` as a prepend and returned `{3, 6}`, which replaces the middle copy. Fail-before: `checks4-executor/repeated-anchor-before.txt`.
- While the anchor is armed, each observed composer edit is a step on that authorization. `applyObservedEdit` maps one splice onto the current step. An append keeps the selection on the first `abc` (`转写结果abcabc`). An insert at the start shifts it (`abc转写结果abc`). The unselected copy and the new copy both stay. A later step is never replaced by `resolveVoiceAnchor` on the original string, even when the final text can be described as one splice or happens to equal the armed text.
- Deleting the selected copy and typing the same characters back is a new step. The collapsed caret stays collapsed. The string match against the armed draft is not an identity and must not delete the surviving copy.
- React's `onBeforeInput` only reports inserted characters (`keypress` / `textInput`). Backspace, Delete, and cut are observed from the textarea's native `beforeinput`, which still has the pre-edit selection. A collapsed deletion is not the caret: the span is the contiguous slice beside that caret that the new string accounts for, so one Backspace can remove a whole surrogate pair. If that slice does not explain the change, the span is invalidated and the transcript stays on the recovery offer.
- Undo and redo move the cursor on that step stack. They restore the range stored on the adjacent step. They do not search the stack for a matching string.
- Moving the caret without changing the draft does not retarget the span. Escape and a delayed focus frame can move the visible caret; the armed span stays.
- An edit that crosses the span, a caret that does not explain the new string, or a draft change with no observed caret invalidates the span. The new draft stays. The transcript is kept in the recovery offer. Insert at the caret adds it without deleting characters. Copy writes the clipboard only from that button. Dismiss drops the offer. A different conversation or generation drops the transcript and shows no offer.
- A splice that deletes or replaces text on both sides of the saved range invalidates. `完全不同` stays `完全不同` until the user inserts the transcript.
- This is not a claim that every arbitrary edit can be located. A repeated-text change with no observed caret stays on the recovery offer on purpose.
- A late result whose conversation id or generation does not match the armed attempt, or whose composer is gone, is not inserted.

`focusComposer` keeps a selection or value the user set after that focus was requested, so a delayed mount frame no longer erases the range before the mic click.

## Operation ownership

Reviewer N01/N02: a stale permission rejection or late grant cleared `armingCancel` after a newer start had stored its handle, so cancelling the newer pending recorder left its track live and its context running. The handle is now tagged with its operation. An older settle releases only its own handle.

Reviewer N03: `synthesize` throwing `AbortError` before the response, while this controller had not aborted and the generation was still current, returned without closing the context. Abort still skips the failure notice, but the current attempt always runs `finishAttempt`. A newer generation is not idled.

`AudioContext.close()` rejections are caught. That is cleanup of a floating promise, not a claim that a browser fault was reproduced.
