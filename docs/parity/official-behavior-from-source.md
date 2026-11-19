# Official behavior taken from the public static files

Read on 2026-11-19. No login and no call to `api.deepseek.com`.

## Files

| File | URL | Bytes | Notes |
| --- | --- | --- | --- |
| Chat shell | `https://chat.deepseek.com/manifest.json` | 8621 | Returns the logged-out chat HTML. `https://chat.deepseek.com/` itself answers `202` with `x-amzn-waf-action: challenge`. |
| CSS | `https://fe-static.deepseek.com/chat/static/main.dc093a796f.css` | 303171 | Byte-identical to `official-dump/home_files/main.dc093a796f.css`. Not newer. |
| App JS | `https://fe-static.deepseek.com/chat/static/main.5a15ff2247.js` | 1663914 | Referenced by the shell. |
| Vendors | `https://fe-static.deepseek.com/chat/static/default-vendors.a63ee0213e.js` | 1036881 | Referenced by the shell. Scroll and greeting logic are in `main.js`, not the vendors file. |

The shell also preloads `https://fe-static.deepseek.com/chat/static/web-logo.svg`.

## @media breakpoints in `main.dc093a796f.css`

Counted by exact prelude:

| Prelude | Count |
| --- | ---: |
| `@media not all and (min-width:768px)` | 16 |
| `@media print` | 14 |
| `@media not all and (min-width:440px)` | 13 |
| `@media (min-width:768px)` | 9 |
| `@media not all and (min-width:1024px)` | 3 |
| `@media (prefers-reduced-motion:reduce)` | 2 |
| `@media (hover:hover)` | 2 |
| `@media (max-width:767px)` | 1 |
| `@media (min-width:1024px)` | 1 |
| `@media (min-width:768px) and (max-color:2147477350)` | 1 |
| `@media (min-width:768px) and (color:2147477350)` | 1 |
| `@media screen and (max-width:768px)` | 1 |
| `@media (max-width:768px)` | 1 |
| `@media (max-width:440px)` | 1 |
| `@media (prefers-color-scheme:dark)` | 1 |

`not all and (min-width: Npx)` is the stylesheet’s way of writing “narrower than N”.

## Layout values applied

- `--sider-width: 261px`. Below 768px the sider (`.dc04ec1d`) is `position: fixed; top: 0; bottom: 0`, open with `transform: translate(0)`, closed with `transform: translateX(calc(-1 * var(--sider-width)))`. The inner column (`.a2f3d50e`) is `width/max-width: var(--sider-width)`. At `min-width: 768px` it becomes `position: relative` and the closed state is `max-width: 0; transform: none`.
- Transition: `transform` and `max-width` use `var(--ds-transition-duration-slow)` and `var(--ds-ease-in-out)`. Those tokens are `.3s` and `cubic-bezier(.4, 0, .2, 1)`. A companion fades `opacity` over the same slow token. One inner piece uses `transform .2s steps(1, end)`.
- Scrim (`. _4cbcd96`): `background-color: rgba(0, 0, 0, .4)`, `z-index: 1001`. The sider is `z-index: 1002` while the drawer is the mobile fixed layer. At `min-width: 768px` the scrim is `opacity: 0; pointer-events: none`.
- A phone measurement of about 72% of a 465px-wide screenshot is not what this CSS sets. The source width is 261px, so the drawer stays 261px.
- Message column: `:root { --message-list-padding-horizontal: 44px; --message-list-max-width: 840px }`. Under 1024px both become `36px` and `712px`. There is no further override at 768px or 440px.
- Composer bar (`. _871cbca`): `margin: auto 32px 0` and `padding: 0 calc((100% - var(--message-list-max-width)) / 2)`. Under 768px the side margins become `16px`. Under 440px the padding becomes `0`. On a 390px phone the composer inset is that 16px margin, not the 36px message-list padding. Harbor uses 16px for the composer and the empty home column, and keeps the 36px margin on the message transcript.
- Under 440px the user bubble (`.fbb737a4`) is `max-width: calc(100% - 68px)`.
- Under 440px the home title (`. _5758a85 ._6c7e7df`) is `font-size: 20px; font-weight: 500; line-height: 28px`, and the logo (`.ce41ed1b`) is `transform: scale(.88)`.
- Under 768px one sheet (the rule on `._519be07`) is `width: 100vw; border-radius: 24px 24px 0 0; top: 20px; bottom: 0; transform: translateY(36px)`, and the open state is `transform: translateY(0)`.
- `100dvh` appears once, on `._34e1f8b .ea61040d`. Other heights in the file use `100vh`, `72vh`, and `40vh`. Safe area is `env(safe-area-inset-top|right|bottom|left)`, including `bottom: max(8px, env(safe-area-inset-bottom))` and `@supports` padding on the app frame.

## Scrollbars

The message list does not use a thin always-on bar.

- `.ds-scroll-area.ds-scroll-area--enabled` and `.ds-virtual-list:not(.ds-virtual-list--show-scrollbar)` set `scrollbar-width: none`. The webkit scrollbar, track, and thumb are `display: none` / `width: 0; height: 0`.
- `.ds-textarea.ds-textarea--hide-scrollbar textarea` and `.b40079d7` do the same (`scrollbar-width: none`, plus `-ms-overflow-style: none` and `overscroll-behavior: none` on `.b40079d7`).
- A separate `.scrollable` rule is `scrollbar-gutter: stable; scrollbar-color: var(--scroll-color) transparent; transition: scrollbar-color .1s ease-out`, and `:hover` uses `--scroll-color-hover`.
- `body { --scroll-color: rgba(0, 0, 0, .08); --scroll-color-hover: rgba(0, 0, 0, .15) }`. Dark theme: `rgba(255, 255, 255, .15)` and `rgba(255, 255, 255, .24)`.
- `--dsl-scroll-area-gutters-disappear-delay: 1s`.

