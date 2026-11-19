# Behavior parity

Owner-observed on the live client, or recorded in `official-dump/behavior-spec.md`. Anything not in those two sources is listed as unknown so it can be captured later. Harbor tests below lock the behavior Harbor implements today.

## Focus

| Action | Official | Harbor | Test |
| --- | --- | --- | --- |
| Home, after the key gate | Composer textarea is focused (owner, 2026-11-19) | `focusComposer()` on composer mount and when `activeId` changes | `focus.spec.ts` home load |
| Click 开启新对话 | Composer is focused (owner) | Same, including when a chat was already open | `focus.spec.ts` new chat |
| Open a chat from the sidebar | Composer is focused (owner) | Row click calls `focusComposer()` | `focus.spec.ts` open chat |
| Send a message | Composer is focused again (owner) | `submit()` calls `focusComposer()`; the caret is placed at the end of any remaining draft | `focus.spec.ts` send |
| Close settings, search, or the user menu | Composer is focused (owner) | Escape and the close buttons call `focusComposer()` | `focus.spec.ts` Escape |

Caret placement inside an existing draft, and whether focus moves on every key while a dialog is only partially closed, were not filmed.

## Keyboard

| Shortcut | Official | Harbor | Test |
| --- | --- | --- | --- |
| Enter in the composer | Not observed (`behavior-spec.md` §1 and the NOT OBSERVED list) | Sends. Shift is not held | `focus.spec.ts` Enter |
| Shift+Enter | Not observed | Inserts a newline and does not send | `focus.spec.ts` Shift+Enter |
| Escape | Closes the settings dialog (final-report addition; the key-up was not in a still). Search and the user menu were not filmed | Closes settings, search, the source panel, and the user menu, then focuses the composer | `focus.spec.ts` Escape |
| Ctrl/⌘ J | The new-chat hint shows a modifier + J. The key event itself was not filmed | Starts a new chat, including while the composer is focused. Linux and tests use Ctrl | `focus.spec.ts` Ctrl+J |
| Ctrl/⌘ K | Not observed. Search is opened from the magnifier in the stills | Opens search | `focus.spec.ts` Ctrl+K |

## Textarea size

Official grow-on-type and long paste were not observed. Harbor keeps the composer at its CSS height (`rows={2}`, chat `min-height` from `.composer textarea`) and does not grow the box with the text. Do not treat that as an official match until a capture exists.
