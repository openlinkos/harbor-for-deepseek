# r17 modals

`.ds-tooltip` 定义 `--dsl-tooltip-box-shadow`（SP-MOD-064）。该阴影只加在 `.ds-tooltip.ds-tooltip--show-shadow` 和深色 `.ds-tooltip` 上（SP-MOD-168）。浅色普通 tooltip 仍是 none。

删除对话确认按钮为实心错误色：背景和边框 #ec1313，白字，字重 500（SP-MOD-767、SP-MOD-768、SP-MOD-769、SP-MOD-770）。设置里数据页的「删除」仍是描边错误按钮。

断言：
- apps/web/e2e/settings-buttons.spec.ts:254 确认框危险按钮字重 400、透明底、主题危险描边 -> 字重 500、背景和边框 rgb(236, 19, 19)、文字 rgb(255, 255, 255) SP-MOD-767 SP-MOD-768 SP-MOD-769 SP-MOD-770
