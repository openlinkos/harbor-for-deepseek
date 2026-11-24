SP-MOD-185、SP-MOD-187。设置页签按钮补上 `min-height: 40px` 和 `justify-content: flex-start`。高度本来就是 40px。窄屏媒体查询里的 `justify-content: center` 仍在后面，390 宽时继续居中。

SP-MOD-440、SP-MOD-442、SP-MOD-443。`.settings-head h2` 改为 `display: flex; flex: 1; min-height: 0; align-items: center`。官方 `.f2ff50b5` 是标题。关闭按钮 `.settings-x` 不是这个节点。

SP-MOD-016、SP-MOD-482。`.edit-actions` 去掉 `gap: 8px`，非末位子节点改为 `margin-right: 8px`。按钮间距仍是 8px。官方 `.ds-modal-content__button-group>:not(:last-child)` 的 margin-right 是 8px。

没有改断言。
