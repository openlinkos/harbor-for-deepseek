# r12 设置开关

深色主题下，打开的设置开关底色改为 `#5686fe`。浅色仍是 `#3964fe`。

已改断言：

- `apps/web/e2e/chat.spec.ts:754` 深色打开开关的 `background-color` 从 `rgb(57, 100, 254)` 改为 `rgb(86, 134, 254)`。SP-SET-390、SP-SET-418、SP-SET-444。
- `apps/web/e2e/spec-align-settings-3.spec.ts:120` 深色打开开关的 `background-color` 从 `rgb(57, 100, 254)` 改为 `rgb(86, 134, 254)`。浅色第 106 行仍是 `rgb(57, 100, 254)`。SP-SET-390、SP-SET-418、SP-SET-444。
