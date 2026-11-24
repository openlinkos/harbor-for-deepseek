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

## 灰缝（SP-CV-088，裁定 :392）

`h1_01_select_mode_last_selected.png` 是 1920×1200、RGB，1 图像像素 = 1 CSS px。中带（x 600–1500 步长 4，y 步长 2）里精确 `(245,246,247)` 的像素是 0。页面底是 `(244,246,246)`。这一帧没有问答洗底成对的白缝，不能用来量间距。

成对洗底在 `h1_03_after_checking_first_turn_2_selected.png`（1280×800，图像像素 ×1.5 = CSS px）。x=500、550、600、700、750 五行相同：

| y | 色 | 到洗底的 L1 |
|---|---|---|
| 161 | 245,246,247 | 0 |
| 162 | 244,246,247 | 1 |
| 163 | 252,252,252 | 18 |
| 164–169 | 255,255,255 | 27 |
| 170 | 249,249,250 | 10 |
| 171 | 245,246,247 | 0 |

洗底到白的 L1 是 27，一半是 13.5。按像素中心（y+0.5）插值：问题洗底下沿 163.2353，回答洗底上沿 170.2941。图像缝 7.0588，CSS 缝 **10.5882**。断言用这个数，容差仍是 ±1。没有改成 10 或 12。

同一提交只改了 `changes/r22-share-rulings.md` 点名的断言：:395 改为勾选框中心低于首行 8–10；:898 去掉 1440 的 inside（保留点击和 390）；:469 桌面圆角 12、窄屏 0；:468 手机洗底改为浅色 `rgb(245,246,247)`、深色 `rgb(33,33,35)`；:386/:388 右缘 390；:364 问题勾选框 y 73；:396 未钉住时 33。其余捕获值和容差未动。

## share-select 计数（改完之后）

`CI=1`、`--retries=0`。浏览器时区仍是 `playwright.config.ts` 里的 `timezoneId: Asia/Shanghai`，`TZ` 只作用于 Node。两个时区结果相同。

| 时区 | 端口 | 结果 |
|---|---|---|
| UTC | 4511 | **39 passed / 5 failed** |
| Asia/Shanghai | 4512 | **39 passed / 5 failed** |

改之前也是 39 / 5。失败项换了：灰缝、1440 `inside`、手机 y=76.5 这三项在 1440 浅色整段通过。1440 深色过了灰缝 10.5882±1、首行 8–10、未钉住 33、圆角 12，停在洗底颜色。390 几何在气泡右缘停下，后面的 y=73、右缘 390、灰缝没有跑到。勾选框点击和钉住（50±4）在 1440 和 390 都通过。

## 全量 e2e

`pnpm build`、`pnpm lint`、`pnpm typecheck`、`pnpm check-css`、`node scripts/check-specimen.mjs apps/web/src packages` 都是 exit 0。全量 `CI=1 --retries=0`，563 项。两个时区相同：

| 时区 | 端口 | 通过 | 预期失败 | 意外失败 | 跳过 |
|---|---|---|---|---|---|
| UTC | 4511 | 523 | 2 | 6 | 32 |
| Asia/Shanghai | 4522 | 523 | 2 | 6 | 32 |

预期失败是引用对：`fb1554-markdown.spec.ts:79` cite-style 浅色/深色 1440，`dyTop` 差 2，容差 0.5。日志在 `/workspace/deepapi-dev/tasks/T8-r22-e2e-UTC.log` 和 `T8-r22-e2e-Asia-Shanghai.log`。

## 剩下的差

阈值没有放宽。下面这些断言不在裁定名单里，产品按官方行留在现在的值。

| 断言 | 期望 | 实测 | 根因 | 规格行 |
|---|---|---|---|---|
| `share-select.spec.ts:299` 问题气泡右缘（390 浅色、深色） | 354±1 | 370 | 去掉了拟合 `margin-right: 16px`。窄屏行是 `align-items: flex-end`，没有右外边距。列右缘是 370。后面的 :364 / :386 / :392 没跑到。 | 洗底水平伸出是 `hj` 的 16px，不是气泡外边距。SP-CV-102 的面板宽是洗底，不是气泡。 |
| `share-select.spec.ts:799` 短气泡右缘（浅色、深色） | 354±1 | 370 | 同上。短气泡贴着内容盒右缘。 | 同上 |
| `share-select.spec.ts:481` 桌面深色洗底 | `tone.block` = `rgb(44, 44, 46)` | `rgb(33, 33, 35)` | 产品用 `--dsw-alias-bg-multi-select`（深色 neutral-850）。裁定只改了手机分支。浅色桌面的 `tone.block` 正好是 `rgb(245, 246, 247)`，所以浅色 1440 通过。 | SP-SHARE-029 |
| `spec-align-conversation.spec.ts:81` 气泡 `margin-top` | 10px | 0px | 种子消息没有附件。官方 `._8271fc3` 只在有附件时加 10px（SP-CV-340）。普通模式的 16px 下边距断言仍然通过（失败停在这一行之前，该断言已执行）。 | SP-CV-340 |

没有把 12px 栏间距留在产品里。钉住后勾选框约在标题下 48px，落在已有的 50±4 里，滚动容器保持 `padding-top: 0`。回答洗底的 `bottom: calc(50px - 20px)` 用的是已有行动条高度减去官方垂直伸出。
