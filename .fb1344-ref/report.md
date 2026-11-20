# fb1344：昊辰 13:44 / 14:05 反馈调查（样式、不居中、分享、版本号、流式阶段）

时间均为北京时间（Asia/Shanghai，2026-11-20）。调查者只读调查、写提案，没有改应用仓库，没有合并，也没有访问 chat.deepseek.com。截图附件是昊辰的私有文件，我读不到，只能按父 Agent 的文字描述对照。所有「官方」数字都来自已冻结的官方材料：`frozen/baseline/official-source/dom-*.html` 和 `main.dc093a796f.css` 离线渲染、`style-official-*.json`，以及官方 bundle `/workspace/official-bundle/main.5a15ff2247.js` 里的文案和逻辑。

## 0. 结论先说

- **线上版本**：13:44 截图时线上是 `499109b`（index-C7p8zkzp.js，我本地构建与之逐字节相同）。13:56:48 起线上是 `4734e7f`（见 `runs/live-4734e7f/live.md`）。
- **#48 没上线能解释的只有一项**：截图 1 里思考正文没有圆点和竖线。4734e7f 上圆点和竖线已经有了，行距也对了。
- **截图里其余问题在 4734e7f 上全部还在**，都是真实差异：
  - 方框图标
  - 箭头指向左
  - 来源胶囊尺寸和深色底色
  - 操作栏深色图标色
  - tooltip 位置
  - 分享行为
  - 设置里的「导入」按钮
  - 用户行不居中
- **新增两类严重问题**：
  - 流式过程中完全没有「正在思考 / 正在搜索 / 正在浏览网页」三个阶段，也没有 shimmer。
  - 另一会话正在生成时，新会话的发送键变成停止键，点下去会中断前一条生成。
- **检查器缺口有 6 类**，见 §4：
  - 只认图标的 fill/stroke 计数，不认路径
  - 没有方向度量
  - 不量居中
  - 设置行内控件只认 `<button>`
  - 不采深色下的回答底部
  - 完全没有流式进行中的状态
- **新方案已在 4734e7f 上逐条跑出红**：
  - `proposals/fb1344/e2e/fb1344-parity.spec.ts`：68 例（17 项 × 4 格，hover 两格跳过）
  - `probe-streaming.mjs`：分阶段 SSE
  - `check-css.mjs`：CSS 语法门禁，抓到 styles.css:591

## 1. 截图逐张根因（以 4734e7f 为准）

| 截图 | 现象 | 4734e7f 是否仍在 | 根因（代码位置） |
|---|---|---|---|
| 1 浅色回答页 | 「已思考」前是方框 | **仍在** | `ui.tsx` 思考标题用 `<Icon d="M6 4h12a2 2…">`。这个 d 不在 `ICON_GLYPH` 映射里，回退成自绘描边方框。官方是 16px 蓝色填充「原子」图标（2 段 path，fill 为 brand 色：浅色 rgb(57,100,254)，深色 rgb(86,134,254)） |
| 1 | 「已思考」后是「<」 | **仍在** | `Icon d="M9 6l6 6-6 6"` 被映射成官方 ⌄ 字形（path `M11.8486 5.5…`，本身朝下），又被 `.thinking .chev.open { transform: rotate(90deg) }` 转了 90°，结果朝左。官方展开态朝下，14px；我们 1440 是 16px |
| 1 | 思考正文没有圆点和竖线 | 已修 | #48 未上线所致。4734e7f 上有 5px 圆点和 1px 竖线 |
| 1 | 「搜索到 17 个网页」行 | 部分仍在 | 放大镜路径已是官方，但尺寸是 16px，官方 14px。浏览行图标是另一个字形（hash 43a1af0d），也是 16px；官方是 14px 文档图标（6aa47b08）。另外搜索**进行中**根本没有这一行（见 §5） |
| 1 | 标题颜色 | **仍在**（浅色 390 除外） | 1440 下标题文字和箭头用 tertiary，浅深都是 rgb(139,144,150)；390 写死 rgb(97,102,107)，所以浅色 390 恰好对，深色 390 错。官方用 secondary：浅色 rgb(97,102,107)，深色 rgb(207,211,214) |
| 2 深色设置·数据 | 导出/导入按钮宽度不一、文字不居中 | **仍在** | 「导入」是 `label.file-button`，72×40 加上 `justify-content: space-between`，文字比中心偏左 **9px**，比「导出」（72×36）高 4px。通用设置「导入界面包」也是 label：96×40，右缘停在 x=982，同页其他按钮在 1076。所有行内按钮 padding 都是 12px，官方是 `0 14px`。深色边框 rgba(255,255,255,.16)，官方是 `--dsw-alias-border-l2` = .12 |
| 3 深色回答底部 | 「17 个网页」胶囊 | **仍在** | 高 32.1（官方 34），左内边距 6px（官方 4px），深色底色 rgb(44,44,46)（官方 rgb(21,21,23)）。边框、16px 图标、4px 重叠、文字居中都对 |
| 3 | 操作图标 | 深色仍在 | 路径已是官方，复制/重试/赞/踩/分享 5 个 hash 都等于官方。深色颜色是 rgb(129,133,140)，官方 rgb(173,178,184)；浅色一致 |
| 3 | 「分享」tooltip | **仍在** | 我们的 tooltip 是 `::after` 伪元素，在按钮**上方**（bottom: 100%+6px），没有箭头，也没有 role=tooltip。官方 `Tooltip placement:"bottom"`（bundle 里 message_actions 的分享按钮），用 `.ds-tooltip--s`：4px 8px，12px/1.5，圆角 10，有箭头，背景 `--dsw-alias-tooltip-bg`（浅色 neutral-bluish-850，深色 neutral-bluish-750） |
| 3/4 | 分享行为 | **仍在** | 操作栏「分享」点了直接下载 `deepapi-answer.md`（probe 记录到 download 事件）。官方进入「选择对话」模式，见 §6 |
| 5 深色侧栏用户行 | 不居中 | **仍在** | 两个原因：① `.user-bar { height: 44px; padding: 6px 2px 13px 6px }` 上下 padding 不对称，头像、名字和「⋯」的中心都比行中心高 **3.5–3.9px**（官方 0）；② `styles.css:587–591` 有一段孤立声明（`color: var(--dsw-alias-label-tertiary); font-size; font-weight: 500; line-height: normal; }`），在 #29（ba10f48）合并时落在规则外。浏览器把它连同后面的 `.user-row small` 一起丢掉，所以头像字重是 400（官方 500），颜色是 primary（官方 tertiary：浅色 rgb(129,133,140)，深色 rgb(173,178,184)） |

