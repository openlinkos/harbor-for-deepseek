# r12 正文段落

正文和列表项里的段落加上 `ds-markdown-paragraph`。这是官网段落的类名。间距规则仍写在 `p` 上，版式不变。

已改断言：

- `apps/web/src/math.test.ts:32` 列表项段落从 `<li><p>` 改为 `<li><p class="ds-markdown-paragraph">`。SP-MD-409。
- `apps/web/src/math.test.ts:33` 同上。SP-MD-409。

代码块标题不可选中。底角颜色跟代码底色，叠层 6，颜色过渡 0.3 秒，右侧底角旋转 270 度。图工具文字按钮 12px、高 26px。没有新的断言改动。SP-MD-1006、SP-MD-1008、SP-MD-1011、SP-MD-1014、SP-MD-1016、SP-MD-1066、SP-MD-1067。

图工具栏 `user-select: none`。没有改已有断言。SP-MD-1068。SP-MD-1065 的 `-webkit-user-select` 是同一声明的前缀重复，不另写。
