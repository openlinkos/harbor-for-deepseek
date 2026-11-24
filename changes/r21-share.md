分享勾选列放进消息行自己的内边距：桌面 left -42px，窄列表 left 0（SP-SHARE-034）。勾选框 pointer-events 为 auto，点它本身能切换；直接子元素仍是 none（SP-SHARE-149）。吸顶不再吃滚动容器的 12px padding。洗底仍按截图锁的 3px / 32–35px 贴着正文。SP-SHARE-033、102–105、035、109、111。

apps/web/e2e/share-select.spec.ts:879 断言 1440 和 390 下，问题和回答的复选框中心命中 input.share-box、落在 article 边框内，并且勾选状态翻转。SP-SHARE-033/102-105/149。

apps/web/e2e/share-select.spec.ts:904 断言长回答滚到中间后，吸顶勾选框顶边距标题顶约 50px（容差 4，56px 不会过）。SP-SHARE-035/109/111。原有截图几何断言未改。