量化依据：`runs/fb1344/compare-4734e7f.md` 是逐格的完整表：浅/深 × 1440/390，官方 | 499109b | 4734e7f。机器可读的失败项在 `compare-4734e7f.json`（208 条，含全站扫描）。

### 1.1 关键度量摘录（浅色 1440；深色与 390 见完整表）

| 组件 | 度量 | 官方 | 4734e7f |
|---|---|---|---|
| 思考标题 | 前置图标 | 原子图标 16px，fill brand，path `M8.00192 6.64454…` | 方框，stroke 1.7，path `M6 4h12a2 2…` |
| 思考标题 | 箭头（展开） | ⌄ 向下 14px，secondary 色 | 向左 16px，tertiary 色 |
| 思考标题 | 字号/行高/行高度 | 16px/28px/34 | 16px/28px/34（#48 已修） |
| 思考标题 | 图标→文字→箭头间距 | 6 / 6 | 6 / 6 |
| 搜索行 | 放大镜 | 14px | 16px |
| 搜索行 | 字号/行高/颜色 | 14px/24px/rgb(97,102,107) | 相同（深色 390 颜色错：rgb(97,102,107)，官方 rgb(207,211,214)） |
| 浏览行 | 图标 | 14px 文档图标 | 16px 另一字形 |
| 来源胶囊 | 高/左右内边距/圆角 | 34 / 4px 10px / 100px | 32.1 / 6px 10px / 999px |
| 来源胶囊 | 边框/底色（深色） | rgba(255,255,255,.12) / rgb(21,21,23) | .12 / rgb(44,44,46) |
| 操作栏 | 按钮/图标/间距 | 28 / 16 / 10 | 28 / 16 / 10 |
| 操作栏 | 图标色（深色） | rgb(173,178,184) | rgb(129,133,140) |
| 设置行内按钮 | 尺寸/内边距/圆角 | 72×36，0 14px，4096px | button 72×36，0 12px，18px；label 72×40 |
| 设置行内按钮 | 文字中心偏移 | 0/0 | button 0/−0.5；**导入 label −9/−0.5** |
| 侧栏用户行 | 头像/名字/⋯ 中心−行中心 | 0 / 0 / 0 | **−3.5 / −3.9 / −3.5** |
| 侧栏用户行 | 头像字重/颜色 | 500 / rgb(129,133,140) | 400 / rgb(15,17,21) |

## 2. 同类问题全扫

全站居中扫描在 4734e7f 上用 `|内容中心 − 容器中心| > 1px` 判定，范围是 回答页、侧栏、用户菜单、⋯ 菜单、设置四页 × 浅深 × 1440/390。内容中心取文字字形框和 svg/img 盒的并集，不算装饰层；下拉触发器这类本来就是左文右箭头的不判水平方向。剩下的是：

- 设置·数据「导入」×2（dx −9）
- 设置·通用「导入界面包」（右缘不齐、高 40）
- 侧栏用户行（dy −3.5 到 −3.9）

用户行不在通用选择器里，由专项量出。其他按钮、菜单项、胶囊、图标按钮的偏移都在 ±0.5px 以内。

所有设置行内按钮的 padding 都是 12px，官方 14px；深色边框都是 .16，官方 .12。宽度因为 min-width 72 看不出差，但 4 个字以上的按钮会比官方窄 4px。

## 3. 为什么 v2 / v3 / checks_fb1132 / interaction-gate 都没拦住

