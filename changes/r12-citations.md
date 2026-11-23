# r12 引用

站点图标图片改为 `object-fit: contain`。来源摘要胶囊的间距改为 4px。重叠的小圆标仍是负边距，那是另一条规则。

已改断言：

- `apps/web/e2e/site-icon.spec.ts:151` 图标 `object-fit` 从 `cover` 改为 `contain`。SP-CITE-058。
