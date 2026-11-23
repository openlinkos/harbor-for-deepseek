# r11 正文

答案 `.ds-markdown` 仍是 16px/28px。探针读到的 14px/24px 是思考块 `.ds-think-content.ds-markdown`，它用小号字体（SP-MD-054）。把答案也收成 14px 会改掉正文字号。

正文链接已有 `2px solid transparent`。探针先命中的是 `.cite`，角标不能再加 2px 边框，否则 14px 盒子会变（SP-MD-080、SP-CITE-145）。

思考里的引用块边距已是 `12px 0 0`。答案 `.prose blockquote` 保持 `16px 0 0`（SP-MD-026）。KaTeX 的 19.36px/23.232px 就是 `1.21em/1.2` 的计算值（SP-MD-985）。

没有改已有断言。
