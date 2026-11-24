# r23 review fixes

筑衡 03:10 CST。针对 staged b5a225c 的拦截项。四件事各一次提交。SP-MOD-572 的 Esc 冲突保持开放，不记成已解决。

## 1. 侧栏行标题缩进

70d4a0a 在 `.chat-row > button:not(.more)` 上加了 `margin: -2px 35px -2px -10px`。-10px 抵消了行的 10px 左内边距，标题从高亮左边起笔。`.side-scroll { margin: 0 -2px }`（SP-SB-301 样式表）再把行从内边距边 x=12、宽 236 撑到 x=10、宽 240。两处都是负 margin，去掉它们，不再加一段正偏移去补。

官方 `._546d736 .c08e6e93` 只有 line-height 18px，没有 margin（SP-SB-056）。官方 `._546d736` 高 40px、圆角 12px、padding 9px 6px 9px 10px。冻结捕获 answer-1440、home-with-history-1440、mobile-drawer-390、answer-dark-1920，以及 master a8df8b9 的 row.mjs（row-title-1440.txt / row-title-390.txt 第一对）都是行 x=12、宽 236、标题文字 x=22。

之前（b5a225c，row.mjs，1440 与 390 相同）：行 x=10、宽 240，标题文字 x=10，浅色激活底 rgb(228, 237, 253)。

之后（spec-align-sidebar-row，1440 与 390，浅色与深色）：行 x=12、宽 236、高 40、圆角 12px，标题文字 x=22。激活高亮就是这一行：浅色 rgb(228, 237, 253)，深色用 accent `--dsw-static-neutral-bluish-800` = rgb(53, 54, 56)（不是 master 深色的 bluish-750）。悬停非激活行：浅色 rgb(241, 243, 245)，深色 rgb(44, 44, 46)。⋯ 相对行：x = 行右 - 4 - 28，y = 行顶 + 6，28×28；图标 16×16，居中后再进 6px。来源是 master a8df8b9 `.chat-link.active .more` 的 top 6 / right 4 / 28×28 / svg 16。手机行高仍是官方 40px，不采用 master 的 44px min-height。

## 2. Mermaid 全屏

b5a225c 的 svg 板是整屏高：浅色宽图 1440 为 [556, 0, 329, 900]，390 为 [31, 0, 329, 844]，图没有缩进视口，色带从顶铺到底。舞台 `.diagram-modal`（SP-MOD-597）和遮罩 `.bg-mask` rgba(0,0,0,.88) + blur(2px)（SP-MOD-265/266）保留。不写死 906×965。不套 SP-MOD-521 的 slide opacity 0。Esc 仍关弹层。

板是包住图的卡片：master a8df8b9 的 padding 28px 24px、圆角 8px，底色是官方 `svg.theme_light` / `theme_dark` 的 `--dsw-static-neutral-bluish-50` / `--dsw-static-neutral-bluish-850`（SP-MOD-074 / SP-MOD-178）。幻灯片内边距用 master 的 48px 56px，手机 40px 12px 16px。svg 上限是这块内边距再减去卡片 padding：桌面 calc(100vw - 160px) × calc(100dvh - 152px)，手机 calc(100vw - 72px) × calc(100dvh - 112px)。Mermaid 默认 useMaxWidth 写成 width="100%" 和内联 max-width，放进 fit-content 卡片会塌成 0。全屏副本改用 viewBox 的固有尺寸，再由这两条上限缩小。

之后（reviewer mermaidfs.mjs，label r23，预览 127.0.0.1:4520）：

- light-wide-1440 svg [556, 415, 329, 70]，内容 [564, 423, 313, 54]，板色 rgb(249, 250, 251)
- light-wide-390 svg [36, 400, 318, 68]，内容 [44, 408, 302, 52]
- light-tall-1440 svg [553, 107, 335, 687]，内容高 671，底边 794，小于 900
- light-tall-390 svg [36, 107, 318, 653]，宽从 335 收到 318
- 深色四组板色 rgb(44, 44, 46)，盒子与浅色相同

宽图 A→T（viewBox 2352×95）和长图（viewBox 89×2546）在 1440 与 390、浅色与深色：卡片高小于视口，四边落在幻灯片内边距里，svg 相对卡片缩进 24/28，并且小于自身 viewBox。Esc 关掉弹层。
