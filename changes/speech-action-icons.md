# Speech action-icon expectation

Capability: V05 / V06. The assistant action row adds the read-aloud control. Its idle glyph is `IconPlayMediaOutline16` in `apps/web/src/speech/icons.tsx`. The measurement hash is FNV-1a of the three path `d` attributes joined by `|`, which is `d886c2b`.

`apps/web/e2e/fixtures/official-fb1344.json` is unchanged. The frozen five hashes stay the expectation for the other buttons.

## `apps/web/e2e/fb1344-parity.spec.ts:101-109` action-icons assertion

Old expectation, the whole button list:

`ae4e6054`, `7064ea2b`, `888d5160`, `9b087e69`, `62db06c4`

New expectation, same list with the read-aloud hash inserted at 朗读 (before 分享):

`ae4e6054`, `7064ea2b`, `888d5160`, `9b087e69`, `d886c2b`, `62db06c4`

Labels asserted with that order: 复制, 重新生成, 喜欢, 不喜欢, 朗读, 分享. Color still has to match `cell.actionColor` for every button, including 朗读. No screenshot, tolerance, skip, or known-failure change.
