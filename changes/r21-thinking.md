思考时间线每一步的正文放进自己的 .ds-markdown，第一段成为 :first-child，margin-top 回到 0。圆点和第一行回到同一行。SP-MD-022。

apps/web/e2e/timeline.spec.ts:216 断言第一段 margin-top 为 0px。:217 断言圆点中心和第一行中心相差不超过 4px。:218 标题到第一行的墨迹间距从 33±3 改回 21±3。:220 第二步间距从 36±3 改回 24±3。容差未改。
