# Official style captures

Run the bookmarklet at `tools/style-audit/bookmarklet.js` on https://chat.deepseek.com, or paste `tools/style-audit/console.js` into the DevTools console. It prompts for a state label. Enter `official/<state>`. It downloads `style-official-<state>-<width>x<height>.json` and copies the same JSON to the clipboard.

Put those files in `/cursor/stores/bot/hfd-ref/style-official/`. `pnpm style:audit` compares them with the Harbor captures in `docs/parity/style/ours/`. A state passes only with zero unexplained mismatches. Allowed differences live in `tools/style-audit/allowlist.yaml`.

Viewports: 1440×900, 1920×1072, and 390×844. Use a phone user agent and touch for 390×844. Desktop captures are a normal Chrome window at that size.

Harbor-only states (landing, key-gate) are not captured on the official site.

## landing

Matrix rows: Harbor-only

No official file. This screen does not exist on chat.deepseek.com.

## key-gate

Matrix rows: 39

No official file. This screen does not exist on chat.deepseek.com.

## home-no-history

Matrix rows: 11, 12, 40, 42, 49, 50

1. Sign in to chat.deepseek.com with an account that has no conversations.
2. Land on the empty home. Do not type. Leave both toggles as the site shows them.
3. The greeting is the empty-account line. The new-chat control shows ⌘ J on macOS and Ctrl J elsewhere.

Files:

- `style-official-home-no-history-1440x900.json` (ours: not captured)
- `style-official-home-no-history-1920x1072.json` (ours: not captured)
- `style-official-home-no-history-390x844.json` (ours: not captured)

## home-with-history

Matrix rows: 1, 49

1. Use an account that already has at least one chat.
2. Click 开启新对话.
3. Wait until the returning greeting is visible and the composer is empty.

Files:

- `style-official-home-with-history-1440x900.json` (ours: 60 elements, FAIL)
- `style-official-home-with-history-1920x1072.json` (ours: 60 elements, FAIL)
- `style-official-home-with-history-390x844.json` (ours: 31 elements, FAIL)

## composer-focus

Matrix rows: 2

1. On the home screen, click the composer so the caret is inside it. Do not send.

Files:

- `style-official-composer-focus-1440x900.json` (ours: not captured)
- `style-official-composer-focus-1920x1072.json` (ours: not captured)
- `style-official-composer-focus-390x844.json` (ours: not captured)

## user-menu

Matrix rows: 40

1. Open the sidebar (on a phone, tap the menu first).
2. Click the account control at the bottom of the sidebar.
3. Leave that menu open. This is the account footer that maps to Harbor’s 本地模式 footer.

Files:

- `style-official-user-menu-1440x900.json` (ours: 60 elements, FAIL)
- `style-official-user-menu-1920x1072.json` (ours: 60 elements, FAIL)
- `style-official-user-menu-390x844.json` (ours: 65 elements, FAIL)

## settings-general

Matrix rows: 36, 37, 44

1. Open the account menu, click 系统设置, and stay on 通用设置. Leave the dialog open.

Files:

- `style-official-settings-general-1440x900.json` (ours: 104 elements, FAIL)
- `style-official-settings-general-1920x1072.json` (ours: 104 elements, FAIL)
- `style-official-settings-general-390x844.json` (ours: 109 elements, FAIL)

## settings-account

Matrix rows: 36

1. Open 系统设置, then click 账号管理. Leave the dialog open.

Files:

- `style-official-settings-account-1440x900.json` (ours: 76 elements, FAIL)
- `style-official-settings-account-1920x1072.json` (ours: 76 elements, FAIL)
- `style-official-settings-account-390x844.json` (ours: 81 elements, FAIL)

## settings-data

Matrix rows: 36, 59

1. Open 系统设置, click 数据管理, and expand the extra data section if it is collapsed.

Files:

- `style-official-settings-data-1440x900.json` (ours: 129 elements, FAIL)
- `style-official-settings-data-1920x1072.json` (ours: 129 elements, FAIL)
- `style-official-settings-data-390x844.json` (ours: 134 elements, FAIL)

