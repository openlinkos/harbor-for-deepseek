图标按钮和文字按钮套上对应变体的颜色变量。

`.icon-btn` 是透明底、次级文字、悬停用交互底色。侧栏图标是三级文字，悬停仍是三级色。`.action-row button` 和 `.user-actions button` 是三级文字，悬停只换底色。`button.ghost` 是无边框中性文字：内边距 0，字重 500，次级色，焦点环用主色。出错行里的重试按钮是 textInheritedPrimary，文字用主色，句子本身仍是红色。

侧栏图标的悬停底色从侧栏悬停色改成 `var(--dsw-alias-interactive-bg-hover)`。会话行悬停仍是侧栏色。窄屏媒体查询仍把图标悬停底色设成透明。

没有改已有断言。SP-UI-163、SP-UI-183、SP-UI-189、SP-UI-084、SP-UI-338、SP-UI-340。
