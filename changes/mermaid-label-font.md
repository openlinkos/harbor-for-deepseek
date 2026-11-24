流程图节点和连线标签按主题字号测量，不再裁掉最后一个汉字。

正文是 14px（styles.css:39，令牌 --ds-font-size-m 在 theme.css:60）。修复前 mermaid.render 不传容器，临时树挂在 body 上；主题 CSS 写在 style 元素里，被 CSP 的 style-src 'self'（csp.ts:5）挡住，测量就继承正文 14px。随后 applyThemeStyles（mermaid-render.ts:21）把主题 16px 写进行内样式，绘制比 foreignObject 宽，末字被裁。现由测量宿主（mermaid-render.ts:79）带上主题的 fontSize 和 fontFamily，并传给 mermaid.render（mermaid-render.ts:111），测量和绘制同一套字。