## settings-terms

Matrix rows: 36

1. Open 系统设置, then click 服务协议. Leave the dialog open.

Files:

- `style-official-settings-terms-1440x900.json` (ours: 87 elements, FAIL)
- `style-official-settings-terms-1920x1072.json` (ours: 87 elements, FAIL)
- `style-official-settings-terms-390x844.json` (ours: 92 elements, FAIL)

## settings-english

Matrix rows: 38

1. Open 系统设置 → 通用设置. Open the language menu and choose English. Leave settings open.

Files:

- `style-official-settings-english-1440x900.json` (ours: not captured)
- `style-official-settings-english-1920x1072.json` (ours: not captured)

## search-dialog

Matrix rows: 34, 60

1. On the home screen, press Ctrl+K (⌘K on macOS). Leave the search dialog open. Do not type a query.

Files:

- `style-official-search-dialog-1440x900.json` (ours: 57 elements, FAIL)
- `style-official-search-dialog-1920x1072.json` (ours: 57 elements, FAIL)
- `style-official-search-dialog-390x844.json` (ours: 36 elements)

## sidebar-item-menu

Matrix rows: 30, 31, 32, 66

1. Have one chat in the sidebar. Hover that row and click its … menu. Leave the menu open. Do not rename or delete.

Files:

- `style-official-sidebar-item-menu-1440x900.json` (ours: 112 elements, FAIL)
- `style-official-sidebar-item-menu-1920x1072.json` (ours: 112 elements, FAIL)

## sidebar-collapsed

Matrix rows: 45, 51

1. On a desktop width, click the hide-sidebar control. Capture while the sidebar is collapsed.

Files:

- `style-official-sidebar-collapsed-1440x900.json` (ours: 57 elements, FAIL)
- `style-official-sidebar-collapsed-1920x1072.json` (ours: 57 elements, FAIL)

## answer

Matrix rows: 5, 7, 8, 10, 13, 46, 47

1. Send any short message and wait until the answer, the action row, and the AI disclaimer are visible. Do not scroll.

Files:

- `style-official-answer-1440x900.json` (ours: 101 elements, FAIL)
- `style-official-answer-1920x1072.json` (ours: 101 elements, FAIL)
- `style-official-answer-390x844.json` (ours: 71 elements, FAIL)

## answer-markdown

Matrix rows: 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 56, 57

1. Send a message whose answer contains a heading, nested list, blockquote, link, image, table, box drawing, a short code block, math, and a mermaid diagram.
2. Wait until the formula and the mermaid chart are rendered. Leave the 图表 tab selected.

Files:

- `style-official-answer-markdown-1440x900.json` (ours: not captured)
- `style-official-answer-markdown-1920x1072.json` (ours: not captured)
- `style-official-answer-markdown-390x844.json` (ours: not captured)

## streaming

Matrix rows: 3, 4, 61, 67

1. Send a message and capture while the stop control is still visible, before the answer finishes.

Files:

- `style-official-streaming-1440x900.json` (ours: not captured)
- `style-official-streaming-1920x1072.json` (ours: not captured)
- `style-official-streaming-390x844.json` (ours: not captured)

## thinking-collapsed

Matrix rows: 43

1. Open an answer that has a thinking block. Click the thinking header so the body is collapsed.

Files:

- `style-official-thinking-collapsed-1440x900.json` (ours: 101 elements, FAIL)
- `style-official-thinking-collapsed-1920x1072.json` (ours: 101 elements, FAIL)
- `style-official-thinking-collapsed-390x844.json` (ours: 71 elements, FAIL)

## feedback

Matrix rows: 54

1. On a finished answer, click 不喜欢. Leave the 反馈 dialog open.

Files:

- `style-official-feedback-1440x900.json` (ours: not captured)
- `style-official-feedback-1920x1072.json` (ours: not captured)

## edit

Matrix rows: 6, 52

1. On a finished turn, click 编辑 on the user message. Leave 取消 and 发送 visible. Do not send the edit.

Files:

