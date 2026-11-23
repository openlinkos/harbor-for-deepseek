# r10 侧栏

桌面侧栏过渡加上 `box-shadow .3s`，透明度改为 `.2s`（SP-SB-426、533、540、541 合在 `.sidebar` 上，因为没有单独的官方类名节点）。会话链接改为 `/a/chat/s/:id`；普通点击仍 `preventDefault`，带修饰键的点击交给浏览器（SP-SB-636）。头像字母保留。官方头像图片 `.fdf01f38` 是 `display: none`，对应 `.profile-photo`（SP-SB-807）。

`search-switch.spec.ts` 从 href 取最后一段作为会话 id。断言仍是路径 `/a/chat/s/${id}`，期望值没有改。
