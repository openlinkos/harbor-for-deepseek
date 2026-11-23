思考标题补上遮罩伪元素，消息列表改为相对定位，操作行用官方宽度和左偏移。

`.thinking > button` 定义 `--collapsible-area-title-height: 34px`，高度仍是 34px。桌面 `position: relative`，宽度保持内容宽度。`--group-title-sticky-base-top` 是 0px（6px 只属于分享链接页）。`::before` / `::after` 是遮罩，选中分享时改成多选底色。桌面不加 sticky、top、z-index 7，也不加 width 100%，避免和标题重叠。

`.transcript` 增加 `position: relative`，没有位移。

改过的断言：

- apps/web/e2e/spec-align-conversation-3.spec.ts:25 static -> relative SP-CV-352

`.action-row` 从 `margin-left: -6px` 改成 `left: -6px` 和 `width: calc(100% + 6px)`。

SP-CV-076、SP-CV-080、SP-CV-120、SP-CV-121、SP-CV-122、SP-CV-133、SP-CV-140、SP-CV-352。
