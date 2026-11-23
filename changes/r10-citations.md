# r10 引用

`.cite` 的 padding 从 `0 4px` 改为 `2px 4px`（SP-CITE-145，采集到的行内样式）。`top: -5px` 仍在。高度 14px、`box-sizing: border-box`，padding 算在高度里面。

相邻角标 `.cite + .cite` 的 `margin-left` 改为 `0`（SP-CITE-013、SP-CITE-113、SP-MD-047）。组的左右 margin 仍是 `2px`。

答案正文去掉单独的 `font-family` 覆盖，字族、行高、`vertical-align` 跟 master `a8df8b9` 的 `.prose` / `.cite` 声明一致。规格没有要求这段正文离开 Inter。padding `2px 4px` 是 SP-CITE-145，保留。

已改断言：

- `apps/web/e2e/spec-align-citations.spec.ts:80` `padding-top` 从 `0px` 改为 `2px`。SP-CITE-145。
- `apps/web/e2e/fb1554-markdown.spec.ts:249` 组内相邻角标间距从 `4` 改为 `2`。SP-CITE-113。`official-fb1554.json` 的 `firstGapPx` 仍是 4，该断言未改。