| # | 漏掉的问题 | 漏掉的是什么 | 具体原因 |
|---|---|---|---|
| G1 | 方框图标、浏览图标 | **图标身份**度量 | v2 `strict.py` 只数小图标的 fill/stroke 个数，而且容忍 `stroke > 官方 + 2`；单个描边图标正好漏掉。v3、fb1132 只验了设置导航 4 个图标。没有任何地方比对 path |
| G2 | 箭头朝左 | **方向**度量 | 箭头路径就是官方的，只是 CSS 转了 90°。路径比对、墨迹覆盖率、尺寸都看不出方向 |
| G3 | 导入按钮、用户行不居中 | **居中**度量 | v2 按元素文本配对比样式。label 和 button 的样式各自没有可比对象，就静默跳过。没有任何检查算「文字中心 − 容器中心」。用户行 v2b 只查「有圆形头像 + 名字」 |
| G4 | 设置·数据的导入 | **控件发现范围** | 所有检查只把 `button` / `[role=button]` 当按钮。`<label>` 包 file input 的控件不在任何检查里 |
| G5 | 深色胶囊、深色操作栏色、tooltip | **状态缺失** | 官方 answer 采集只有浅色（`answer-dark` 只有 1920，而且没有搜索/来源胶囊）；v2 深色只在有官方深色采集的状态比。hover 态 tooltip 从没采过 |
| G6 | 正在思考/正在搜索/正在浏览、shimmer、并发生成 | **整个状态族缺失** | 所有 mock 都用 `route.fulfill` 一次性返回完整 SSE，页面只能看到完成态。v3 `required.json` 和交互门禁都没有「进行中」状态。并发发送从没测过 |
| G7 | 孤立 CSS 声明 | **源码语法** | 没有 CSS 语法门禁。浏览器静默丢规则，样式比对只能看到「颜色不对」，追不到原因 |
| G8 | 分享点了下载 | 已知 | 交互门禁已有 knownFailure（fb1132 分享），等昊辰拍板后实现 |

另外，checks_fb1132 的 (a) 只量「标题字号 + 圆点 + 间距」，没有量图标和箭头，所以 #48 修完间距就全绿了。

## 4. 检查器修改方案（全部在 `proposals/fb1344/`）

| 文件 | 作用 | 补哪个缺口 |
|---|---|---|
| `lib/measure.js` | 页内度量库：盒、字形框、内容并集、居中偏移、可见边框（自身/子层/阴影）、svg 身份（viewBox + path hash + fill/stroke）、**svg 方向**（栅格 isPointInFill/Stroke 找尖端，再经屏幕 CTM 映射，CSS rotate 计入）、**全站居中扫描** | G1 G2 G3 G4 |
| `lib/components.js` | 同一套度量分别作用在官方 DOM 和我们的 DOM 上：思考标题、搜索/浏览行、来源胶囊、操作栏、用户行、设置行内控件（含 label/file input） | G3 G4 |
| `official-render.mjs` | 离线渲染冻结的官方 DOM + CSS，`body[data-ds-dark-theme]` 切深色，得到官方浅/深 × 1440/390 的组件数 | G5（深色官方值不必再等采集，组件级可直接得出） |
| `probe-ours.mjs` + `lib/mock-rich.mjs` | 用同一套度量测我们的构建：17 条结果、思考、浏览、引用 | — |
| `compare.py` | 逐项出表并判 PASS/FAIL，含设置按钮规则和全站居中扫描 | — |
| `lib/sse-control.js` + `lib/phases.mjs` + `probe-streaming.mjs` | **分阶段 SSE**：用 `window.fetch` 包一个由测试喂数据的 ReadableStream，按阶段 push，停在每个阶段截图并量样式；再单独跑一遍并发发送 | G6 |
| `check-css.mjs` | postcss 解析 CSS，规则外的声明或非法选择器直接失败 | G7 |
| `make-fixture.py` → `e2e/fixtures/official-fb1344.json` | 把官方数冻结成 e2e 基线（sha256 `f0346b9b…`），只有筑衡能重生成 | — |
| `e2e/fb1344-parity.spec.ts` + `e2e/lib/*` | **CI 门禁**：17 项 × 4 格。knownFailure 按 PR 分组；`FB1344_STRICT=1` 忽略 knownFailure | 全部 |

e2e 不能用 `route.fulfill` 做流式（它不分块），所以分阶段 SSE 在 fetch 层拦截。只影响 `api.deepseek.com/**/messages` 的 POST，别的请求照常走 route mock。

### 4.1 在 master 上先跑出红（证明方法正确）

- `compare.py --tag 4734e7f`：208 条 FAIL，覆盖截图里每一处。499109b 是 220 条，多出的就是 #48 修掉的标题字号/行高。
- `probe-streaming.mjs`：四格的 thinking、searching、browsing 三个阶段全部 ✗。标题始终是「已思考（用时 N 秒）」，0 个动画。并发发送：新会话里是 `stop` 键，点击后第一条 `aborted=true`，没有提示文案。
- `check-css.mjs apps/web/src/styles.css`：`styles.css:591:1 Unexpected }`，退出码 1。
- e2e 严格模式：见 §4.2（`runs/fb1344/e2e-strict-4734e7f.{log,json}`）。

**e2e 严格模式**（`FB1344_STRICT=1`，对 4734e7f，`runs/fb1344/e2e-strict-4734e7f.{log,json}`）：**57 失败 / 9 通过 / 2 跳过**。

