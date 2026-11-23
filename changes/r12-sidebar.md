# r12 侧栏

搜索弹层关掉时会 `history.back()`。这个返回是异步的。紧接着再按 Ctrl+K 会先压入新的历史条目，迟到的返回把新条目弹掉，浏览器把输入框恢复成打开前的空快照，查询变成空字符串。现在下一次打开会等上一次返回结束再 `pushState`，输入框在返回完成前不挂上，所以恢复碰不到它。查询记在 `preservedQuery` 里，打开结果才清空。焦点放到按键之后再选中全文。

会话列表拆成外层 `.side-scroll-wrap`（上边距 24px）和内层 `.side-scroll`（`margin: 0 -2px`）。底部 72px 渐变改到外层 `::after`，不再用遮罩。分组标题内边距改为 `2px 8px 2px 10px`。用户名颜色改为次级，左边距 8px，不可选中，单行省略。当前会话的更多按钮 `z-index: 10`。

已改断言：

- `apps/web/e2e/spec-align-sidebar-3.spec.ts:53` 列表上边距从 `.side-scroll` 的 `24px` 改为 `.side-scroll-wrap` 的 `24px`，`.side-scroll` 的上边距为 `0px`、左右为 `-2px`。SP-SB-301。

会话标题按钮改为高 22px、行高 18px，弹性占满，外边距 `-2px 35px -2px -10px`。行本身仍是行高 22px。更多按钮在悬停和当前行都绝对定位在右侧 4px。没有新的断言改动。SP-SB-056、SP-SB-072、SP-SB-073。

侧栏 `will-change: transform, max-width`。未选中的会话在焦点内用悬停底色。新建按钮不收缩。重命名输入圆角 11px。没有改已有断言。SP-GL-095、SP-SB-085、SP-SB-086、SP-SB-229、SP-SB-420。
