普通对话不再留出分享勾选列。分享态才渲染吸顶复选框，问题和回答上方不再多出 44px 空块。

## 普通模式勾选列（SP-SHARE-033）

官方 mB 在非分享态 `return null`。e90725b 之后 `.share-col{display:contents}` 把 13+18+13=44px 的 `.share-sticky` 留在每条消息的文档流里。现在只在 `share.on` 时渲染 `.share-col` / `.share-sticky`。

对照 master a8df8b9（`/workspace/deepapi-dev/wt-spec-ref`，只读）：`ui.tsx` 的勾选框带 `hidden`，`input.share-box[hidden]{display:none}`，没有吸顶块。`.turn.user` 无 padding-top，`.bubble` 无 margin-top，气泡贴着行顶。本分支首条问题另有 SP-CV-284 的 34px padding-top。断言放在 `spec-align-conversation.spec.ts`：普通模式没有 `.share-col`/`.share-sticky`，气泡顶到行顶的距离等于 padding-top + margin-top（多出来的 44px 会失败），回答正文顶到行顶小于 20px。

## share-select 计数

改结构之前（dist 对应 e90725b，`CI=1 PW_PORT=4511`，retries 0）：**39 passed / 5 failed**。失败是灰块间距 12（实测差 3）、390 问题勾选框 y 76.5（实测 101.5）、1440 `inside`。阈值未改。

## 洗底改到消息体（SP-CV-088–097 / SP-SHARE-028 / SP-SHARE-029 / SP-CV-093）

官方 `hj`（`._7729a77:before`）包的是消息体，不是整行。用户内容放进 `.message-body`，洗底在这个盒子上居中：宽 `100%+32`，高 `100%+40`，圆角 12。首问 34px `padding-top`（SP-CV-284）和行底 16px `padding-bottom`（SP-CV-279）留在 `article` 上，不进洗底。回答的 `.prose` 仍是 `article` 的直接子节点（`article > .prose`）。回答洗底是同级元素：顶上伸出 20px，底边在行动条之上。行动条是已有的 50px（`padding: 12px 0 10px` 加 28px 按钮），所以 `bottom: calc(50px - 20px)`。这是 50 减官方垂直伸出，不是为了凑某个断言新写的常数。

分享态用 `visibility: hidden` 藏起 `.user-actions` 和 `.action-row`（官方 `.fa1bcf13`），空位保留。气泡 `margin-top: 10px` 只在有附件时（`._8271fc3` / SP-CV-340）。去掉三处拟合：`.turn.share-on { margin-bottom: 55px }`、栏上 12px / 手机 28.5px `padding-top`、手机气泡 `margin-right: 16px`。分享态问题行 `margin-bottom: 0`，盖住普通模式的 16px，因为官方屏幕行没有这段外边距（SP-CV-073 的 16px 只在打印）。滚动容器仍是 `padding-top: 0`（SP-SHARE-035）。a1dbee0 挪到栏上的 12px 不是官方行值，钉住后勾选框约在标题下 48px，落在 50±4 里，所以不留这个常数。

窄屏 42px 左内边距留在用户 `.message-body`（border-box、宽 100%），洗底按行的 border box 居中，`--panel-width` 才能铺到 0–390。回答行的 42px 仍在 `article` 上。勾选框点击仍走 `.share-box` 的 `pointer-events: auto`。
