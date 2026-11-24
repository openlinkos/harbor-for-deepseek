设置行标签改为 flex: 1。

`.settings-line` 本来就是 `display: flex`、`align-items: center`、`justify-content: space-between`。标签从 `flex-shrink: 0` 改为 `flex: 1`。窄屏规则仍是 `flex: 1 1 auto`。

没有改已有断言。SP-SET-011、SP-SET-012、SP-SET-015、SP-SET-016。
