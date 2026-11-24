全屏不再写死 906×965。舞台、遮罩、幻灯片按官方 fancy box 行铺满视口，遮罩是 rgba(0,0,0,.88) 加 blur(2px)，页面透得出来。

先在旧 dist 上跑新测试，确认失败，再改布局，重建后同一套通过。阈值未放宽。对比度、溢出、缩放、下载断言未改。

## 失败（改之前，dist 仍是 906×965 卡片）

`e2e/mermaid-controls.spec.ts`「mermaid fullscreen tracks the viewport and the mask is not opaque」，PW_PORT=4511，1 failed。

- 1440×900：卡片 906×793，x 267，y 53.5。宽差 534，高差 107。`.diagram-modal .bg-mask` 数量 0。
- 1100×700：卡片 906×593，x 97，y 53.5。宽差 194，高差 107。遮罩数量仍是 0。

宽是 `min(906px, 100vw - 96px)`，高是 `min(965px, 100vh - 107px)`。遮罩是容器上的不透明 `rgb(31, 31, 31)`，没有 `.bg-mask`。

## 改动（file:line，旧 → 新，SP-ID）

- apps/web/src/styles.css:350–357 `.diagram-modal`：`position: fixed; inset: 0; z-index: 40; display: flex; padding: 0; background: rgb(31, 31, 31)` → `z-index: 2000; width: 100%; height: 100%; position: absolute; top: 0; left: 0`。SP-MOD-597 的属性是 z-index 2000；同一条官方规则（证据针）还有 width/height 100%、absolute、top 0、left 0。没有 906 或 965。
- apps/web/src/styles.css:359–368 新增 `.diagram-modal .bg-mask`：`backdrop-filter: blur(2px)`、`-webkit-backdrop-filter: blur(2px)`、`background-color: rgba(0, 0, 0, 0.88)`、100% × 100%、absolute、top 0、left 0。SP-MOD-265、SP-MOD-132、SP-MOD-266、SP-MOD-267、SP-MOD-268、SP-MOD-269、SP-MOD-270、SP-MOD-271。
- apps/web/src/markdown.tsx:269 门户里、关闭按钮之前，插入 `<div className="bg-mask" />`。
- apps/web/src/styles.css:370–384 `.diagram-modal-close`：`top: 16px; right: 20px` → `top: 12px; right: 12px`，并加 `z-index: 2001`。SP-MOD-348、SP-MOD-349、SP-MOD-141。宽高 32px 是原有按钮尺寸，这次没改。
- apps/web/src/styles.css:386–397 `.diagram-modal-card`：`width: min(906px, calc(100vw - 96px)); height: min(965px, calc(100vh - 107px)); background: #f9fafb; border-radius: 8px; padding: 40px 46px` → `width/height: 100%; position: absolute; top: 0; left: 0; display: flex; align-items: center; justify-content: center; background: transparent`。SP-MOD-520 宽 100%。SP-MOD-071 的证据针是同一条：`justify-content:center; align-items:center; width:100%; height:100%; position:absolute; top:0; left:0`。
- apps/web/src/styles.css 删除 `body[data-ds-dark-theme] .diagram-modal-card { background: #1b1b1c }`。卡片本身透明，遮罩留在四周。
- apps/web/src/styles.css:406–413 `.diagram-modal-card .mermaid svg` 增加 `background-color: var(--dsw-static-neutral-bluish-50)`；深色主题改为 `--dsw-static-neutral-bluish-850`。SP-MOD-074、SP-MOD-178。官方写在 `svg.theme_light` / `svg.theme_dark` 上；我们按页面主题选同一个 token。
- 未套用 `.ds-fancy-box__slide { opacity: 0 }`（SP-MOD-521）。那是加载态，套上会把图藏掉。
- apps/web/src/styles.css:4129 手机 `.diagram-modal { padding: 0 }` 保留。基座已经没有 padding，这条是空操作。
- apps/web/e2e/mermaid-controls.spec.ts:84–87 旧断言要求卡片离视口边至少 8px（`shell.y > 8` 且底边 `< view.height - 8`）。那是浮动 906×965 卡片的检查。改为幻灯片贴齐视口：y ≤ 1，宽高与视口差 ≤ 1。SP-MOD-520。容差仍是 1px，没有放宽。
- apps/web/e2e/mermaid-controls.spec.ts:163–188 新增测试：1440×900 与 1100×700 两档，面板盒子跟视口差 ≤ 1，且 `.bg-mask` 的 background-color 为 `rgba(0, 0, 0, 0.88)`、backdrop-filter 为 `blur(2px)`。

## 通过（重建 dist 之后）

`CI=1 PW_PORT=4511 pnpm exec playwright test e2e/mermaid-controls.spec.ts --reporter=line`：5 passed（8.5s）。含新测试、改过的全屏尺寸断言、浅色/深色对比度、390 溢出。
