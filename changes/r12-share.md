分享条叠层改为 1001。全选复选框左边距 -26px。

没有改已有断言。SP-SHARE-015、SP-SHARE-084。

`.share-bar input.ds-checkbox { margin: 0 }` 比 `.share-all .ds-checkbox` 更具体，计算出的左边距仍是 0。选择器改为 `.share-bar .share-all input.ds-checkbox`，-26px 才会生效。
