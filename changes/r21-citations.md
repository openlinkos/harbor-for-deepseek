相邻角标不再清掉左间距。官方每个 .ds-markdown-cite 包在自己的 <a> 里，.cite + .cite 对不上，左右各 2px，画出的间距是 4px。SP-CITE-113。

apps/web/e2e/fb1554-markdown.spec.ts:103 相邻角标边框间距从 2 改回 4（容差 0.5 未改）。明暗各一次。SP-CITE-113。

apps/web/e2e/fb1554-markdown.spec.ts:249 组内相邻角标间距从 2 改回 4（容差 0.5 未改）。组的 margin-left / margin-right 仍断言 2px。SP-CITE-113。
