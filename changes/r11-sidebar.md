# r11 侧栏

桌面 `.sidebar` 的 z-index 从 8 改为 1（SP-SB-486）。窄屏抽屉仍是关闭 15、打开 1002，压在遮罩 1001 上面。桌面侧栏在 flex 行里不和舞台重叠，1 和 8 的叠放看不见差别。

已改断言：

- `apps/web/e2e/spec-align-global-3.spec.ts:37` 桌面侧栏 z-index 从 `8` 改为 `1`。SP-SB-486。