- 9 个通过都是我们已与官方一致的格子：浅色胶囊底色 ×2、浅色操作图标 ×2、浅色 390 标题颜色、phase-done ×4。
- 2 个跳过：390 没有 hover tooltip。
- 典型失败信息：
  - think-lead-icon：期望 hash `7f13f22`，实际 `1996a9fa`
  - think-chevron：期望 `down`，实际 `left`
  - think-label-color：期望 rgb(97,102,107)，实际 rgb(139,144,150)
  - search-icon-size：期望 14，实际 16
  - browse-icon：期望 `6aa47b08`，实际 `43a1af0d`
  - pill-geometry：高差 1.9
  - share-tooltip：找不到 role=tooltip
  - settings-buttons：16 条问题，包括「导入界面包 h=40 right=982≠1076」以及各页 `pad=12px`（含账号管理的刷新、移除 Key）
  - user-row-centre：avatar 偏 3.5
  - centring-scan：「导入」dx=−9 ×2
  - phase-thinking：期望「正在思考」，实际「已思考（用时 6 秒）」
  - phase-searching / phase-browsing：同上
  - concurrent-send：first reply must keep generating，实际被中断
  - 深色 pill-bg：rgb(44,44,46)≠rgb(21,21,23)
  - 深色 action-icons：rgb(129,133,140)≠rgb(173,178,184)

**非严格模式**（knownFailure 生效，`e2e-known-4734e7f.{log,json}`）：**66 通过 / 2 跳过，EXIT 0**。可以直接作为 C0 合进 CI。每个修复 PR 删掉自己的 knownFailure；修好了却没删会报「Expected to fail, but passed」，CI 变红，修复不会被静默掩盖。

两处调试已修：spec 原来用 `__dirname`，在 ESM 下加载失败，改成 `fileURLToPath(import.meta.url)`；注入度量样式被站点 CSP `style-src 'self'` 拦住，改成 `bypassCSP: true`，只作用于测试浏览器。

### 4.2 门禁规则（写进 README §5 的「反馈 → 漏掉的状态/度量」流程）

1. 每条反馈先在 master 上跑出红，再修。
2. 图标比 path 身份（hash），不比「看起来像不像」。所有带方向的字形都量方向。
3. `|内容中心 − 容器中心| ≤ 1px` 是全站规则，新增例外只能由筑衡写进 allowlist 并说明原因。
4. 「控件」包括 label/file input/a.button，不只 `<button>`。
5. 每个组件都要在浅/深 × 1440/390 四格出数；官方深色值优先由离线渲染给出，渲染不了的进采集清单。
6. 有进行中形态的组件，必须有分阶段 SSE 的用例。
7. CSS 语法门禁先于构建。

## 5. 流式与进行中状态（14:05 反馈）

### 5.1 官方规格（官方 bundle 和 CSS 实读）

| 状态 | 触发（官方逻辑 `useCollapsibleAreaTitle`） | 标题 | 视觉 |
|---|---|---|---|
| 正在思考 | 消息 WIP，最后一个折叠片段是 THINK（或还没有片段） | 「正在思考」（messageThinking） | 蓝色原子图标 + 文字 shimmer + ⌄；思考正文与圆点、竖线在同一时间线里；进行中圆点颜色是 brand-primary 脉冲（#48 未做，待采集确认） |
| 正在搜索 | 最后片段是 TOOL_SEARCH 且 WIP，或是 SEARCH | 「正在搜索」（deepSearchSearching） | 同上。搜索行进行中文案是「搜索中...」，有 query 时是 messageSearchingWithQuery（中文待采集） |
| 正在浏览网页 | 最后片段是 TOOL_OPEN / TOOL_FIND 且 WIP | 「正在浏览网页」（groupTitleToolOpen）；查找时是「正在查找」 | 同上 |
| 已思考 | 一旦出现回答正文片段 | 「已思考（用时 N 秒）」。**N = 各思考片段 elapsedSecs 之和，四舍五入，最少 1**，不是墙钟 | 无 shimmer |
| 已停止 | 不再 WIP 且没有回答正文 | 「已停止」（messageThinkStopped）；思考中止是「思考已停止」 | 无 shimmer |
| 并发生成 | 另一会话还在生成时，在新会话发送 | 第二条照常显示为用户气泡；气泡左侧橙色圆形重试图标；气泡下灰字「有消息正在生成，请稍后再试」（msgGeneratingTryLater）；再下方复制、编辑 | 第一条**继续生成**；另有「正在生成中，请稍后再试」toast 和刷新提示 `hintLastMessageIsWIP`「有消息正在生成，请刷新页面查看」 |
| 进行中卡片 | 有会话在后台生成 | 输入框上方的缩略卡片，列出正在进行的会话 | 尺寸、内容待采集 |

**Shimmer 参数**，来自官方 CSS `.e4b3a110`、`.cac31b5e` 和组件 `gX`：

