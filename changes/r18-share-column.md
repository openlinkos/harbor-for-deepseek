SP-SHARE-033、SP-SHARE-102、SP-SHARE-103、SP-SHARE-104、SP-SHARE-105、SP-SHARE-106。消息勾选列是 `.share-col`：absolute、top 0、bottom 40px、left -42px、right 0、display flex。窄列表（面板宽小于 800）按 SP-SHARE-034 把 left 收到 0。

SP-SHARE-035、SP-SHARE-109、SP-SHARE-110、SP-SHARE-111、SP-SHARE-112。勾选框外的 `.share-sticky` 是 sticky，align-items flex-start，上下 padding 13px，高度 18px。没有虚拟列表，两个 transform 变量为 0，top 的计算值是 0px。SP-SHARE-107：窄列表里 sticky 的 z-index 是 1。勾选框本身仍是 padding 0、margin 0。1440 分享态测得 `.share-col` 的 bottom 是 40px、left 是 -42px。

勾选框的纵向位置跟着 SP-SHARE-111 的 padding-top 13px 走。用户消息旧的 top -12 变成 13，电话上的 y 从 76.5 到 101.5。助手消息旧的 top 5 变成 13，相对问题气泡的偏移从 76 到 84。桌面助手勾选框相对灰块顶从约 32–35 到 41，相对首行中线低 8px。用户勾选框相对灰块顶从约 3px 到 28px。

改了的断言：

- apps/web/e2e/share-select.spec.ts:365 问题勾选框 y 76.5 -> 101.5 SP-SHARE-111
- apps/web/e2e/share-select.spec.ts:366 答案勾选框相对问题气泡的偏移 76 -> 84 SP-SHARE-111
- apps/web/e2e/share-select.spec.ts:395 助手勾选框相对灰块顶下限 32 -> 40 SP-SHARE-111
- apps/web/e2e/share-select.spec.ts:396 助手勾选框相对灰块顶上限 35 -> 42 SP-SHARE-111
- apps/web/e2e/share-select.spec.ts:397 助手勾选框与首行中线对齐 -> 低于首行中线 8px（容差仍是 2）SP-SHARE-111
- apps/web/e2e/share-select.spec.ts:398 用户勾选框相对灰块顶 3px -> 28px SP-SHARE-111
