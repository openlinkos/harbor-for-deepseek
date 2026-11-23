分享选择时，消息的直接子节点不接点击，点整条消息切换该组。

`.turn.share-on > *` 是 `pointer-events: none`。文章的 onClick 调用 `share.toggle(groupId)`。复选框仍是 absolute，位置没动。

改过的断言：

- apps/web/e2e/share-select.spec.ts:414 点击 `input.share-box` -> 点击 `.turn` SP-SHARE-149
- apps/web/e2e/share-select.spec.ts:435 点击 `input.share-box` -> 点击 `.turn` SP-SHARE-149