- **结构**：文字容器 `display: inline-block; position: relative; overflow: hidden`。里面叠一个绝对定位层，`width: fit-content; height: 100%; top: 0; left: 0`。这一层包两样东西：一条 **120px** 宽的高光条（shimmerWidth 默认 120），和一份 opacity 0 的同文案副本（用来把层宽撑到文字宽）。
- **动画**：`2s ease-out infinite`。关键帧 `0% { translateX(-100%) }` → `90%, 100% { translateX(100%) }`，即 1.8s 扫过、0.2s 停顿。
- **方向**：从左到右，`--shimmer-direction: 1`；RTL 是 −1，高光条再 `scaleX(-1)`。
- **渐变（浅色）**：`linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.7) 54.51%, rgba(255,255,255,0) 109.02%)`
- **渐变（深色，`[data-ds-dark-theme]`）**：`linear-gradient(90deg, rgba(21,21,23,0) 0%, rgba(21,21,23,.5) 54.51%, rgba(21,21,23,0) 109.02%)`
- **控制**：可以按 `animationPlayState` 暂停；`disabled` 时不渲染高光层。

### 5.2 我们现在（4734e7f，分阶段实测）

| 阶段 | 我们的标题 | shimmer | 其他 |
|---|---|---|---|
| thinking | 「已思考（用时 1 秒）」 | 无 | 方框图标、箭头朝左；1 个圆点 |
| searching | 「已思考（用时 2 秒）」 | 无 | **没有搜索行**（只有 server_tool_use、还没结果时什么都不画） |
| browsing | 「已思考（用时 3 秒）」 | 无 | 搜索行出现；浏览行出现 |
| answering / done | 「已思考（用时 3–4 秒）」 | 无 | 秒数是墙钟，从组件挂载开始算；官方是思考片段时长之和 |
| 并发 | — | — | 新会话的发送位是 `data-testid=stop`；点击后第一条被 abort；没有用户气泡、没有提示、没有输入框上方卡片 |

截图在 `runs/fb1344/shots/4734e7f-*-stream-*.png`，数据在 `stream-4734e7f.json`。

### 5.3 为什么没覆盖

见 G6：mock 是一次性 fulfill，所有检查器只能看到完成态。v3 `states.mjs` 没有进行中状态；交互门禁没有「生成中切会话再发」。官方采集也从没在流式中截过，`capture` 待办里有「流式」一项，但一直没做。

### 5.4 检查器方案

`probe-streaming.mjs` 和 e2e 的 `phase-*`、`concurrent-send` 用例已写好，并已在 master 上跑红。每个阶段量：标题文字、标题内无限动画（duration / timing / iteration）、渐变、图标身份和方向、圆点数、搜索行文字、停止键、输入框上方卡片、提示文案。官方的进行中圆点颜色和卡片尺寸采到之后，再加进 fixture。

## 6. 分享：官方完整状态与实现规格

官方逻辑来自 bundle，文案是逐字的。

**进入方式（3 个入口）**：

| 入口 | 官方行为 |
|---|---|
| 顶栏分享按钮（page_header） | `enterSelection(当前会话, "all")`，全部对话组预选 |
| 回答操作栏分享（message_actions，tooltip 在下方） | `enterSelection(当前会话, [该消息])`，只预选这一组 |
| 侧栏 ⋯ 菜单「分享」（session_item） | 先打开该会话，再 `enterSelection(会话, "all")` |

**选择模式**：

- **顶部**：标题「选择对话」（shareHeaderSelectConversation）+「取消」按钮（outlinedNeutral）。
- **每组对话**：用户问题 + 回答算一组，左侧有复选框（ds-checkbox：16px，圆角 6，边框 1.5px `--dsw-alias-border-l3`；选中填充 button-primary）。不可分享的消息禁用，提示「该消息不支持分享」；未就绪提示「该消息暂不支持分享，请稍后再试」。
- **底部栏**：
  - 「全选」复选框（shareSelectAll），全部选中时为勾选
  - 「已选择 N 组对话」，N = 选中消息数 / 2
  - 「取消」（outlinedNeutral），退出选择
  - 「创建分享链接」：主按钮，14px 图标，N=0 时禁用
- **布局**：窗口宽 < 800 时用窄布局；宽 ≥ 640 时有另一套排布（需采集 1440/390 两个宽度）。
- 选择过多时 toast「选择的消息过多，请减少选择后再试」。
- 切换会话自动退出选择。

**创建链接弹窗**（xg）：

- 说明文字：「任何获得链接的人都可以查看你分享的对话，请检查是否包含敏感或隐私内容。你可以随时在系统设置 - 数据管理中管理被分享的链接。」
- 按钮「创建并复制」（shareCreateLinkButton）。成功后复制链接，toast「分享链接已复制」，按钮变「已复制」，再点是「复制」。完成后退出选择。
- 失败：「生成链接失败」/「当前对话生成链接数达到上限」/「复制失败」。
- **这一步需要在官方真的创建分享，我没有做，在采集清单里标为 ⚠。**

**管理**（设置·数据「我共享的链接 → 管理」）：

- 列表项有「共享于 …」、「复制链接」、「删除」。
- 删除要二次确认：「确认删除吗？」「删除链接后，任何人无法通过该链接访问你分享的对话。」
- 空态是「暂无共享的链接」。
- 分享页本身有「该对话来自分享，由 AI 生成，请仔细甄别。」和「和 DeepSeek 继续聊」（品牌词替换）。

**我们三个入口现在**：

