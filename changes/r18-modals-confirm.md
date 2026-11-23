SP-MOD-469。`.confirm-card` 补上 `display: flex; flex-direction: column`。原先是 block，计算值是 row。标题不设 `flex: 1`，避免在随内容增高的对话框里被压扁。

SP-MOD-041。菜单图标字号改为 `calc(var(--ds-font-size-m) + 2px)`。宽高本来就是 16px。

SP-MOD-444。宽度低于 768 时，`.settings-head h2` 的 `flex-direction` 改为 column。桌面仍是 row。

SP-MOD-253、SP-MOD-254、SP-MOD-256。`.search-glyph` 从 grid 改成 flex，居中，`flex-shrink: 0`。宽高仍是 36px。

没有改断言。
