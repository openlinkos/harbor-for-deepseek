# Speech selection and late-operation ownership

## Saved selection

Root cause of the UTC full-run failure (`speech.spec.ts` expected `你好转写结果`, received `你好世界转写结果`):

The fixture did select `世界` (`selectionStart=2`, `selectionEnd=4`) on the same composer node. Production `focusComposer` schedules `requestAnimationFrame`, then focuses the composer and calls `setSelectionRange(value.length, value.length)`. Under a delayed frame (background/full-run load, reproduced by holding that frame until after the selection), the callback runs after the selection and collapses it to the end. The inserter then read the live caret at result time and appended. The same collapse happens when Escape calls `focusComposer` after a valid range exists. Isolated runs pass because the mount frame usually fires before the test selects. Evidence: `tasks/speech-domain/checks4-executor/selection-probe-before.json`. The minified frame is `focusComposer` (`fr` in the 821c125 bundle).

Policy, in `resolveVoiceAnchor`:

- The mic pointer-down saves `{conversationId, text, start, end}` before focus leaves the composer. Keyboard activation reads the current range if there was no pointer.
- An unchanged draft keeps that range, including a collapsed caret.
- If the saved draft is still a suffix, the range shifts by the prefix delta (insert or delete before it, including a caret that was at the end).
- If only the tail (selected text plus the text after it) is intact, the range anchors to that tail.
- If the head (text before the range plus the selected text) is intact, indexes stay so text added after the range stays after the transcript.
- A caret at the start stays at the start when the old draft remains a prefix.
- If both surrounding anchors are intact and the tail is non-empty, only the current middle is replaced. A pure append after a range that already reached the end is not treated as a middle edit.
- If the range reached the end and the user replaced that selected text, the new middle is replaced and the prefix is kept.
- An empty armed draft appends after whatever the user typed since.
- Any other concurrent edit returns null. The draft is left unchanged. Stale raw indexes are not applied.
- A late result whose conversation id does not match the armed id, or whose composer is gone, is not inserted.

`focusComposer` keeps a selection or value the user set after that focus was requested, so a delayed mount frame no longer erases the range before the mic click.

## Operation ownership

Reviewer N01/N02: a stale permission rejection or late grant cleared `armingCancel` after a newer start had stored its handle, so cancelling the newer pending recorder left its track live and its context running. The handle is now tagged with its operation. An older settle releases only its own handle.

Reviewer N03: `synthesize` throwing `AbortError` before the response, while this controller had not aborted and the generation was still current, returned without closing the context. Abort still skips the failure notice, but the current attempt always runs `finishAttempt`. A newer generation is not idled.

`AudioContext.close()` rejections are caught. That is cleanup of a floating promise, not a claim that a browser fault was reproduced.
