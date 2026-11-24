空态问候按时间和语言切换。中文在 5 点到 12 点、且没有历史时是「早上好，今天想做点什么？」。英文宽屏是「Hi! What's on your mind today?」。英文窄屏是「Where would you like to begin?」。字符串里没有 DeepSeek。有历史的中文问候仍按视口。

测试用 `page.clock`。早上用 2026-11-23T08:00:00+08:00。仍断言「今天有什么可以帮到你？」的两处用 15:00+08:00，断言文字没改。

改过的断言：

- apps/web/e2e/brand.spec.ts:79 今天有什么可以帮到你？ -> 早上好，今天想做点什么？ SP-TB-318
- apps/web/e2e/brand.spec.ts:93 欢迎回来正则 -> Hi! What's on your mind today? SP-TB-319
- apps/web/e2e/motion.spec.ts:75 今天有什么可以帮到你？ -> 早上好，今天想做点什么？ SP-TB-318
- apps/web/e2e/parity.spec.ts:874 欢迎回来正则 -> Where would you like to begin? SP-TB-320