- 顶栏：系统分享或复制标题
- 操作栏：下载 `deepapi-answer.md`（已实测）
- ⋯ 菜单：下载 Markdown
- `ui.tsx:507` 还有一个指向 deepapi.linkos.io 的「分享」链接

我们没有选择模式，也没有链接服务。

**实现规格（建议）**：

- 选择模式、底栏、复选框、弹窗全部按官方 1:1 实现。
- 「创建并复制」要一个分享服务（deepapi.linkos.io，待办里已有）。服务没就绪之前有两个选项，**需要昊辰拍板**：
  - (a) 按钮可点，生成本机快照链接，只在本机可见；
  - (b) 弹窗显示「分享服务即将开放」，不创建。
- 拍板前，PR 只做到「进入选择 → 选择 → 弹窗出现」，按钮不发请求。

## 7. 版本号方案 vX.Y.Z

- **单一来源**：根 `package.json` 的 `version`，`apps/web/package.json` 保持同值。现在 package.json 是 0.1.0，CHANGELOG 已经写到 0.5.5，两边对不上。建议首个正式版本定 **v0.6.0**，之后修复升 patch、功能升 minor。
- **注入**：`proposals/fb1344/version/vite-version-plugin.ts`。构建时读 version，commit 取 `GIT_SHA` 构建参数（镜像构建上下文没有 .git），本地取 `git rev-parse`。产出三样：
  - `define __APP_VERSION__ / __APP_COMMIT__`
  - `index.html` 里的 `<meta name="app-version">`，以及 `<meta name="commit-id">`（官方 chat.deepseek.com 自己就有 `<meta name="commit-id" content="a75b64e9">`，我们对齐这个做法）
  - `dist/version.json`：`{version, commit, builtAt}`
- **页面显示**：官方页面上没有可见的版本位置，只有 meta。建议放在设置·服务协议页底部一行「DeepAPI v0.6.0 · 4734e7f」（testid `app-version`），作为品牌例外，**需昊辰批准**后写进 `frozen/explanations.json`。备选是用户菜单底部。
- **机器核验**：
  - `GET /version.json`；nginx 要给它加 `Cache-Control: no-store`，`deploy/web/nginx` 在应用仓库，我们能改
  - `<meta name="app-version">`
- **发布流程**：每个改动发布内容的 PR 自己升版本并写 CHANGELOG 标题，CI 强制。合并后 web-image 工作流额外打 `v{version}` 镜像 tag，并用 GITHUB_TOKEN 推 git tag `v{version}`（这种推送不会再触发工作流）。现有的 `YYYYMMDDHHmmss-sha` tag 保持不变，Flux 的 ImagePolicy 不受影响。不做「合并即自动升 patch」，因为那需要机器人往 master 推提交，会再触发一轮构建。
- **CI 检查**：
  - `version/check-version.mjs`：格式是 semver；两个 package.json 一致；PR 改了发布路径时版本必须大于 master，且 CHANGELOG 有 `## X.Y.Z — YYYY-MM-DD`；构建后 version.json 和 meta 与 package.json、GIT_SHA 一致
  - `version/version.spec.ts`：e2e
  - `version/live-version-check.mjs`：web-image 完成后轮询线上 `/version.json`，commit 必须等于 master SHA（25 分钟超时即红），meta 也必须等于 version.json
- **应用仓库内要改的文件**：
  - `package.json`、`apps/web/package.json`、`CHANGELOG.md`
  - `apps/web/vite.config.ts`
  - `apps/web/src/ui.tsx`（服务协议页一行）
  - `apps/web/e2e/version.spec.ts`
  - `scripts/check-version.mjs`
  - `.github/workflows/ci.yml`（跑 check-version，PR 传 BASE_REF）
  - `.github/workflows/web-image.yml`（build-args 传 GIT_SHA，加 `type=raw,value=v{{version}}` tag，推 git tag）
  - `deploy/web/Dockerfile`（`ARG GIT_SHA` → `ENV GIT_SHA`）
  - `deploy/web/nginx/*.conf`（version.json no-store）
  - 新增 `.github/workflows/live-version.yml`
- **交给守岳（flux-k8s，不归我们）**：**必需项为零**。可选两项：
  - (1) 在 `apps/harbor/harbor-web.yaml` 给 Deployment 加 annotation `app.kubernetes.io/version`，跟着镜像 tag 更新；
  - (2) 如果以后想让 Flux 按 semver tag 而不是时间戳 tag 选镜像，就改 ImagePolicy 的 filterTags 和 policy（semver）。这一项改变发布语义，需昊辰同意，不建议现在做。

## 8. PR 计划（每个 PR 从 master 拉分支，一个云端 Agent）

