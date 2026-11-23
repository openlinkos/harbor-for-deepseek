SP-GL-158、SP-UI-876。我们渲染的滚动容器是 `.transcript`、`.side-scroll`、`.settings-main`、`.search-panel ol`、`.search-results`。在这些节点上设置 `--dsl-scroll-area-gutters-disappear-delay: 1s`。

覆盖层滚动槽 `.ds-scroll-area__gutters` 不在树上。查了 `apps/web/src/styles.css` 和 `apps/web/src/ui.tsx`，滚动是原生 overflow，没有 gutter 节点。槽宽、thumb 的 opacity 没有套到这些容器上。

没有改断言。
