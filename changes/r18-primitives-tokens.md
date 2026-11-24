SP-UI-150、SP-UI-151。网络失败重试图 `.hint-retry` 补上警告按钮的 `--dsl-button-color` / `--dsl-button-color-hover`，背景改走这两个变量。色值仍是 amber-500 / amber-400。SP-UI-153 的 ring 原来就是 warn-primary。

SP-UI-162、SP-UI-163。`.icon-btn` 补上 `--dsl-button-text-color-disabled: var(--dsw-alias-label-caption)`。深色解析成 #81858c，浅色 #adb2b8。

没有改断言。没有测试把这两个变量钉成别的值。
