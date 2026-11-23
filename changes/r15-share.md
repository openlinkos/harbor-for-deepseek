分享选择时，消息的直接子节点不接点击，点整条消息切换该组。

`.turn.share-on > *` 是 `pointer-events: none`。文章的 onClick 调用 `share.toggle(groupId)`。复选框仍是 absolute，位置没动。

改过的断言：

- apps/web/e2e/share-select.spec.ts:417 点击 `input.share-box` -> 点击 `.turn` SP-SHARE-149
- apps/web/e2e/share-select.spec.ts:438 点击 `input.share-box` -> 点击 `.turn` SP-SHARE-149
- apps/web/e2e/spec-align-citations.spec.ts:235 悬停并点击来源胶囊 -> 点击点不在胶囊上，白底保持，面板保持关闭 SP-SHARE-149
- apps/web/e2e/spec-align-search-panel.spec.ts:106 点击 search-results -> 点击点不在按钮上，面板保持关闭 SP-SHARE-149
- apps/web/e2e/spec-align-search-panel.spec.ts:108 点击 source-favicons -> 点击点不在按钮上，面板保持关闭 SP-SHARE-149
