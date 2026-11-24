# r23 review fixes

筑衡 03:10 CST。针对 staged b5a225c 的拦截项。四件事各一次提交。SP-MOD-572 的 Esc 冲突保持开放，不记成已解决。

## 1. 侧栏行标题缩进

70d4a0a 在 `.chat-row > button:not(.more)` 上加了 `margin: -2px 35px -2px -10px`。-10px 抵消了行的 10px 左内边距，标题从高亮左边起笔。`.side-scroll { margin: 0 -2px }`（SP-SB-301 样式表）再把行从内边距边 x=12、宽 236 撑到 x=10、宽 240。两处都是负 margin，去掉它们，不再加一段正偏移去补。

官方 `._546d736 .c08e6e93` 只有 line-height 18px，没有 margin（SP-SB-056）。官方 `._546d736` 高 40px、圆角 12px、padding 9px 6px 9px 10px。冻结捕获 answer-1440、home-with-history-1440、mobile-drawer-390、answer-dark-1920，以及 master a8df8b9 的 row.mjs（row-title-1440.txt / row-title-390.txt 第一对）都是行 x=12、宽 236、标题文字 x=22。

之前（b5a225c，row.mjs，1440 与 390 相同）：行 x=10、宽 240，标题文字 x=10，浅色激活底 rgb(228, 237, 253)。

之后（spec-align-sidebar-row，1440 与 390，浅色与深色）：行 x=12、宽 236、高 40、圆角 12px，标题文字 x=22。激活高亮就是这一行：浅色 rgb(228, 237, 253)，深色用 accent `--dsw-static-neutral-bluish-800` = rgb(53, 54, 56)（不是 master 深色的 bluish-750）。悬停非激活行：浅色 rgb(241, 243, 245)，深色 rgb(44, 44, 46)。⋯ 相对行：x = 行右 - 4 - 28，y = 行顶 + 6，28×28；图标 16×16，居中后再进 6px。来源是 master a8df8b9 `.chat-link.active .more` 的 top 6 / right 4 / 28×28 / svg 16。手机行高仍是官方 40px，不采用 master 的 44px min-height。
