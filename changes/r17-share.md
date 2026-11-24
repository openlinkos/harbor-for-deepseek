# r17 share

消息列表宽度小于 800px 时，选中态消息外壳 padding-left 为 42px（SP-CV-099、SP-SHARE-030）。窄屏 ::before 的 border-radius 为 0，宽度为测得的 --panel-width（SP-SHARE-099）。选中消息 ::before 的背景为 --dsw-alias-bg-multi-select（SP-SHARE-029）。选中消息设置 --search-sites-summary-bg-color: transparent 和 --search-sites-summary-bg-transition-duration: 0（SP-CV-112、SP-CV-113）。

SP-SHARE-031 没有不可选消息节点，本轮不画 opacity .4。

断言：无。

后续：窄屏勾选框不再额外 left -42px。padding-left 42px 留在外壳上。绝对定位相对 padding edge，勾选框 left 保持 0，光晕 left 保持 -20px。

- apps/web/e2e/spec-align-citations.spec.ts:237 选中消息上来源胶囊背景 rgb(255, 255, 255) -> rgba(0, 0, 0, 0) SP-CV-112
