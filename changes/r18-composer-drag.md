SP-CMP-109。深色拖拽边框被 `body[data-ds-dark-theme] .composer` 压过，拖上 `.is-dragover` 后样式是虚线，颜色仍是 `rgba(255, 255, 255, 0.06)`。拖拽规则补上同样的深色选择器，颜色回到 `var(--dsw-alias-brand-primary)`（深色 #5686fe）。

SP-CMP-110。对话里的 composer 在深色下阴影被整页的 `box-shadow: none` 清掉。主页仍是 none。对话这条补回 `0 4px 10px rgba(0,0,0,.02), 0 2px 4px rgba(0,0,0,.04)`。

断言：
- spec-align-composer-2.spec.ts:72 none -> rgba(0, 0, 0, 0.02) 0px 4px 10px 0px, rgba(0, 0, 0, 0.04) 0px 2px 4px 0px SP-CMP-110
