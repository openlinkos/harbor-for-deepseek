# r17 search

手机搜索面板（宽度小于 768）关闭时 transform 为 translateY(36px)（SP-SEARCH-121）。打开时 transition-property 为 transform，transform 为 translateY(0)（SP-SEARCH-122、SP-SEARCH-123、SP-SEARCH-124）。桌面打开的面板仍是 transform none。搜索面板宽度仍是 min(calc(50vw - 4rem), 390px)。

SP-GL-180、SP-GL-181、SP-GL-182、SP-GL-183 是 HTML 预览壳 `._3f79b51` 的 --sidebar-width（768–1023 为 calc(50vw)，≥1024 为 calc(54vw)）。本应用没有这个预览壳。同一视口上 SP-SEARCH-192 要求搜索面板用宽 390px。两条规格给了不同宽度，本轮停在这里，不改搜索面板宽度。

断言：
- apps/web/e2e/site-icon.spec.ts:220 390 打开面板 transform none -> matrix(1, 0, 0, 1, 0, 0) SP-SEARCH-123
- apps/web/e2e/spec-align-search-panel.spec.ts:185 390 打开面板 transform none -> matrix(1, 0, 0, 1, 0, 0) SP-SEARCH-123
