SP-CITE-109。行内引用角标 `.cite` 的 padding 改为 `0 4px`，对齐规格 `.ds-markdown-cite`。

fb1554 cite-style，浅色和深色：改前（`2px 4px`）dyTop 2、dxGap 4、h 14、w 14。改后（`0 4px`）仍是 dyTop 2、dxGap 4、h 14、w 14。citeStyle 各键与夹具一致。dyTop 仍收到 2，期望 ≤ 0.5。没有改夹具，没有改容差，没有改回 `2px 4px`。

- apps/web/e2e/spec-align-citations.spec.ts:80 padding-top 2px -> 0px SP-CITE-109
