# r11 分享

`.chat-column` 加上 `max-width: var(--message-list-max-width)`（桌面 840px，SP-SHARE-021）。宽度公式仍是 `min(752px, calc(100% - 88px))`，1440 下用到的宽度不超过 752，这条最大宽度不会收窄。

`.share-bar` 使用 `font: var(--dsw-font-s-14)`（SP-SHARE-092）。`.share-bar-inner` 高度改为 65px（SP-SHARE-020）。父栏有 1px 顶边，子项 `height: 100%` 算出来是 64px。

`.share-bar` 不加左右 padding。官方是 `0 calc(var(--message-list-padding-horizontal) - 16px)`（SP-SHARE-090）。横向对齐已经做在 `.share-bar-inner` 的 margin 上，和消息列对齐。再加 padding 会把这一行推离列。`share-select.spec.ts` 量的是这条对齐。

没有改已有断言。
