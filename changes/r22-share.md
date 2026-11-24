普通对话不再留出分享勾选列。分享态才渲染吸顶复选框，问题和回答上方不再多出 44px 空块。

## 普通模式勾选列（SP-SHARE-033）

官方 mB 在非分享态 `return null`。e90725b 之后 `.share-col{display:contents}` 把 13+18+13=44px 的 `.share-sticky` 留在每条消息的文档流里。现在只在 `share.on` 时渲染 `.share-col` / `.share-sticky`。

对照 master a8df8b9（`/workspace/deepapi-dev/wt-spec-ref`，只读）：`ui.tsx` 的勾选框带 `hidden`，`input.share-box[hidden]{display:none}`，没有吸顶块。`.turn.user` 无 padding-top，`.bubble` 无 margin-top，气泡贴着行顶。本分支首条问题另有 SP-CV-284 的 34px padding-top。断言放在 `spec-align-conversation.spec.ts`：普通模式没有 `.share-col`/`.share-sticky`，气泡顶到行顶的距离等于 padding-top + margin-top（多出来的 44px 会失败），回答正文顶到行顶小于 20px。

## share-select 计数

改结构之前（dist 对应 e90725b，`CI=1 PW_PORT=4511`，retries 0）：**39 passed / 5 failed**。失败是灰块间距 12（实测差 3）、390 问题勾选框 y 76.5（实测 101.5）、1440 `inside`。阈值未改。
