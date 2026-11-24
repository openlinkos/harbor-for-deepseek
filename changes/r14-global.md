外壳补上官方安全区内边距。

`.shell` 在支持 `env()` 时使用 `padding-top/left/right: env(safe-area-inset-*)`。桌面 Chromium 计算出 0px，所以 motion.spec.ts 的 inset 数字不变。

补回 `.sidebar` 规则的选择器。它和安全区内边距写在同一处，第一次提交时选择器被吃掉了。

没有改已有断言。SP-GL-091、SP-GL-092、SP-GL-093。
