# r10 弹层

搜索对话框宽度 `min(660px, calc(100vw - 24px))`，有查询时高度 `72vh`、最大高度 `calc(var(--app-height, 100vh) - 24px)`。窄屏空对话框高度 `100vh`，有查询时 `100%`（SP-MOD-076–078、522–526、628、629）。菜单项改为 `min-height: 24px`、`padding: 8px 10px`、`line-height: 24px`（SP-MOD-036、486–491）。单行内容算下来仍是约 40px。

Toast 外层 `.toast-layer` 带 safe-area 的 top/bottom/left/right（SP-MOD-405–407）。药丸本身保持 `z-index: 2000`、padding `12px 18px`。`.settings-shell` 改为 flex（SP-MOD-536）。确认框宽度用 `--dsl-modal-content-width: 380px`（SP-MOD-007）；`.modal` 上的基础令牌是 525px（SP-MOD-006）。

`.settings-main` 的 flex-basis 改为 `0%`，并加 `min-height: 0`，数据页留在导航右侧（SP-MOD-536）。窄屏底栏里 `.settings-head` 改为 `flex: 0 0 auto`。桌面那条 `flex-basis: 100%` 在纵向 flex 里会变成高度且不收缩，主栏会被压成 padding（10px），主题卡片中心落到视口外。主栏保持 `overflow: auto`，卡片可以滚进视口。

已改断言：

- `apps/web/e2e/spec-align-settings-3.spec.ts:65` 语言菜单项 padding 从 `0px 10px` 改为 `8px 10px`。SP-MOD-036。高度仍是 `40px`。
- `apps/web/e2e/spec-align-settings-3.spec.ts:68` 语言菜单项 line-height 从 `22px` 改为 `24px`。SP-MOD-036。
