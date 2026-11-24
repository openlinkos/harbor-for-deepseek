选中的分享复选框写入官方颜色变量。

`--dsl-checkbox-color` 设为 `var(--dsw-alias-button-primary-fill)`。画出的背景仍是 `#5686fe`，share-select.spec.ts:459 读的是背景。

没有改已有断言。SP-SHARE-037、SP-SHARE-038。
