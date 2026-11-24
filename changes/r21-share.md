94c3cc2 的 `--share-pad-top` 25/8、负 margin、洗底 `calc(pad - 15/28)` 已撤。勾选列按官方行排：桌面 left -42px（SP-SHARE-104），窄列 left 0 加 padding-left 42px（SP-SHARE-034/030）。洗底用 `._7729a77:before` 的 20/16/12。截图对不上的差值只记录，不再拟合。

当前拟合构建先跑过：`e2e/share-select.spec.ts` 44 passed（PW_PORT=4511，dist 对应 6cbe587）。改完同一套 37 passed / 7 failed。阈值未放宽。

## 改动（file:line，旧 → 新，SP-ID）

- apps/web/src/ui.tsx:1324 去掉 `span.share-origin`。`.share-col` 是 `article.turn` 的直接子节点（官方 `.d30139ff` 与 `._7729a77` 同级，都在消息行里）。SP-SHARE-033。
- apps/web/src/styles.css:1108 新增 `.turn.user.is-first { padding-top: 34px }`。SP-CV-284。绝对定位的勾选框 `top: 0` 贴 padding edge，这 34px 不带动勾选框。
- apps/web/src/styles.css:1110 新增 `.turn.user:has(.edit-card) { padding-bottom: 10px }`。SP-CV-283。
- apps/web/src/styles.css `.turn.assistant` 仍无 padding（计算值 0）。SP-CV-024。SP-CV-026 的 10px 只在末条且没有底部操作行时成立；完成的回答带着操作行，相当于 `._43c05b5`，不加这 10px。
- apps/web/src/styles.css:4594–4607 删除 `--share-pad-top: 25px/8px`、`padding-top`、`margin-top: calc(var(--share-pad-top) * -1)`、桌面 `width: calc(100% + 42px)`、`margin-left: -42px`、桌面 `padding-left: 42px`。这些是被否决的拟合。
- apps/web/src/styles.css:4608–4616 删除 `.share-origin` 绝对定位端口。
- apps/web/src/styles.css:4596–4609 `.share-col`：`top: 0; bottom: 40px; left: -42px; right: 0; display: flex; align-items: flex-start`。SP-SHARE-033/102–106。窄列 `left: 0`。SP-SHARE-034。
- apps/web/src/styles.css:4611–4619 `.share-sticky` 保持 `height: 18px; padding: 13px 0; align-items: flex-start; top: calc(0px - var(--dsl-virtual-list-transform-y) + var(--dsl-virtual-list-ios-compensation-y))`。无虚拟列表，两个变量为 0。SP-SHARE-035/108–112。
- apps/web/src/styles.css:4623 `.share-box { position: static; pointer-events: auto }`。SP-SHARE-149 的 `> * { pointer-events: none }` 仍在行上；输入框自己接收点击，避免和 article 的 onClick 翻两次。
- apps/web/src/styles.css:4634–4650 洗底：`--padding-vertical: 20px`、`--padding-horizontal: 16px`、宽 `calc(100% + 2 * var(--padding-horizontal))`、高 `calc(100% + 2 * var(--padding-vertical))`、`top/left: 50%`、`translate(-50%, -50%)`、`border-radius: 12px`、`background: var(--dsw-alias-bg-multi-select)`。删掉 `calc(var(--share-pad-top) - 15px)`、回答 `-28px`、`right/left: -15px`、`border-radius: 18px`、浅色 `--dsw-static-neutral-bluish-60`、深色 `--dsw-static-neutral-bluish-850`。SP-CV-088–097、SP-CV-093、SP-SHARE-028/029。
- apps/web/src/styles.css:4650 窄洗底 `width: var(--panel-width); border-radius: 0`。SP-CV-102、SP-SHARE-099。`--panel-width` 仍由消息列表 `offsetWidth` 写入。
- apps/web/src/styles.css:4654–4660 `--share-pad-left: 42px` 只留在 `.shell.share-narrow .turn.share-on` 的 `padding-left`。SP-SHARE-030、SP-CV-098/099。rtl 改为 `padding-right`。SP-SHARE-100。
- apps/web/src/styles.css 删除分享态 `.transcript { padding-top: 0 }` 和 `.chat-column { padding-top: 12px / 28.5px }`。删除手机洗底 `left: -20px; right: -1px; background: rgb(236, 242, 249)` 和 `.share-box { left: 0 }`。
- `.turn.share-on { margin-bottom: 55px }` 未改。它来自 0acf18a，不是本次列出的官方 padding，也不是一个可以拿来凑 12px 间距的新常数。

