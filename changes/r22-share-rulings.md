# r22 share rulings (owner 筑衡, 2026-11-25 00:15 CST)

Source: independent read-only adjudication `/workspace/deepapi-verify/pr68/round4/ADJUDICATION-share.md` (official captures `official-captures/share/`, official CSS `main.dc093a796f.css`, official bundle). Context: 昊辰 00:13 asked to ship a staged release of PR #68 now and continue remaining diffs in follow-up PRs.

## Assertion corrections approved (only these)

| share-select.spec.ts | old | new | basis |
|---|---|---|---|
| :395 answer checkbox vs first line | abs diff <= 2 | official measured offset 8–10 (checkbox centre lower than first-line centre) | adjudication #3 (b): h1_03 official itself differs 8–10px; CSS row top +13+9 |
| :898 checkbox inside the message box at 1440 | inside = true | drop the 1440 inside assertion (keep the click/toggle assertions, keep the 390 case) | official mB `left:-42px` is outside the row border at >=800 |
| :469 halo radius | 18px | 12px at desktop (SP-CV-093); narrow modifier stays as official | adjudication (b) |
| :468 phone wash colour | light rgb(236,242,249) | official token: light #f5f6f7 = rgb(245,246,247); dark #212123 = rgb(33,33,35) | `--dsw-alias-bg-multi-select` |
| :386/:388 phone fill right edge | 371 | 390 | `--panel-width` = panel offsetWidth (SP-CV-102), no official 371 |
| :364 phone question checkbox y | 76.5 | 73 | no official 390 select capture; derived from official CSS + mobile capture 05 |
| :396 user checkbox to wash top | 3 | 33 when NOT pinned; the pinned case keeps its own separately measured expectation | adjudication #2: the 3px was measured in a pinned (sticky) state |
| :392 grey gap 12 | frozen | stays frozen until the wrapper fix lands; then assert the measured product gap against the official 1440 capture value with the EXISTING tolerance. Do not choose 10 vs 12 by guess. | adjudication #1 (c), appendix A/B |

All other captured values and every tolerance stay unchanged.

## Product fixes approved

1. Selection wash lives on the message-body wrapper (official `hj` / `._7729a77:before`), not the whole row; first-question 34px padding-top stays outside the wash.
2. Share mode hides user action row and assistant action row with `visibility:hidden` (space kept, official `.fa1bcf13`), not `display:none`.
3. Render the sticky checkbox block (official `mB`) ONLY in share mode. Fixes the e90725b normal-mode regression where an empty 44px `.share-sticky` sat above every turn.
4. Bubble `margin-top: 10px` only when the message has attachments (official `._8271fc3`).
5. Remove fitted constants: `.turn.share-on { margin-bottom: 55px }`, the 28.5px column padding, and the phone bubble margin-right fit.

NOT approved: SP-CV-073 16px margin on screen assistant (it is `@media print` only).

## Release criterion (staged)

Gate v3 failing count is not a merge blocker for this staged release (its checker is unreviewed). Criterion: independent no-regression vs master a8df8b9, 昊辰's reported issues/decisions pass, round-4 regressions stay fixed.
