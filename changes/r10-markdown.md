# r10 Markdown

思考块里段落后的列表上边距为 4px，段落后紧跟有序列表时段落下边距为 4px（SP-MD-039、040、041）。正文列表不在这条规则里。图表面板按钮：图表页「下载 SVG」（SP-MD-974），代码页「下载代码」（SP-MD-972）。没有单独的「下载 PNG」按钮。采集 `SP-MD-mermaid-light-1440.png` 只有一个 Download，`mermaid-controls.spec.ts:73` 点的也是这一个按钮。

已改断言：

- `apps/web/e2e/fb1721-markdown.spec.ts` 列表间距：思考块 `p>ul` 的期望从夹具里的 12 改为 4。`p>ol` 夹具本来就是 4。SP-MD-039。夹具 JSON 没有改。
