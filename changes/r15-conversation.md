思考标题改为粘性，图标和阶段名各留 6px 右边距，按钮间距改为 0。

`.thinking > button` 是 `position: sticky`，`top: var(--group-title-sticky-top)`（普通对话基线 0），`z-index: 7`。滚动口在 `.chat-title` 下面，所以 top 0 不盖住标题。宽度仍是内容宽度。手机不再改 position / top / z-index。

图标 `margin-right: 6px`，`.phase-label` 也是 `margin-right: 6px`。原来的 `gap: 6px` 去掉，水平总间距仍是 6px。`timeline.spec.ts:204` 量的是竖向墨距，仍是 21，断言数字没改。

改过的断言：

- apps/web/e2e/chat.spec.ts:603 未断言 position -> sticky SP-CV-125
- apps/web/e2e/chat.spec.ts:604 未断言 z-index -> 7 SP-CV-126
- apps/web/e2e/chat.spec.ts:605 未断言 top -> 0px SP-CV-130
- apps/web/e2e/chat.spec.ts:611 有框才判断重叠 -> 必须不重叠 SP-CV-131
