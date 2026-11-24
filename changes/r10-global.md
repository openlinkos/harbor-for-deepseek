# r10 全局

正文颜色按官方后一条 `body { color: purple }`（SP-GL-029）。`.shell` 另设主文字色，弹层不继承紫色。侧栏 padding 先写 safe-area 长属性，后写 `6px 12px 0`，与 `.b8812f16` 相同，实际是 6px 12px 0（SP-GL-087–090、114）。窄屏作曲器左右边距 16px（SP-GL-203）。宽度小于 440 时作曲器 padding 为 0（SP-GL-204）。

已改断言：

- `apps/web/e2e/spec-align-global.spec.ts:92` 正文颜色从「不是 `rgb(128, 0, 128)`」改为 `rgb(128, 0, 128)`。SP-GL-029。
