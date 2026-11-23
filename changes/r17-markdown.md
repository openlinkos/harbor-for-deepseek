# r17 markdown

思考区标题和段落边距改为 12px 0（SP-MD-022）。思考区嵌套列表 margin-top 改为 2px（SP-MD-042）。思考区列表段落 margin 改为 2px 0（SP-MD-043）。嵌套 ol 的 padding-left 为 0、list-style-position 为 inside、其段落 display 为 inline（SP-MD-103/104/105）。列表项首子 margin-top 0、末子（非代码块）margin-bottom 0（SP-MD-192/193）。

图表工具栏关闭时仍是「下载」。点开后的菜单项含「下载 PNG」（SP-MD-973）。

断言：
- apps/web/e2e/fb1721-markdown.spec.ts:69 思考区 p>ul 期望 4 -> 夹具里的间距 SP-MD-022
- apps/web/e2e/fb1721-markdown.spec.ts:74 思考区 nested 等于夹具 -> :77 计算 margin-top 为 2px SP-MD-042
- apps/web/e2e/mermaid-controls.spec.ts:74 `.diagram-menu` 数量 0 -> :73 菜单项「下载 PNG」可见 SP-MD-973
- apps/web/e2e/mermaid-controls.spec.ts:73 点击「下载」直接下载 svg -> :72 打开菜单，:75 再点「下载 SVG」SP-MD-973
