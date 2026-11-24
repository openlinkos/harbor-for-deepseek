SP-MD-098、SP-MD-100、SP-MD-101。任务列表的 `li` 补上 `ds-markdown-task-list-item`。原先只认 `node.type === 'input'`。remark 传给 `li` 的是 checkbox 组件，`props.type` 才是 `checkbox`，类名没加上，list-style 和颜色规则都没挂上。

没有改断言。
