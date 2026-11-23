# r10 搜索侧栏

关闭时仍挂着 `.search-panel.is-closed`：宽度 0、`flex: 0 0 0`、`overflow: hidden`、`transition: none 0.2s ease-out`（SP-SEARCH-069、070、072、074、085、086、196）。打开的面板没有 `is-closed`，宽度仍是 `var(--sidebar-width)`。窄屏关闭态沿用 `display: none`（SP-SEARCH-125）。`toBeHidden` 对宽度为 0 的节点仍然成立。
