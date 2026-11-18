# UI parity audit

Source of sizes and tokens: `hfd-ref/official-dump/home_files/main.dc093a796f.css` (logged-in chat.deepseek.com). Brand stays the Harbor mark, the “Harbor for DeepSeek” wordmark, and accent `#3964fe` (the same blue the official sheet names `--dsw-static-deepseek-500`). No whale, no DeepSeek wordmark font.

Official component dump HTML was not in the folder yet. States below that are not in the provided screenshots are marked **need capture**.

| Surface | Official | Ours before | Fix |
| --- | --- | --- | --- |
| Empty home | Mark + 「你好，有什么我能帮你的吗？」 | 「从这里开始？」 | Greeting string updated |
| Composer defaults | 深度思考 and 智能搜索 both on, blue outline pills, height 34px | Search off, extra effort chevron, filled chips | Both default on and persisted; chevron removed; 34px outline chips |
| Placeholder | 「给 DeepSeek 发送消息」 | 「发送消息」 | Official wording; brand stays in the wordmark |
| Composer focus | No inner blue rectangle | Browser outline possible | Textarea focus outline removed |
| Card radius | Large radius, soft shadow | 24px | Kept 24px to match prior official close-up |
| Attachment + send | Paperclip,  round send, pale when empty | Present | Unchanged geometry |
| Conversation footnote | 「内容由 AI 生成，请仔细甄别」 under the composer only | Missing | Added; legal footer unchanged |
| Thinking | One 「已思考（用时 N 秒）」 timeline: reasoning, 「搜索到 N 个网页」, 「浏览 N 个页面」 chips | Several thinking blocks and raw 「打开了页面」 lines | One timeline per turn |
| Citations | Small gray circles in the sentence | `〔n〕` appended, breaking lists into empty bullets | Inline `(n)` / `[n]` / `〔n〕` become circles; nothing appended |
| Answer actions | Copy, regenerate, like, dislike, read aloud, share, plus 「N 个网页」 | No read-aloud; usage line visible on hover | Read aloud added; usage moved into an info tooltip; pill kept |
| User bubble | Rounded, right aligned, gray in dark (`#2c2c2e`) | Token bubble, actions hidden on desktop | Actions shown; dark bubble already `#2c2c2e` |
| Stop | Square stop while streaming | Present | Unchanged |
| Scroll to bottom | Round chevron above the composer | Present on mobile | Unchanged |
| Title bar | Title left, share right | Share only on small screens | Share shown on desktop |
| Sidebar new chat | 「开启新对话」, plus in a circle, 40px pill | 「新对话」 | Label and icon updated |
| Groups | 今天 / 30 天内 / YYYY-MM | Also a 7-day group | 7-day group removed |
| Row hover menu | Rename, delete, pin | Rename, delete | Pin **need capture** of the menu |
| Search dialog | Command-style search | Filter field in the sidebar | **need capture** |
| Settings | Centered 「系统设置」, ~860px, radius 24px, left nav, theme tiles, pill rows, X | Tall stacked panel, native buttons | Rebuilt: 通用设置 / 账号管理 / 数据管理 / 服务协议 |
| User menu | Settings and account actions | Present | Unchanged structure |
| Light / dark | Page `#fff` / `#151517`, brand `#3964fe`, bubble `#edf3fe` / `#2c2c2e`, sidebar `#f9fafb` / `#1b1b1c` | Navy page and Tailwind blue | Tokens now follow `main.dc093a796f.css` (no brand font) |
| Mobile drawer | Same chrome, bottom sheets | Present | Unchanged shell; chips and copy follow desktop |
| Toasts / empty / skeletons | Official toast radius 12px | Basic toast | **need capture** of empty, error, and skeleton |
| Error and retry | Retry on the failed turn | Error text only | **need capture** |
| Regenerate versions | ‹ n/m › | Present when siblings exist | **need capture** |
| Code, tables, math | Code radius 12px, table 15px/25px | Present | **need capture** of a code block and a table |
| Loading | Skeleton heights from control tokens | None | **need capture** |

Official screenshots still needed: sidebar item menu (pin), chat search dialog, a failed send with retry, a code block, a table, an empty sidebar, and the light-theme user bubble.
