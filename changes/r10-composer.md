# r10 作曲器

对话里的 `.composer-wrap` 外边距改为 `auto 32px 0`。包裹层背景是 30% 处截止的纵向渐变（SP-CMP-227、228）。`z-index: -1` 的 `.composer-back` 另画 24px 淡出（SP-CMP-233）。首页作曲器不在这条规则里。窄屏左右边距 16px，宽度改为 auto。小于 440px 时 padding 为 0，渐变隐藏（SP-GL-204）。

没有改已有断言的期望值。