Harbor’s transcript, sidebar list, settings body, source sheet, and composer textarea use `scrollbar-width: none` and a hidden webkit scrollbar.

## Composer pills

There is no `@media` rule that forces 40px circles. `ds-toggle-button--m` is `--dsl-toggle-button-height: 34px; --dsl-toggle-button-padding: 0 12px; --dsl-toggle-button-icon-size: 14px`, with `border-radius: 18px`, `font-size: 13px`, `font-weight: 500`, and `transition: border, background .2s ease`.

The app JS (`yS` in `main.5a15ff2247.js`) measures the tool row on layout and on resize:

1. Show every label.
2. If `scrollWidth > clientWidth`, or any label’s height is greater than `1.5 * lineHeight`, hide every label.
3. Otherwise show the labels.

The icon passed into the toggle is `size: 14`. The hide class `_51c583b` is only `display: none`. The only `classList.toggle` of that class is this measurement. `isMobile` (the UA flag exported as `Q.yA.isMobile`) is used for focus, Enter-to-newline, tooltips, and the mobile “download app” button. It does not hide these labels. There is no `pointer: coarse` check, width breakpoint, or feature flag on the toggles.

The extra class `f79352dc` sets `padding: 10px` on `.ds-toggle-button`. With the 14px icon and the 34px height, a hidden label makes the border box 34×34. Radius 18px then reads as a circle.

A logged-in Android Chrome window at about 393 CSS pixels still shows those two controls as icon-only circles even when the row has room. Harbor treats that as observed behavior: below 768px, when the pointer is coarse, the device reports touch points, or the UA is mobile, the labels stay hidden and each control is 34×34 with an 18px radius and a 14px icon. Wider layouts still use the overflow measurement above.

## Scroll follow

From `main.5a15ff2247.js`. Auto-scroll calls `scrollTo({ left: 0, top, behavior: "instant" })`. It does not use `smooth` for follow.

- Re-enable follow on user scroll only when `scrollTop + offsetHeight >= scrollHeight - 1`.
- The scroll-to-bottom button is hidden when `scrollTop + offsetHeight > scrollHeight - 52`, and shown otherwise.
- While following a WIP assistant message that already has body text, read `.ds-assistant-message-main-content`’s top relative to the list. If that offset is `>= -1` and `scrollTop + offset < (scrollHeight - clientHeight) - 1`, scroll to `max(scrollTop + offset, scrollTop)` and then set follow off. Otherwise keep `top` at `scrollHeight - clientHeight`.
- Other jumps in the same file: message key alignment uses `top: offset - 12` and `behavior: "instant"`; aligning to the answer body uses `top - 48`; one highlight path uses `behavior: "smooth"` and a `-30` offset.

There is no typewriter delay, `charDelay`, or per-character timer in this bundle. Stream text is rendered as the fragments arrive. `requestAnimationFrame` in this file is used by the virtual list and resize observers, not as a typing clock.

## Greeting

The static fallback in the zh catalog is `welcomeMessageChat250808: "今天有什么可以帮到你？"`. English is `"How can I help you?"`.

Selection in the home component:

- Read remote feature `welcome_msg` (`time_config`, `fallback_message`, `messages`).
- `minutes = 60 * hours + minutes`.
- Keep `time_config` rows whose `start <= minutes < end`. The id set is those rows’ `use` lists, or `fallback_message` when none match.
- Keep `messages` whose `id` is in that set. If the set is empty, there is no alternate line.
- Otherwise pick `messages[Math.floor(random * length)].text`. `Math.random()` is memoized once per mount.
- If a file is attached, the model is not the default, or the random line is missing, the UI shows `welcomeMessageChat250808` (or the single-model `welcomeMsg` when only one switchable model exists).

`欢迎回来，随时开始吧` and `欢迎回来，想从哪里开始？` are not in `main.js` or the CSS. They were seen on logged-in screenshots (desktop and phone), so they belong to the remote `welcome_msg` payload. This client does not call that API.

Harbor substitutes the observed lines locally. With no conversations, the headline is the static fallback `今天有什么可以帮到你？` (English: `How can I help you?`). Once any conversation exists, each home mount picks one of the two returning lines at random: `欢迎回来，随时开始吧` or `欢迎回来，想从哪里开始？`. The English pair is `Welcome back. Where should we start?` and `Welcome back. What should we pick up?`. The pick is memoized for that mount.

## Motion tokens used while matching

| Token | Value |
| --- | --- |
| `--ds-transition-duration` | `.2s` |
| `--ds-transition-duration-fast` | `.1s` |
| `--ds-transition-duration-slow` | `.3s` |
| `--ds-ease-in-out` | `cubic-bezier(.4, 0, .2, 1)` |
| `--ds-ease-in` | `cubic-bezier(.4, 0, 1, 1)` |
| `--ds-ease-out` | `cubic-bezier(0, 0, .2, 1)` |

Dialog enter is opacity plus `scale(.8)` to `scale(1)` over the fast duration and `--ds-ease-in`, which is the `.ds-fade-in-zoom-in-expand-*` rule.