## 断言差值（期望 vs 实测，未拟合）

拟合构建 44 passed。官方行之后：

- 1440 浅色/深色 `grey blocks … 12px apart`：期望间距 12±1，实测 15（断言收到的差是 3）。来源：洗底上下各伸出 20px（SP-CV-088）加上未改的 `margin-bottom: 55px`，55 − 20 − 20 = 15。没有 52px 的官方行。
- 1440/390 用户勾选框距洗底顶：期望约 3px（±1），实测 33px。来源：洗底顶在行顶之上 20px（SP-CV-088），勾选框在行顶之下 13px（SP-SHARE-111），20 + 13 = 33。
- 回答勾选框距洗底顶：期望 32–35，实测 33。这条在官方行上成立，被上面的间距断言挡住，测试没走到。
- 回答勾选框与首行中线：期望差 ≤2，实测 8。勾选框中心在行顶 + 13 + 9。
- 洗底圆角：期望 `18px`，桌面实测 `12px`（SP-CV-093），窄列实测 `0px`（SP-SHARE-099）。
- 洗底颜色：桌面浅色实测 `rgb(245, 246, 247)`，与 `tone.block` 一致（SP-SHARE-028）。手机浅色期望 `rgb(236, 242, 249)`，实测 `rgb(245, 246, 247)`。深色期望 `rgb(44, 44, 46)`，实测 `rgb(33, 33, 35)`（`--dsw-alias-bg-multi-select` → neutral-850，SP-SHARE-029）。
- 390 洗底：期望左 0 右 371。实测左 0 右 390。来源：`--panel-width` 是列表宽 390px（SP-CV-102），居中后铺满视口。
- 390 问题勾选框 y：期望 76.5±1，实测 85。来源：手机顶栏 60px + 滚动区 `padding-top: 12px` + 吸顶 `padding-top: 13px`（SP-SHARE-111）。SP-CV-284 的 34px 在 padding edge 之内，不推动 `top: 0` 的列。回答勾选框 y 实测 340；`bubble.y + height + 76` = 116 + 140 + 76 = 332。
- 1440 点击：`elementFromPoint` 的 class 含 `share-box`（通过）。`inside` 期望 true，实测 false。勾选框中心 x=441.5，行左边 474.5，在边框外 33px。来源：SP-SHARE-104 `left: -42px`，包含块是 padding edge，桌面行没有 42px 左内边距。390 的 `left: 0` 加 SP-SHARE-030 使点击测试通过（勾选并翻转）。不用负 margin 把边框拉出去。
- 吸顶距标题：期望约 50±4。1440 实测 gap 60（cbTop 74，titleTop 14）。390 实测 gap 65（cbTop 85，titleTop 20）。吸顶 `top` 按 SP-SHARE-109 算出 0；Chromium 再计入滚动区 padding-top 12px。没有官方行把分享态滚动区 padding-top 写成 0。

仍通过、且没有放宽阈值的部分：1440 正文/气泡 x 与宽不变（±1）；勾选框在正文左方 42px（断言允许 41±1）；桌面勾选框不压住洗底；390 正文 x 62、宽 308、右 370，气泡右 354，列 x 20 宽 350，勾选框 x 20 且 18×18；390 点击翻转。其余 37 条用例通过。

## 恢复滚动区内边距（a1dbee0）

分享多选时，滚动区的顶部内边距改加在消息列上：桌面 12px，手机 28.5px，滚动容器 `padding-top` 为 0。Chromium 不再把吸顶勾选框按滚动区内边距下推，长回答钉住时勾选框回到标题下约 50px。

`e2e/share-select.spec.ts`，PW_PORT=4511。恢复前（`changes/r21-share.md` 所记官方行构建，37 passed / 7 failed）。恢复后（dist `index-DjQXg4PS.css`）：**39 passed / 5 failed**。新通过的是 1440 与 390 的 `a pinned checkbox sits about 50px under the title`。阈值未改。

手机未滚动的问题勾选框从 85 变成 101.5（60 + 28.5 + 13）。76.5 那次成立，是因为当时还有 `share-port` 的 `top: -25px`。那个偏移不恢复。

## 仍失败的断言（14:31 CST，未再拟合）

同一轮里 1440 的几何在间距断言处停下，390 在问题勾选框 y 处停下。洗底圆角、颜色、窄列宽度这几条没跑到。它们的节点和规则这次没改，上一轮量到的值仍然成立。行内相对位置也不受列 padding 影响。

