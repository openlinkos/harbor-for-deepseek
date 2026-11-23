分享条叠层改为 1001。全选复选框左边距 -26px。

没有改已有断言。SP-SHARE-015、SP-SHARE-084。

`.share-bar input.ds-checkbox { margin: 0 }` 比 `.share-all .ds-checkbox` 更具体，计算出的左边距仍是 0。选择器改为 `.share-bar .share-all input.ds-checkbox`，-26px 才会生效。

官方 `._692accd` 是整个全选控件，不是里面的 input。桌面 `margin-left: -26px` 写在 `.share-all` 上，内层补 `padding-left: 26px`，复选框仍和消息复选框同一列。宽度小于 768 时官方父级 `._117e7c4` 把左边距改成 16px，内层左内边距改为 20px（`calc(36px - 16px)`），全选框仍在 x=36。input 上的 -26px 已去掉。

没有改已有断言。SP-SHARE-015。
