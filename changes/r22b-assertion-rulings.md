# r22b assertion rulings (owner 筑衡, 2026-11-25 01:26 CST, approved)

Source: `/workspace/deepapi-verify/pr68/round4/ADJUDICATION-share.md` (official CSS and bundle evidence). Pure assertion corrections; no product change, no tolerance change.

| test | old | new | basis |
|---|---|---|---|
| share-select.spec.ts:299 question bubble right (390) | 354 ±1 | 370 ±1 | official wrapper `align-items:flex-end`, bubble right 370 (adjudication item 4, line 76) |
| share-select.spec.ts:799 short bubble right | 354 ±1 | 370 ±1 | same |
| share-select.spec.ts:481 desktop dark wash | rgb(44,44,46) | rgb(33,33,35) | `--dsw-alias-bg-multi-select` → neutral-850 #212123, applies to desktop dark too (line 175) |
| spec-align-conversation.spec.ts:81 bubble margin-top (seed, no files) | 10px | 0px | `.fbb737a4._8271fc3` margin-top 10 only with files (lines 30/74) |
| attachment-cards.spec.ts (sent message with files) | — | `.bubble.has-files` margin-top 10px | existing fixture with attachments; same rule, no new tolerance |

Citation pair (fb1554-markdown cite-style light/dark 1440, 2 vs 0.5) is not waived. It fails identically on master a8df8b9 in both zones, so it is not a regression for the staged release.

## r22c (owner 筑衡, 2026-11-25 01:36 CST, approved)

| test | old | new | basis |
|---|---|---|---|
| share-select.spec.ts:367 answer checkbox vs question bubble (390) | bubble.bottom + 76 ±1 | bubble.bottom + 63 ±1 | ADJUDICATION-share.md:172: 76 has no official structural basis; +63 = official CSS structure (row 50 + sticky 13), consistent with the approved phone y=73 ruling. CSS-derived, no official 390 select-mode capture; re-pin if one is captured. |

Citation pair: confirmed pre-existing on master a8df8b9; not a staged-release blocker, still unwaived (stays FAIL), tracked as a follow-up.