| PR | 一句目标 | 验收自动断言 | 涉及文件 | 冲突提示 |
|---|---|---|---|---|
| **C0 门禁先行**（筑衡/验证侧，不改应用逻辑） | 把 fb1344 门禁接进 CI，现状全部记为 knownFailure | `fb1344-parity.spec.ts` 全绿（test.fail 都按预期失败）；`check-css.mjs` 在 CI 跑；fixture sha256 进 tamper 清单 | `apps/web/e2e/fb1344-parity.spec.ts`、`e2e/lib/fb1344-*.js`、`e2e/fixtures/official-fb1344.json`、`scripts/check-css.mjs`、`.github/workflows/ci.yml` | ci.yml 与 V1 冲突，先合 C0。check-css 在 P4 修好之前会红，所以 C0 里先给 `styles.css:587-591` 加 allowlist 或允许它失败，P4 合并时删掉 |
| **P1 思考/搜索/浏览标题** | 官方原子图标、⌄ 方向和尺寸、标题颜色、放大镜和浏览图标 14px | 删掉 knownFailure：think-lead-icon、think-chevron、think-label-color、search-icon-size、browse-icon | `ui.tsx`（Thinking/AssistantTurn）、`glyphs.ts` 或 `official-icons.ts`、`styles.css`（.thinking 段、.timeline-*） | 与 P5 同改 Thinking 组件，**P1 先合，P5 rebase** |
| **P2 回答底部** | 来源胶囊 34 高、4/10 内边距、深色底色；操作栏深色色值；tooltip 改成下方 + 箭头 + role=tooltip | 删掉：pill-geometry、pill-bg-dark、action-color-dark、share-tooltip | `styles.css`（.sources-pill、.action-row、tooltip 段）、`ui.tsx`（tooltip 组件） | 与 P1 都改 styles.css，但段落不同，可并行 |
| **P3 设置行内按钮统一** | 所有行内按钮（含 label/file input）72×36、0 14px、圆角 pill、深色边框 .12、文字居中、右缘对齐 | 删掉：settings-buttons，以及 centring-scan 的设置部分 | `ui.tsx`（设置页 file-button → 统一的 SettingsButton）、`styles.css`（.account-quiet、.file-button） | 与 P4 都动 styles.css 中段，可并行 |
| **P4 侧栏用户行 + CSS 语法** | 修 `.user-bar` padding，删孤立声明，让头像 500 和 tertiary 生效 | 删掉：user-row-centre、centring-scan；`check-css.mjs` 绿 | `styles.css`（.user-bar、.avatar 段） | 最小 PR，可最先合 |
| **P5 流式阶段标题 + shimmer** | 正在思考/正在搜索/正在浏览网页/已思考/已停止；按官方参数做 shimmer；秒数 = 思考片段时长之和；搜索进行中显示「搜索中...」行 | 删掉：phase-thinking、phase-searching、phase-browsing；phase-done 保持绿 | `ui.tsx`（AssistantTurn）、`packages/i18n/src/index.ts`（新文案）、`styles.css`（shimmer）、`store.ts`（如需记录思考时长） | 等 P1 合入后 rebase |
| **P6 并发生成** | 另一会话生成时不中断；新会话照常发出用户气泡，显示橙色重试 + 「有消息正在生成，请稍后再试」+ 复制编辑；输入框上方进行中卡片 | 删掉：concurrent-send；新增卡片断言（官方采集后补） | `store.ts`（streaming 从全局改成按会话）、`ui.tsx`（composer、用户气泡）、i18n、styles.css | 改 store 的面最大，**单独进行**，不与 P5 同时改 AssistantTurn 的 streaming 判断，P5 先合 |
| **P7 分享模式**（等昊辰拍板 §6 两个选项） | 三入口进入选择模式、复选框、全选、已选数、取消、创建弹窗 | 交互门禁删掉分享相关的 knownFailure；新增：操作栏分享不触发 download、出现「选择对话」、预选 1 组；顶栏和 ⋯ 预选全部；N=0 时禁用 | `ui.tsx`（新 ShareSelection）、i18n、styles.css、`store.ts`（选择态） | 与 P6 都改 store，**P6 先合** |
| **V1 版本号** | v0.6.0、构建注入、version.json/meta、服务协议页显示、CI 和线上核验 | `check-version.mjs` 绿；`version.spec.ts` 绿；live-version 工作流绿 | 见 §7 | 与 C0 都改 ci.yml，C0 先合。服务协议页那一行等昊辰批准品牌例外 |

**可以并行**：P1、P2、P3、P4、V1（styles.css 段落互不重叠，冲突小）。**需要串行**：P1 → P5 → P6 → P7。会改同一文件的：
- `styles.css`：P1、P2、P3、P4、P5、P6、P7
- `ui.tsx`：除 P4 外全部
- `store.ts`：P5、P6、P7
- `ci.yml`：C0、V1

## 9. 需要你去采集的官方状态清单

规则：只在官方用标题带「[筑衡测试]」的测试会话；不动已有会话；不删除；改过的设置恢复；不碰账号、密钥、支付。下面每项都要浅/深 × 1440/390。DPR 1 截图，外加我们 capture2.js 的 computed style JSON。

### 9.1 静态 / 交互（组件级离线渲染给不出的）