| assert | expected (captured) | got | root cause or open question | spec rows |
|---|---|---|---|---|
| `apps/web/e2e/share-select.spec.ts:392` grey blocks 12px apart (1440 light and dark; 390 not reached) | gap 12±1 | 15 (abs diff 3) | `.turn.share-on` margin-bottom 55px is from `0acf18a`, not a spec row. Wash extends 20px past each row (`55−20−20=15`). No 52px row. Dropping 55 leaves the user margin 16px and the gap goes to −24. | SP-CV-088, SP-CV-092. User row official padding-bottom is 16px (SP-CV-279), not this margin. |
| `apps/web/e2e/share-select.spec.ts:396` user checkbox ~3px from grey top (1440 not reached; same relative box as the prior run) | 3±1 | 33 | Wash top is 20px above the row (SP-CV-088, centered). Checkbox is 13px below the row (SP-SHARE-111). `20+13=33`. The 3px figure was the fitted user padding-top 25px. | SP-CV-088, SP-CV-095, SP-SHARE-102, SP-SHARE-111 |
| `apps/web/e2e/share-select.spec.ts:395` answer checkbox vs first-line center (1440 not reached) | ≤2 | 8 | Assistant row padding is 0 (SP-CV-024). Checkbox center is sticky padding 13 + 9 = 22px from the row top. First line center sits ~14px down. Official column is a sibling of the select wrapper on that same row, so the same sum applies. No row adds 8px. | SP-CV-024, SP-SHARE-108, SP-SHARE-111, SP-SHARE-036 |
| `apps/web/e2e/share-select.spec.ts:393–394` answer checkbox from grey top | 32–35 | 33 (prior run; not reached this run) | Same 20+13. This one is inside the captured band. | SP-CV-088, SP-SHARE-111 |
| `apps/web/e2e/share-select.spec.ts:364` question checkbox y (390 light and dark) | 76.5±1 | 101.5 | Phone topbar 60 + column padding-top 28.5 (the restored scroller gap, not a spec row) + sticky padding-top 13. Absolute `top: 0` ignores SP-CV-284's 34px. 76.5 needs the rejected `top: -25px` port (`60+28.5+13−25=76.5`). | SP-SHARE-102, SP-SHARE-111. Open: which official box is 25px above this column. |
| `apps/web/e2e/share-select.spec.ts:365` answer checkbox follows the question bubble (390 not reached) | `bubble.y + height + 76` | prior absolute 340 vs 332 (delta 8). Column padding moves bubble and checkbox together, so the delta stays. | Same in-flow column as the question box. | SP-SHARE-111, SP-CV-279 |
| `apps/web/e2e/share-select.spec.ts:898` checkbox inside the message box (1440) | true | false | SP-SHARE-104 `left: -42px` is outside the row border. SP-SHARE-030 padding-left 42px is only `._63c77b1` (panel under 800). At 1440 the list is wider, so `share-narrow` is off. Official `mB` is a child of the row with that same left. Checkbox still receives the click and toggles. | SP-SHARE-104, SP-SHARE-030, SP-SHARE-034 |
| `apps/web/e2e/share-select.spec.ts:469` halo radius (not reached) | `18px` | 12px at 1440 (SP-CV-093); 0 at 390 (SP-SHARE-099) | Official `._7729a77:before` radius is 12px, and the narrow modifier is 0. The capture's 18px is not that row. | SP-CV-093, SP-SHARE-099, SP-CV-103 |
| `apps/web/e2e/share-select.spec.ts:468` halo color (not reached) | 1440: `tone.block` (`rgb(245, 246, 247)` / dark `rgb(44, 44, 46)`). 390 light: `rgb(236, 242, 249)`. 390 dark: `rgb(44, 44, 46)` | `rgb(245, 246, 247)` light, `rgb(33, 33, 35)` dark (`--dsw-alias-bg-multi-select` → neutral-850) | 1440 light matches the token. Phone light `rgb(236, 242, 249)` and dark `rgb(44, 44, 46)` are not the alias. | SP-SHARE-028, SP-SHARE-029, SP-CV-104, SP-CV-105 |
| `apps/web/e2e/share-select.spec.ts:385–388` phone fill (not reached) | left 0, right 371 | left 0, right 390 | Narrow wash width is `var(--panel-width)` (SP-CV-102), centered (SP-CV-096). `--panel-width` is the transcript `offsetWidth` (390). Official `hk()` measures the same panel. No row says 371. | SP-CV-102, SP-CV-096, SP-SHARE-099 |
