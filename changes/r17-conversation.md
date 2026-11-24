# r17 conversation

用户消息块 padding-bottom 改为 16px（SP-CV-279）。更早的用户消息操作行默认 opacity 0，悬停或聚焦后为 1；聊天页最后一条用户消息保持 opacity 1（SP-CV-306、SP-CV-312）。用户消息 ::before 高亮洗底在 .is-highlight 时 opacity 1（SP-CV-300），首条用户消息 ::before top 为 22px（SP-CV-285）。加载圆点颜色改为 --dsw-alias-label-dimmed（SP-CV-407、SP-CV-408）。编辑按钮的 tooltip 和 aria 改为「修改」（SP-CV-365）。

断言：
- apps/web/e2e/fb1344-parity.spec.ts:152 加载圆点 dark rgb(173, 178, 184) / light rgb(129, 133, 140) -> dark rgb(67, 69, 74) / light rgb(225, 229, 238) SP-CV-407 SP-CV-408
- apps/web/e2e/share-select.spec.ts:365 回答勾选框偏移 + 60 -> + 76 SP-CV-279
- apps/web/e2e/version-switcher.spec.ts:124 按钮名 编辑 -> 修改 SP-CV-365
- apps/web/e2e/parity.spec.ts:189 按钮名 编辑 -> 修改 SP-CV-365
- apps/web/e2e/answer-footer.spec.ts:17 USER_LABELS 编辑 -> 修改 SP-CV-365
- apps/web/e2e/overlay-paint.spec.ts:217 getByRole「复制」-> button[aria-label="复制"] 且 force hover SP-CV-306
- apps/web/e2e/overlay-paint.spec.ts:218 getByRole「编辑」/ tooltip「编辑」-> button[aria-label="修改"] / tooltip「修改」且 force hover SP-CV-306 SP-CV-365

手机宽度里 `.user-actions { opacity: 1 }` 会盖住上面的默认 opacity 0。已去掉这一条，让更早的用户消息在 390 也保持 opacity 0（SP-CV-306）。断言无新增改动。

后续：停止后的思考头图标不是加载圆点。
- apps/web/e2e/fb1344-parity.spec.ts:201 思考头 fill 加载圆点色 rgb(225, 229, 238) / rgb(67, 69, 74) -> 时间线三级色 rgb(129, 133, 140) / rgb(173, 178, 184) SP-TH-010 SP-TH-011
加载圆点仍在 :162，颜色是 label-dimmed（SP-CV-407、SP-CV-408）。