| # | 状态 | 截图时机 | 要量的 computed style |
|---|---|---|---|
| S1 | 思考**折叠态**标题 | 点「已思考」收起后 | 箭头方向（⌄ 还是 ›）、transform、尺寸、颜色 |
| S2 | 操作栏 hover「分享」tooltip（另含复制/重试/赞/踩） | hover 后 300ms | tooltip 盒、相对按钮的 y、padding、字号行高、圆角、背景、文字色、箭头尺寸位置、box-shadow（深色有） |
| S3 | 设置·数据 深色 | 打开即截 | 管理/导出/删除按钮盒、`.ds-button__border` 颜色、文字色、hover 背景 |
| S4 | 侧栏用户行 深色 + hover | 静态 / hover | 行高、padding、头像字号字重颜色底色、名字和 ⋯ 的盒、hover 背景 |
| S5 | 来源胶囊 hover，及点开后的「搜索结果」右侧栏 | hover / 点击后 | 胶囊 hover 背景；侧栏宽、标题「搜索结果」、条目样式、关闭按钮 |
| S6 | 正文引用角标（灰色小方块 79、80）及「列表图标按钮」 | 回答完成后，hover 角标 | 角标盒、字号、底色、圆角、hover 卡片；列表按钮的位置、尺寸、图标 path |

### 9.2 分享

| # | 状态 | 截图时机 | 量什么 |
|---|---|---|---|
| H1 | 操作栏点分享 → 选择模式（预选 1 组） | 点击后 300ms | 顶部「选择对话」与取消按钮；每组复选框盒和位置（相对气泡）；选中和未选样式；底栏高、背景、阴影、各控件盒；「已选择 1 组对话」字号颜色 |
| H2 | 顶栏分享 / ⋯ 菜单分享 → 选择模式（全选） | 同上 | 全选态复选框、已选数 |
| H3 | 取消全部 → N=0 | 点全选取消后 | 「创建分享链接」禁用样式 |
| H4 | 点「创建分享链接」→ 弹窗 | 弹窗出现时 | 弹窗盒、标题、说明文字、按钮「创建并复制」样式。**到此为止，不要点「创建并复制」** |
| H5 ⚠ | 创建并复制后的结果 | **需要真的在官方创建分享链接，不要做**，除非昊辰明确同意。同意后再用测试会话创建，采完立刻在「我共享的链接」里删掉（删除也要他同意） | 按钮「已复制」态、toast、链接格式 |
| H6 | 设置·数据「我共享的链接 → 管理」 | 打开弹窗 | 列表或空态「暂无共享的链接」的样式 |

### 9.3 流式与进行中（需要发消息，测试会话里开深度思考 + 智能搜索，问一个需要搜索的问题）

建议录 60fps 屏幕视频，并在控制台每 100ms 抓一次标题区快照（`getComputedStyle` + `innerText`），因为「正在搜索」只闪一下。

| # | 状态 | 截图时机 | 要量的 computed style |
|---|---|---|---|
| L1 | 正在思考 | 发送后出现标题即截 | 标题文字；原子图标 path/fill；⌄ 方向；`._5255ff8` 和 `.e4b3a110` 的 animation（name/duration/timing/iteration）、transform 取样 3 帧；`.cac31b5e` 的 width 和 background-image；进行中圆点颜色和动画；思考正文颜色 |
| L2 | 正在搜索 | 视频逐帧找；或在 DevTools 网络面板把 completion 请求节流到 Slow 3G 来拉长 | 同 L1；搜索行进行中文案（「搜索中...」或带 query 的文案）和图标 |
| L3 | 正在浏览网页 | 出现「正在浏览网页」时 | 同 L1；浏览行进行中样式 |
| L4 | 已思考（用时 N 秒） | 回答正文刚开始时 | 标题无动画；N 与思考实际时长的关系（记下发送、首字、思考结束三个时间） |
| L5 | 停止生成后 | 思考中点停止 | 「已停止」或「思考已停止」样式 |
| L6 | 并发：A 会话生成中，新开 B 会话发送 | B 发送后 | B 用户气泡；橙色重试图标的盒、颜色、path；「有消息正在生成，请稍后再试」的字号颜色位置；复制和编辑图标；A 是否继续 |
| L7 | 输入框上方进行中卡片 | L6 同时 | 卡片容器盒、每张卡片的尺寸、内容（标题、状态）、圆角、阴影、点击行为（只截不点，或点了只看跳转） |
| L8 | 点 L6 的橙色重试 | A 仍在生成时，以及 A 结束后 | 提示与行为 |

## 10. 运行方式与产物

```bash
cd /workspace/deepapi-verify/proposals/fb1344
node official-render.mjs                                   # 官方组件数（离线）
node probe-ours.mjs --url http://127.0.0.1:4601 --tag 4734e7f
python3 compare.py --tag 4734e7f --ref 499109b              # → runs/fb1344/compare-4734e7f.md
node probe-streaming.mjs --url http://127.0.0.1:4601 --tag 4734e7f
POSTCSS=<postcss 路径> node check-css.mjs apps/web/src/*.css
# e2e（放进 apps/web/e2e 后）：FB1344_STRICT=1 跑出红；不设则 knownFailure 生效
```

产物在 `runs/fb1344/`：
- `official-components.json`
- `ours-{4734e7f,499109b}.json`
- `compare-*.{md,json}`
- `stream-4734e7f.json`
- `e2e-strict-4734e7f.{log,json}`
- `shots/`：official-*、4734e7f-*、499109b-*、*-stream-*

红跑用的 worktree 是 `wt/fb1344-red`（4734e7f + spec，未提交）。本地预览 4601 和 4602 已关闭；重跑前用 wt/4734e7f、wt/499109b 的 `vite preview` 重新启动。
