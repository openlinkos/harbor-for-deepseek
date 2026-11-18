# Harbor behavior matrix

Motion tokens are taken from `main.dc093a796f.css`: `--ds-transition-duration` 0.2s, fast 0.1s, slow 0.3s, ease-in `cubic-bezier(.4,0,1,1)`, ease-out `cubic-bezier(0,0,.2,1)`, ease-in-out `cubic-bezier(.4,0,.2,1)`. Dialogs use the official fade/zoom (scale 0.8, 0.1s). Thinking uses a 0.2s grid-row collapse. The sidebar width uses a 0.2s flex-basis ease-in-out. Tooltips wait one fast duration (0.1s) before fading in. `prefers-reduced-motion` collapses those durations.

The composer addresses Harbor, not DeepSeek. That is the product name. Everything else in this table is expected to match the official chat.

`official-dump/dyn/` and `behavior-spec.md` were not present when this matrix was written. Fold those in when they land.

| Row | Scenario | Expected | Test |
| --- | --- | --- | --- |
| 1 | New chat | Outlined 「开启新对话」 clears the transcript | `new chat` |
| 2 | Send | Enter submits; the user bubble is on the right | `send` |
| 3 | Stream | Stop control is visible while the request is in flight, then the answer lands | `stream and stop` |
| 4 | Stop | Stop aborts and shows the stopped hint | `stream and stop` |
| 5 | Regenerate | ‹ 1/2 › appears and switches the visible answer | `versions` |
| 6 | Edit | Edit puts the user text back in the composer | `edit and copy` |
| 7 | Copy | The copy control flips to a check, then back | `edit and copy` |
| 8 | Like / dislike | `aria-pressed` follows the click | `reactions` |
| 9 | Read aloud | A 朗读 control is in the action row | `reactions` |
| 10 | Share | A 分享 control is in the action row | `reactions` |
| 11 | Thinking toggle | Defaults on; click turns it off | `tools default on` |
| 12 | Search toggle | Defaults on and reads 智能搜索 | `tools default on` |
| 13 | Citations | A gray cite marker is inside the sentence | `search citations` |
| 14 | Headings | h2 text is present | `markdown surfaces` |
| 15 | Lists | A ul item is present | `markdown surfaces` |
| 16 | Nested lists | A nested li is present | `markdown surfaces` |
| 17 | Tables | A real table has the header cells | `markdown surfaces` |
| 18 | Code | A code card shows the language | `markdown surfaces` |
| 19 | Box drawing | Box characters stay in one pre with letter-spacing 0 | `markdown surfaces` |
| 20 | Math | KaTeX renders the formula | `markdown surfaces` |
| 21 | Mermaid | Lazy card with 图表/代码, zoom, 下载, 全屏 | `mermaid card` |
| 22 | Images | An img is rendered for a data URI | `markdown surfaces` |
| 23 | Links | External links open in a new tab | `markdown surfaces` |
| 24 | Blockquote | A blockquote is rendered | `markdown surfaces` |
| 25 | Scroll | A long answer shows 回到底部 after scrolling up; sending from the bottom follows | `scroll` |
| 26 | Bad response | A non-stream body shows an error and 重试 | `errors` |
| 27 | Network | A failed request shows an error | `errors` |
| 28 | 429 | A 429 shows an error | `errors` |
| 29 | Attachment | A chosen file appears above the composer | `attachment` |
| 30 | Rename | The row menu renames the chat | `sidebar` |
| 31 | Pin | Pin moves the chat under 置顶 | `sidebar` |
| 32 | Delete | Delete removes the row after confirm | `sidebar` |
| 33 | Multi-select | The 今天 list icon selects and deletes | `sidebar` |
| 34 | Search | Ctrl/Cmd+K opens the filter | `keyboard and search` |
| 35 | Date groups | Aged chats land in 昨天, 7 天内, 30 天内, or YYYY-MM | `date groups` |
| 36 | Settings tabs | 通用设置, 账号管理, 数据管理, 服务协议 | `settings` |
| 37 | Theme | 浅色 / 深色 / 跟随系统 set the document theme | `settings` |
| 38 | Language | English switches the placeholder | `settings` |
| 39 | Key gate | The gate keeps the trademark footer | `key gate` |
| 40 | Local mode | Sidebar shows 本地模式 and not the legal footer | `local mode` |
| 41 | Mobile drawer | 390px opens the drawer from the menu | `mobile drawer` |
| 42 | Shortcuts | Ctrl/Cmd+N starts a new chat; Escape closes settings | `keyboard and search` |
| 43 | Thinking motion | Collapse keeps the body mounted and animates grid rows over 0.2s | `thinking motion` |
| 44 | Dialog motion | Settings opens with the pop animation and closes | `dialog motion` |
| 45 | Sidebar motion | Collapse animates flex-basis over 0.2s | `sidebar motion` |
| 46 | Action row | Six icons and no token line under the answer | `action row` |
| 47 | Disclaimer | Conversations show 「内容由 AI 生成，请仔细甄别」 | `disclaimer` |
| 48 | Reduced motion | The stylesheet short-circuits animation when requested | `reduced motion` |
