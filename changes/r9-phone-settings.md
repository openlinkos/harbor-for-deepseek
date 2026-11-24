窄屏设置改为贴底的官方底栏：左右贴边，高度 calc(100vh - 64px)，上圆角 24px，最高 800px。主题卡片恢复最小宽 128px、内边距 21px 32px。SP-SET-738、SP-SET-739、SP-MOD-563、SP-MOD-565、SP-MOD-612、SP-MOD-613、SP-MOD-614、SP-GL-193、SP-SET-789、SP-SET-790。昊辰 11/23 12:51。

apps/web/e2e/mobile-settings.spec.ts:41 旧 border-bottom-left-radius 24px 新 0px，SP-MOD-565，昊辰 11/23 12:51。
apps/web/e2e/mobile-settings.spec.ts:42 旧 border-bottom-right-radius 24px 新 0px，SP-MOD-565，昊辰 11/23 12:51。
apps/web/e2e/mobile-settings.spec.ts:48 旧 box.x > 8 新 box.x < 2，SP-SET-738，昊辰 11/23 12:51。
apps/web/e2e/mobile-settings.spec.ts:49 旧 box.y > 8 新 box.y > 60，SP-MOD-563，昊辰 11/23 12:51。
apps/web/e2e/mobile-settings.spec.ts:50 旧（与下一行同测留白）新 box.y < 68，SP-MOD-563，昊辰 11/23 12:51。
apps/web/e2e/mobile-settings.spec.ts:51 旧 x+width < 视口减 8 新 x+width > 视口减 2，SP-MOD-614，昊辰 11/23 12:51。
apps/web/e2e/mobile-settings.spec.ts:52 旧 y+height < 视口减 8 新 y+height > 视口减 2，SP-SET-738，昊辰 11/23 12:51。
apps/web/e2e/mobile-settings.spec.ts:92 旧 box.y > 8 新 box.y > 60，SP-SET-739，昊辰 11/23 12:51。
apps/web/e2e/mobile-settings.spec.ts:93 新 box.y < 68，SP-SET-739，昊辰 11/23 12:51。
apps/web/e2e/mobile-settings.spec.ts:94 旧 y+height < 836 新 y+height > 840，SP-SET-739，昊辰 11/23 12:51。
apps/web/e2e/mobile-settings.spec.ts:95 旧 border-bottom-left-radius 24px 新 0px，SP-MOD-565，昊辰 11/23 12:51。
apps/web/e2e/gaps.spec.ts:84 旧 border-bottom-left-radius 24px 新 0px，SP-MOD-565，昊辰 11/23 12:51。
apps/web/e2e/spec-align-settings-2.spec.ts:71 旧 min-width 0px 新 128px，SP-SET-789，昊辰 11/23 12:51。
apps/web/e2e/spec-align-settings-2.spec.ts:72 旧 padding-top 12px 新 21px，SP-SET-790，昊辰 11/23 12:51。
apps/web/e2e/spec-align-settings-2.spec.ts:73 旧 padding-left 4px 新 32px，SP-SET-790，昊辰 11/23 12:51。
apps/web/e2e/spec-align-settings-2.spec.ts:75 旧 border-bottom-left-radius 24px 新 0px，SP-MOD-565，昊辰 11/23 12:51。
