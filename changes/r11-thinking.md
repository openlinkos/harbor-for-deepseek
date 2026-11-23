# r11 思考

`.timeline-search:hover` 铺上 `var(--dsw-alias-interactive-bg-hover)`（SP-TH-113）。静止态不铺，避免每条搜索行都带灰底。

进行中的思考点仍是品牌色，结束态保持三级灰（SP-TH-004）。fb1721 的结束态要求灰点。1.5s 脉冲仍不开，`timeline.spec.ts:204` 量的是稳定墨迹。

步骤句子保持次要色。品牌色只在进行中的圆点上（SP-TH-017）。整句涂成品牌蓝会让时间线正文变蓝。分隔线仍是 `.timeline-line` 的 1px，不在步骤上再加一条左边框（SP-TH-026）。

没有改已有断言。
