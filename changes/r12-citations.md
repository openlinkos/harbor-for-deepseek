# r12 引用

站点图标图片改为 `object-fit: contain`。来源摘要胶囊的间距改为 4px。重叠的小圆标仍是负边距，那是另一条规则。

已改断言：

- `apps/web/e2e/site-icon.spec.ts:151` 图标 `object-fit` 从 `cover` 改为 `contain`。SP-CITE-058。
- `apps/web/e2e/spec-align-citations.spec.ts:101` 来源胶囊 `gap` 从 `6px` 改为 `4px`。SP-CITE-045。
- `apps/web/e2e/spec-align-citations.spec.ts:117` 胶囊里的站点图标 `object-fit` 从 `cover` 改为 `contain`。SP-CITE-058。悬停卡片图标第 144 行仍是 `cover`。
