# r10 弹层

搜索对话框宽度 `min(660px, calc(100vw - 24px))`，有查询时高度 `72vh`、最大高度 `calc(var(--app-height, 100vh) - 24px)`。窄屏空对话框高度 `100vh`，有查询时 `100%`（SP-MOD-076–078、522–526、628、629）。菜单项改为 `min-height: 24px`、`padding: 8px 10px`、`line-height: 24px`（SP-MOD-036、486–491）。单行内容算下来仍是约 40px。

Toast 外层 `.toast-layer` 带 safe-area 的 top/bottom/left/right（SP-MOD-405–407）。药丸本身保持 `z-index: 2000`、padding `12px 18px`。`.settings-shell` 改为 flex（SP-MOD-536）。确认框宽度用 `--dsl-modal-content-width: 380px`（SP-MOD-007）；`.modal` 上的基础令牌是 525px（SP-MOD-006）。

没有改已有断言的期望值。