- `style-official-edit-1440x900.json` (ours: not captured)
- `style-official-edit-1920x1072.json` (ours: not captured)

## versions

Matrix rows: 5, 53

1. On a finished answer, click regenerate and wait until the version control reads 2 / 2.

Files:

- `style-official-versions-1440x900.json` (ours: not captured)
- `style-official-versions-1920x1072.json` (ours: not captured)

## attachment

Matrix rows: 29

1. On the home composer, attach a small text file. Capture while the file chip is visible and before sending.

Files:

- `style-official-attachment-1440x900.json` (ours: not captured)
- `style-official-attachment-1920x1072.json` (ours: not captured)

## theme-dark

Matrix rows: 37

1. Open 系统设置, choose 深色, close settings, and capture the empty home in dark mode.

Files:

- `style-official-theme-dark-1440x900.json` (ours: not captured)
- `style-official-theme-dark-1920x1072.json` (ours: not captured)

## scroll-up

Matrix rows: 25

1. Open a long answer, scroll up until 回到底部 is visible, and capture before clicking it.

Files:

- `style-official-scroll-up-1440x900.json` (ours: 126 elements, FAIL)
- `style-official-scroll-up-1920x1072.json` (ours: 126 elements, FAIL)
- `style-official-scroll-up-390x844.json` (ours: 96 elements, FAIL)

## long-code

Matrix rows: 65

1. Open an answer whose code block is longer than 18 lines and still collapsed behind 展开.

Files:

- `style-official-long-code-1440x900.json` (ours: not captured)
- `style-official-long-code-1920x1072.json` (ours: not captured)

## error

Matrix rows: 26, 27, 28

1. Cause a failed send (HTTP error, offline, or HTTP 429) so the error text and 重试 are visible.

Files:

- `style-official-error-1440x900.json` (ours: not captured)
- `style-official-error-1920x1072.json` (ours: not captured)

## multi-select

Matrix rows: 33, 58

1. With at least one chat under 今天, click the list icon on that group, then check one row so the header reads 已选择 1 个对话.

Files:

- `style-official-multi-select-1440x900.json` (ours: not captured)
- `style-official-multi-select-1920x1072.json` (ours: not captured)

## read-aloud

Matrix rows: 9, 55

1. On a finished answer, click 朗读 and capture while it is speaking (aria-busy).

Files:

- `style-official-read-aloud-1440x900.json` (ours: not captured)
- `style-official-read-aloud-1920x1072.json` (ours: not captured)

## offline

Matrix rows: 64

1. With the app open, go offline (DevTools → Network → Offline) so the offline banner is visible.

Files:

- `style-official-offline-1440x900.json` (ours: not captured)
- `style-official-offline-1920x1072.json` (ours: not captured)

## reduced-motion

Matrix rows: 48

1. Turn on prefers-reduced-motion, then capture the empty home.

Files:

- `style-official-reduced-motion-1440x900.json` (ours: not captured)
- `style-official-reduced-motion-1920x1072.json` (ours: not captured)

## mobile-drawer

Matrix rows: 41, 63

1. At 390×844 with a phone user agent, tap the menu button. Leave the drawer open over the scrim.

Files:

- `style-official-mobile-drawer-390x844.json` (ours: 57 elements, FAIL)

## mobile-item-sheet

Matrix rows: 63, 66

1. At 390×844, open the drawer, tap … on a chat, and leave the bottom sheet open.

Files:

- `style-official-mobile-item-sheet-390x844.json` (ours: 118 elements, FAIL)

## sidebar-date-groups

Matrix rows: 35, 62

1. Use an account whose sidebar already shows more than one date group: 置顶, 今天, 昨天, 30 天内, and a YYYY-MM group.
2. Do not open a chat. Capture the sidebar as it stands.
3. Harbor’s automated capture cannot age conversations, so there is no ours file for this state yet.

Files:

- `style-official-sidebar-date-groups-1440x900.json` (ours: 60 elements, FAIL)
- `style-official-sidebar-date-groups-1920x1072.json` (ours: 60 elements, FAIL)
