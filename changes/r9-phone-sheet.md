窄屏设置底栏用 fixed 贴在视口底边，左右为 0，高度仍是 calc(100vh - 64px)。测量前等弹出动画结束。SP-SET-738、SP-SET-739、SP-MOD-563。昊辰 11/23 12:51。

apps/web/e2e/mobile-settings.spec.ts:45 新增等待 transform 为 none，再量位置。旧测量落在弹出缩放中途，左边距读到约 37px。SP-SET-738，昊辰 11/23 12:51。
apps/web/e2e/mobile-settings.spec.ts:92 同样等动画结束再量窄屏位置。SP-SET-739，昊辰 11/23 12:51。
