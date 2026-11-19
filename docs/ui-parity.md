# UI parity

Sizes and motion come from `official-dump/home_files/main.dc093a796f.css`. Brand stays the Harbor mark, the “Harbor for DeepSeek” wordmark, and accent `#3964fe` (`--dsw-static-deepseek-500`). No whale, no DeepSeek wordmark font.

Side-by-side frames for the logged-in stills are in `docs/parity/compare/`. Ours are `docs/parity/ours/<state>.png`. Behavior details follow `official-dump/behavior-spec.md`: sidebar 261px and a 0.3s collapse, Ctrl+J on 开启新对话, inline user edit, `n / m` beside the six actions, a 反馈 dialog, 朗读 busy state, code header 复制, mermaid 下载 SVG/PNG, and 已选择 N 个对话. Mobile, offline, and the stop aftermath use the same tokens where the spec says the live site was not observed.

| State | Official | Harbor |
| --- | --- | --- |
| Home, dark, both tools on | Centered mark and greeting, grey composer, outlined chips, round send | Same layout. Empty history says 「今天有什么可以帮到你？」. A new chat with history picks 「欢迎回来，随时开始吧」 or 「欢迎回来，想从哪里开始？」 |
| Home, light | White page, pale composer, blue selected chips | Same tokens: bubble `#edf3fe`, page white, sidebar `#f9fafb` |
| Composer focus | No inner blue rectangle | Textarea outline removed |
| Settings general | Centered ~860px, radius 24px, left nav, three theme tiles, language and voice pills | Same shell. Language is 简体中文 / English. Voice is 默认 plus the Web Speech voices |
| Settings account / data / agreement | Left nav switches the pane | 账号管理, 数据管理, 服务协议. Legal footer lives here and on the key gate, not in the sidebar |
| User menu | 下载手机应用, 系统设置, 帮助与反馈, 退出登录 | 下载应用 (GitHub releases), 系统设置, 帮助与反馈 (GitHub issues). Local mode uses 从本机移除 Key instead of 退出登录. Server mode keeps 退出登录 |
| Search | Centered pill 「搜索对话内容...」 | Same pill, opened from the sidebar search icon or Ctrl/Cmd+K |
| Sidebar item menu | 重命名, 置顶, 分享, 多选, 删除 | Same five. Share downloads Markdown. Multi-select deletes the checked rows |
| Streaming | Square stop in the send slot | Stop button while the request is in flight |
| Thinking | One timeline, chevron, 0.2s grid collapse | Same. Search and browse steps sit inside it |
| User bubble | Grey in dark (`#2c2c2e`), radius 22px. Copy and edit on hover | Same. Touch layout keeps the icons visible |
| Table, math, code | Table 15px/25px, KaTeX, code radius 12px, 13px/22px, copy and download | Same. Box-drawing stays in a pre with letter-spacing normal/0 |
| Mermaid | 图表 / 代码, zoom, 下载, 全屏 | Lazy-loaded card with those controls |
| Action row | Six 28×28 icons on a 38px pitch. Tooltips after a short delay | 复制, 重新生成, 喜欢, 不喜欢, 朗读, 分享. Pitch is 38px. Likes stay in `localStorage`. Read-aloud uses the chosen voice. Share downloads Markdown |
| Sources | 「N 个网页」 pill opens the results panel | Same pill and panel |
| Motion | 0.1s / 0.2s / 0.3s, dialog scale 0.8, sidebar flex-basis 0.2s | Matched. `prefers-reduced-motion` collapses durations to 0.01ms |
| Scroll | Follows the stream until you move up, then a round jump button | Same |

Native `<select>` menus are the platform dropdown. The closed control is the pill from the stylesheet.
