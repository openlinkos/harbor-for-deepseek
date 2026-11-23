问候语测试用 `page.clock.install` 固定 +08:00 的时刻，再读 `getHours()`。CI 浏览器时区是 UTC，同一时刻会落到前一天晚上，问候语对不上。Playwright 的 `use.timezoneId` 设为 `Asia/Shanghai`，三个 e2e 配置都设了。`motion.spec` 自己 `browser.newContext()`，不继承 `use`，上下文里也写了同一个时区。

`chat.spec` 深色落地页在颜色过渡中读 `chipBorder`，会读到中间值。读之前用 `toHaveCSS` 等到最终的 `rgb(183, 200, 254)`。断言的期望值没有改。

- apps/web/playwright.config.ts use.timezoneId Asia/Shanghai
- apps/web/playwright.android.config.ts use.timezoneId Asia/Shanghai
- apps/web/playwright.server.config.ts use.timezoneId Asia/Shanghai
- apps/web/e2e/motion.spec.ts newContext timezoneId Asia/Shanghai
- apps/web/e2e/chat.spec.ts:641 读 chipBorder 之前不等待 -> toHaveCSS border-top-color rgb(183, 200, 254) 后再读
