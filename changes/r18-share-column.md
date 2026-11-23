SP-SHARE-033、SP-SHARE-102、SP-SHARE-103、SP-SHARE-104、SP-SHARE-105、SP-SHARE-106。消息勾选列仍是 `.share-col`：absolute、top 0、bottom 40px、left -42px、right 0、display flex。窄列表（面板宽小于 800）按 SP-SHARE-034 把 left 收到 0。

SP-SHARE-035、SP-SHARE-109、SP-SHARE-110、SP-SHARE-111、SP-SHARE-112。勾选框外的 `.share-sticky` 仍是 sticky，align-items flex-start，上下 padding 13px，高度 18px。没有虚拟列表，两个 transform 变量为 0，top 的计算值是 0px。SP-SHARE-107：窄列表里 sticky 的 z-index 是 1。勾选框本身仍是 padding 0、margin 0。

SP-SHARE-111 的 padding-top 13px 从官方勾选列的包含块顶边量起。官方列在消息行（`._9663006` / `._4f9bf79`，position relative）里面，`top: 0` 是消息行的顶，不是灰块的顶，也不是我们 `.turn` 的顶。灰块 `.share-halo` 在用户消息上高出 turn 15px，在助手消息上高出 28px。列若直接贴在 turn 上，padding 13px 会把勾选框放到灰块下 28px 和 41px，对不上 PR #56 的 1280×800 分享截图。

原点改成 `.share-port`（和 turn 一样高）。列在里面的 `.share-origin` 上仍是 top 0、bottom 40px、left -42px；sticky 仍是 padding 13px 0，top 计算值 0px。列是 flex，align-items 写成 flex-start，这样比 sticky 高的列也不会把勾选框挤离原点。用户原点上移 25px，勾选框落在灰块顶下约 3px。助手原点上移 8px，勾选框顶边回到 turn 顶下 5px，中线和首行对齐。截图几何是官方证据。

手机列表 `.transcript` 的 padding 顶边低于这条原点。sticky 的滚动口若是列表，top 0 会把勾选框夹到 padding 顶边上（首条长问题正好差 25px，y 变成 101.5）。`.share-port` 用 overflow:hidden 当勾选列自己的滚动口，顶边就是原点，padding 13px 从这里量。port 比 turn 左缘再伸出 42px，`.share-origin` 再把包含块挪回 turn 左缘，所以列的 left 仍是 -42px（窄列表 0），勾选框也不会被裁掉。

改了的断言：

reverted; origin mapping fixed
