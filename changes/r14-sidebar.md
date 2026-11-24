会话行右侧渐变遮罩，搜索框内边距，收起按钮的层和名称。

`.chat-link::after` 是 56px 渐变，悬停和选中时出现。更多按钮仍在它上面。

`.search-field` 的内边距是 `12px 12px 12px 8px`。绝对定位相对的是 padding edge，所以图标、输入、关闭按钮仍用原来的对话框坐标，视觉位置不变。

`.collapsed-mark` 和 `.float-pill` 的 z-index 从 8 改为 10000。

侧栏搜索按钮名称从 智能搜索 改为 搜索。收起按钮从 隐藏 改为 收起边栏。收起后的浮条按钮改为 打开边栏。输入框上的智能搜索芯片没有改。

改过的断言：

- apps/web/e2e/pointer.spec.ts:175 智能搜索 -> 搜索 SP-SB-607
- apps/web/e2e/pointer.spec.ts:176 隐藏 -> 收起边栏 SP-SB-605
- apps/web/e2e/motion.spec.ts:181 隐藏 -> 收起边栏 SP-SB-605
- apps/web/e2e/spec-align-global-3.spec.ts:43 隐藏 -> 收起边栏 SP-SB-605
- apps/web/e2e/spec-align-sidebar-3.spec.ts:92 隐藏 -> 收起边栏 SP-SB-605
- apps/web/e2e/chat.spec.ts:235 隐藏 -> 收起边栏 SP-SB-605
- apps/web/e2e/chat.spec.ts:259 隐藏 -> 收起边栏 SP-SB-605
- apps/web/e2e/parity.spec.ts:742 隐藏 -> 收起边栏 SP-SB-605
- apps/web/e2e/spec-align-search-panel.spec.ts:158 隐藏 -> 收起边栏 SP-SB-605
- apps/web/e2e/spec-align-search-panel.spec.ts:210 隐藏 -> 收起边栏 SP-SB-605
- apps/web/e2e/spec-align-search-panel.spec.ts:154 隐藏 -> 打开边栏 SP-SB-606
- apps/web/e2e/spec-align-search-panel.spec.ts:164 隐藏 -> 打开边栏 SP-SB-606
- apps/web/e2e/spec-align-search-panel.spec.ts:212 隐藏 -> 打开边栏 SP-SB-606

SP-SB-090、SP-SB-096、SP-SB-098、SP-MOD-527、SP-SB-001。
