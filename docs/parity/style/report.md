# Style audit

Harbor captures compared with `/cursor/stores/bot/hfd-ref/style-official/`. Geometry allows ±0.5px. Colors match after normalization. `font-family` is a known item. Brand and owner-rule exceptions are listed in `tools/style-audit/allowlist.yaml`. Sidebar chats and date groups align by position; extra official rows are not mismatches.

These 1920 captures show the open 「定时器解释」 answer, while the 1440 file of the same state shows the home greeting. Recapture the 1920 file from the home screen before treating its unexplained count as a Harbor defect: `search-dialog`, `settings-general`, `settings-account`, `settings-data`, `settings-terms`, `user-menu`, `sidebar-item-menu`, `sidebar-date-groups`, `sidebar-collapsed`. `home-with-history` at 1920 is a real home screen (greeting 「晚上好，有什么我能帮你的吗？」). `answer`, `scroll-up`, and `thinking-collapsed` match across both widths.

| State | Viewport | Matched | Mismatched | Allowlisted | Unexplained | Result |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| home-with-history | 1440x900 | 9 | 70 | 45 | 222 | FAIL |
| user-menu | 1440x900 | 9 | 69 | 44 | 234 | FAIL |
| settings-general | 1440x900 | 12 | 112 | 47 | 388 | FAIL |
| settings-account | 1440x900 | 10 | 76 | 46 | 338 | FAIL |
| settings-data | 1440x900 | 14 | 148 | 49 | 441 | FAIL |
| settings-terms | 1440x900 | 12 | 115 | 47 | 353 | FAIL |
| search-dialog | 1440x900 | 9 | 69 | 44 | 243 | FAIL |
| sidebar-item-menu | 1440x900 | 8 | 54 | 43 | 282 | FAIL |
| sidebar-collapsed | 1440x900 | 7 | 81 | 32 | 196 | FAIL |
| answer | 1440x900 | 11 | 90 | 46 | 570 | FAIL |
| thinking-collapsed | 1440x900 | 13 | 141 | 48 | 617 | FAIL |
| scroll-up | 1440x900 | 16 | 157 | 51 | 659 | FAIL |
| sidebar-date-groups | 1440x900 | 9 | 69 | 44 | 227 | FAIL |
| home-with-history | 1920x1072 | 8 | 61 | 44 | 219 | FAIL |
| user-menu | 1920x1072 | 8 | 82 | 44 | 530 | FAIL |
| settings-general | 1920x1072 | 12 | 143 | 48 | 704 | FAIL |
| settings-account | 1920x1072 | 10 | 105 | 47 | 652 | FAIL |
| settings-data | 1920x1072 | 15 | 180 | 51 | 756 | FAIL |
| settings-terms | 1920x1072 | 11 | 128 | 47 | 653 | FAIL |
| search-dialog | 1920x1072 | 10 | 110 | 55 | 566 | FAIL |
| sidebar-item-menu | 1920x1072 | 11 | 117 | 47 | 618 | FAIL |
| sidebar-collapsed | 1920x1072 | 7 | 102 | 32 | 501 | FAIL |
| answer | 1920x1072 | 11 | 102 | 47 | 572 | FAIL |
| thinking-collapsed | 1920x1072 | 10 | 109 | 46 | 588 | FAIL |
| scroll-up | 1920x1072 | 14 | 140 | 50 | 636 | FAIL |
| sidebar-date-groups | 1920x1072 | 8 | 82 | 44 | 523 | FAIL |

## home-with-history 1440x900

| Property | Official | Ours | Key |
| --- | --- | --- | --- |
| box-sizing | content-box | border-box | \|\|\|div#1 |
| height | 0px | 900px | \|\|\|div#1 |
| color | rgb(128, 0, 128) | rgb(15, 17, 21) | \|\|\|div#1 |
| font-size | 14px | 16px | \|\|\|div#1 |
| line-height | normal | 27.2px | \|\|\|div#1 |
| h | 0 | 900 | \|\|\|div#1 |
| position | absolute | static | \|\|\|div#1 > \|\|\|div#1 |
| box-sizing | content-box | border-box | \|\|\|div#1 > \|\|\|div#1 |
| background-color | rgba(0, 0, 0, 0) | rgb(255, 255, 255) | \|\|\|div#1 > \|\|\|div#1 |
| color | rgb(128, 0, 128) | rgb(15, 17, 21) | \|\|\|div#1 > \|\|\|div#1 |
| font-size | 14px | 16px | \|\|\|div#1 > \|\|\|div#1 |
| line-height | normal | 27.2px | \|\|\|div#1 > \|\|\|div#1 |
| display | block | flex | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |
| box-sizing | content-box | border-box | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |
| width | 70px | 94px | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |

## user-menu 1440x900

| Property | Official | Ours | Key |
| --- | --- | --- | --- |
| box-sizing | content-box | border-box | \|\|\|div#1 |
| height | 0px | 900px | \|\|\|div#1 |
| color | rgb(128, 0, 128) | rgb(15, 17, 21) | \|\|\|div#1 |
| font-size | 14px | 16px | \|\|\|div#1 |
| line-height | normal | 27.2px | \|\|\|div#1 |
| h | 0 | 900 | \|\|\|div#1 |
| position | absolute | static | \|\|\|div#1 > \|\|\|div#1 |
| box-sizing | content-box | border-box | \|\|\|div#1 > \|\|\|div#1 |
| background-color | rgba(0, 0, 0, 0) | rgb(255, 255, 255) | \|\|\|div#1 > \|\|\|div#1 |
| color | rgb(128, 0, 128) | rgb(15, 17, 21) | \|\|\|div#1 > \|\|\|div#1 |
| font-size | 14px | 16px | \|\|\|div#1 > \|\|\|div#1 |
| line-height | normal | 27.2px | \|\|\|div#1 > \|\|\|div#1 |
| display | block | flex | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |
| box-sizing | content-box | border-box | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |
| width | 70px | 94px | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |

## settings-general 1440x900

| Property | Official | Ours | Key |
| --- | --- | --- | --- |
| box-sizing | content-box | border-box | \|\|\|div#1 |
| height | 0px | 900px | \|\|\|div#1 |
| color | rgb(128, 0, 128) | rgb(15, 17, 21) | \|\|\|div#1 |
| font-size | 14px | 16px | \|\|\|div#1 |
| line-height | normal | 27.2px | \|\|\|div#1 |
| h | 0 | 900 | \|\|\|div#1 |
| position | absolute | static | \|\|\|div#1 > \|\|\|div#1 |
| box-sizing | content-box | border-box | \|\|\|div#1 > \|\|\|div#1 |
| background-color | rgba(0, 0, 0, 0) | rgb(255, 255, 255) | \|\|\|div#1 > \|\|\|div#1 |
| color | rgb(128, 0, 128) | rgb(15, 17, 21) | \|\|\|div#1 > \|\|\|div#1 |
| font-size | 14px | 16px | \|\|\|div#1 > \|\|\|div#1 |
| line-height | normal | 27.2px | \|\|\|div#1 > \|\|\|div#1 |
| display | block | flex | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |
| box-sizing | content-box | border-box | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |
| width | 70px | 94px | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |

## settings-account 1440x900

| Property | Official | Ours | Key |
| --- | --- | --- | --- |
| box-sizing | content-box | border-box | \|\|\|div#1 |
| height | 0px | 900px | \|\|\|div#1 |
| color | rgb(128, 0, 128) | rgb(15, 17, 21) | \|\|\|div#1 |
| font-size | 14px | 16px | \|\|\|div#1 |
| line-height | normal | 27.2px | \|\|\|div#1 |
| h | 0 | 900 | \|\|\|div#1 |
| position | absolute | static | \|\|\|div#1 > \|\|\|div#1 |
| box-sizing | content-box | border-box | \|\|\|div#1 > \|\|\|div#1 |
| background-color | rgba(0, 0, 0, 0) | rgb(255, 255, 255) | \|\|\|div#1 > \|\|\|div#1 |
| color | rgb(128, 0, 128) | rgb(15, 17, 21) | \|\|\|div#1 > \|\|\|div#1 |
| font-size | 14px | 16px | \|\|\|div#1 > \|\|\|div#1 |
| line-height | normal | 27.2px | \|\|\|div#1 > \|\|\|div#1 |
| display | block | flex | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |
| box-sizing | content-box | border-box | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |
| width | 70px | 94px | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |

## settings-data 1440x900

| Property | Official | Ours | Key |
| --- | --- | --- | --- |
| box-sizing | content-box | border-box | \|\|\|div#1 |
| height | 0px | 900px | \|\|\|div#1 |
| color | rgb(128, 0, 128) | rgb(15, 17, 21) | \|\|\|div#1 |
| font-size | 14px | 16px | \|\|\|div#1 |
| line-height | normal | 27.2px | \|\|\|div#1 |
| h | 0 | 900 | \|\|\|div#1 |
| position | absolute | static | \|\|\|div#1 > \|\|\|div#1 |
| box-sizing | content-box | border-box | \|\|\|div#1 > \|\|\|div#1 |
| background-color | rgba(0, 0, 0, 0) | rgb(255, 255, 255) | \|\|\|div#1 > \|\|\|div#1 |
| color | rgb(128, 0, 128) | rgb(15, 17, 21) | \|\|\|div#1 > \|\|\|div#1 |
| font-size | 14px | 16px | \|\|\|div#1 > \|\|\|div#1 |
| line-height | normal | 27.2px | \|\|\|div#1 > \|\|\|div#1 |
| display | block | flex | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |
| box-sizing | content-box | border-box | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |
| width | 70px | 94px | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |

## settings-terms 1440x900

| Property | Official | Ours | Key |
| --- | --- | --- | --- |
| box-sizing | content-box | border-box | \|\|\|div#1 |
| height | 0px | 900px | \|\|\|div#1 |
| color | rgb(128, 0, 128) | rgb(15, 17, 21) | \|\|\|div#1 |
| font-size | 14px | 16px | \|\|\|div#1 |
| line-height | normal | 27.2px | \|\|\|div#1 |
| h | 0 | 900 | \|\|\|div#1 |
| position | absolute | static | \|\|\|div#1 > \|\|\|div#1 |
| box-sizing | content-box | border-box | \|\|\|div#1 > \|\|\|div#1 |
| background-color | rgba(0, 0, 0, 0) | rgb(255, 255, 255) | \|\|\|div#1 > \|\|\|div#1 |
| color | rgb(128, 0, 128) | rgb(15, 17, 21) | \|\|\|div#1 > \|\|\|div#1 |
| font-size | 14px | 16px | \|\|\|div#1 > \|\|\|div#1 |
| line-height | normal | 27.2px | \|\|\|div#1 > \|\|\|div#1 |
| display | block | flex | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |
| box-sizing | content-box | border-box | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |
| width | 70px | 94px | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |

## search-dialog 1440x900

| Property | Official | Ours | Key |
| --- | --- | --- | --- |
| box-sizing | content-box | border-box | \|\|\|div#1 |
| height | 0px | 900px | \|\|\|div#1 |
| color | rgb(128, 0, 128) | rgb(15, 17, 21) | \|\|\|div#1 |
| font-size | 14px | 16px | \|\|\|div#1 |
| line-height | normal | 27.2px | \|\|\|div#1 |
| h | 0 | 900 | \|\|\|div#1 |
| position | absolute | static | \|\|\|div#1 > \|\|\|div#1 |
| box-sizing | content-box | border-box | \|\|\|div#1 > \|\|\|div#1 |
| background-color | rgba(0, 0, 0, 0) | rgb(255, 255, 255) | \|\|\|div#1 > \|\|\|div#1 |
| color | rgb(128, 0, 128) | rgb(15, 17, 21) | \|\|\|div#1 > \|\|\|div#1 |
| font-size | 14px | 16px | \|\|\|div#1 > \|\|\|div#1 |
| line-height | normal | 27.2px | \|\|\|div#1 > \|\|\|div#1 |
| display | block | flex | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |
| box-sizing | content-box | border-box | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |
| width | 70px | 94px | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |

## sidebar-item-menu 1440x900

| Property | Official | Ours | Key |
| --- | --- | --- | --- |
| box-sizing | content-box | border-box | \|\|\|div#1 |
| height | 0px | 900px | \|\|\|div#1 |
| color | rgb(128, 0, 128) | rgb(15, 17, 21) | \|\|\|div#1 |
| font-size | 14px | 16px | \|\|\|div#1 |
| line-height | normal | 27.2px | \|\|\|div#1 |
| h | 0 | 900 | \|\|\|div#1 |
| position | absolute | static | \|\|\|div#1 > \|\|\|div#1 |
| box-sizing | content-box | border-box | \|\|\|div#1 > \|\|\|div#1 |
| background-color | rgba(0, 0, 0, 0) | rgb(255, 255, 255) | \|\|\|div#1 > \|\|\|div#1 |
| color | rgb(128, 0, 128) | rgb(15, 17, 21) | \|\|\|div#1 > \|\|\|div#1 |
| font-size | 14px | 16px | \|\|\|div#1 > \|\|\|div#1 |
| line-height | normal | 27.2px | \|\|\|div#1 > \|\|\|div#1 |
| display | block | flex | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |
| box-sizing | content-box | border-box | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |
| width | 70px | 94px | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |

## sidebar-collapsed 1440x900

| Property | Official | Ours | Key |
| --- | --- | --- | --- |
| box-sizing | content-box | border-box | \|\|\|div#1 |
| height | 0px | 900px | \|\|\|div#1 |
| color | rgb(128, 0, 128) | rgb(15, 17, 21) | \|\|\|div#1 |
| font-size | 14px | 16px | \|\|\|div#1 |
| line-height | normal | 27.2px | \|\|\|div#1 |
| h | 0 | 900 | \|\|\|div#1 |
| position | absolute | static | \|\|\|div#1 > \|\|\|div#1 |
| box-sizing | content-box | border-box | \|\|\|div#1 > \|\|\|div#1 |
| background-color | rgba(0, 0, 0, 0) | rgb(255, 255, 255) | \|\|\|div#1 > \|\|\|div#1 |
| color | rgb(128, 0, 128) | rgb(15, 17, 21) | \|\|\|div#1 > \|\|\|div#1 |
| font-size | 14px | 16px | \|\|\|div#1 > \|\|\|div#1 |
| line-height | normal | 27.2px | \|\|\|div#1 > \|\|\|div#1 |
| display | block | flex | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#1 |
| position | static | fixed | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#1 |
| box-sizing | content-box | border-box | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#1 |

## answer 1440x900

| Property | Official | Ours | Key |
| --- | --- | --- | --- |
| box-sizing | content-box | border-box | \|\|\|div#1 |
| height | 0px | 900px | \|\|\|div#1 |
| color | rgb(128, 0, 128) | rgb(15, 17, 21) | \|\|\|div#1 |
| font-size | 14px | 16px | \|\|\|div#1 |
| line-height | normal | 27.2px | \|\|\|div#1 |
| h | 0 | 900 | \|\|\|div#1 |
| position | absolute | static | \|\|\|div#1 > \|\|\|div#1 |
| box-sizing | content-box | border-box | \|\|\|div#1 > \|\|\|div#1 |
| background-color | rgba(0, 0, 0, 0) | rgb(255, 255, 255) | \|\|\|div#1 > \|\|\|div#1 |
| color | rgb(128, 0, 128) | rgb(15, 17, 21) | \|\|\|div#1 > \|\|\|div#1 |
| font-size | 14px | 16px | \|\|\|div#1 > \|\|\|div#1 |
| line-height | normal | 27.2px | \|\|\|div#1 > \|\|\|div#1 |
| display | block | flex | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |
| box-sizing | content-box | border-box | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |
| width | 70px | 94px | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |

## thinking-collapsed 1440x900

| Property | Official | Ours | Key |
| --- | --- | --- | --- |
| box-sizing | content-box | border-box | \|\|\|div#1 |
| height | 0px | 900px | \|\|\|div#1 |
| color | rgb(128, 0, 128) | rgb(15, 17, 21) | \|\|\|div#1 |
| font-size | 14px | 16px | \|\|\|div#1 |
| line-height | normal | 27.2px | \|\|\|div#1 |
| h | 0 | 900 | \|\|\|div#1 |
| position | absolute | static | \|\|\|div#1 > \|\|\|div#1 |
| box-sizing | content-box | border-box | \|\|\|div#1 > \|\|\|div#1 |
| background-color | rgba(0, 0, 0, 0) | rgb(255, 255, 255) | \|\|\|div#1 > \|\|\|div#1 |
| color | rgb(128, 0, 128) | rgb(15, 17, 21) | \|\|\|div#1 > \|\|\|div#1 |
| font-size | 14px | 16px | \|\|\|div#1 > \|\|\|div#1 |
| line-height | normal | 27.2px | \|\|\|div#1 > \|\|\|div#1 |
| display | block | flex | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |
| box-sizing | content-box | border-box | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |
| width | 70px | 94px | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |

## scroll-up 1440x900

| Property | Official | Ours | Key |
| --- | --- | --- | --- |
| box-sizing | content-box | border-box | \|\|\|div#1 |
| height | 0px | 900px | \|\|\|div#1 |
| color | rgb(128, 0, 128) | rgb(15, 17, 21) | \|\|\|div#1 |
| font-size | 14px | 16px | \|\|\|div#1 |
| line-height | normal | 27.2px | \|\|\|div#1 |
| h | 0 | 900 | \|\|\|div#1 |
| position | absolute | static | \|\|\|div#1 > \|\|\|div#1 |
| box-sizing | content-box | border-box | \|\|\|div#1 > \|\|\|div#1 |
| background-color | rgba(0, 0, 0, 0) | rgb(255, 255, 255) | \|\|\|div#1 > \|\|\|div#1 |
| color | rgb(128, 0, 128) | rgb(15, 17, 21) | \|\|\|div#1 > \|\|\|div#1 |
| font-size | 14px | 16px | \|\|\|div#1 > \|\|\|div#1 |
| line-height | normal | 27.2px | \|\|\|div#1 > \|\|\|div#1 |
| display | block | flex | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |
| box-sizing | content-box | border-box | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |
| width | 70px | 94px | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |

## sidebar-date-groups 1440x900

| Property | Official | Ours | Key |
| --- | --- | --- | --- |
| box-sizing | content-box | border-box | \|\|\|div#1 |
| height | 0px | 900px | \|\|\|div#1 |
| color | rgb(128, 0, 128) | rgb(15, 17, 21) | \|\|\|div#1 |
| font-size | 14px | 16px | \|\|\|div#1 |
| line-height | normal | 27.2px | \|\|\|div#1 |
| h | 0 | 900 | \|\|\|div#1 |
| position | absolute | static | \|\|\|div#1 > \|\|\|div#1 |
| box-sizing | content-box | border-box | \|\|\|div#1 > \|\|\|div#1 |
| background-color | rgba(0, 0, 0, 0) | rgb(255, 255, 255) | \|\|\|div#1 > \|\|\|div#1 |
| color | rgb(128, 0, 128) | rgb(15, 17, 21) | \|\|\|div#1 > \|\|\|div#1 |
| font-size | 14px | 16px | \|\|\|div#1 > \|\|\|div#1 |
| line-height | normal | 27.2px | \|\|\|div#1 > \|\|\|div#1 |
| display | block | flex | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |
| box-sizing | content-box | border-box | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |
| width | 70px | 94px | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |

## home-with-history 1920x1072

| Property | Official | Ours | Key |
| --- | --- | --- | --- |
| box-sizing | content-box | border-box | \|\|\|div#1 |
| height | 0px | 1072px | \|\|\|div#1 |
| color | rgb(128, 0, 128) | rgb(15, 17, 21) | \|\|\|div#1 |
| font-size | 14px | 16px | \|\|\|div#1 |
| line-height | normal | 27.2px | \|\|\|div#1 |
| h | 0 | 1072 | \|\|\|div#1 |
| position | absolute | static | \|\|\|div#1 > \|\|\|div#1 |
| box-sizing | content-box | border-box | \|\|\|div#1 > \|\|\|div#1 |
| background-color | rgba(0, 0, 0, 0) | rgb(255, 255, 255) | \|\|\|div#1 > \|\|\|div#1 |
| color | rgb(128, 0, 128) | rgb(15, 17, 21) | \|\|\|div#1 > \|\|\|div#1 |
| font-size | 14px | 16px | \|\|\|div#1 > \|\|\|div#1 |
| line-height | normal | 27.2px | \|\|\|div#1 > \|\|\|div#1 |
| display | block | flex | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |
| box-sizing | content-box | border-box | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |
| width | 70px | 94px | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |

## user-menu 1920x1072

| Property | Official | Ours | Key |
| --- | --- | --- | --- |
| box-sizing | content-box | border-box | \|\|\|div#1 |
| height | 0px | 1072px | \|\|\|div#1 |
| color | rgb(128, 0, 128) | rgb(15, 17, 21) | \|\|\|div#1 |
| font-size | 14px | 16px | \|\|\|div#1 |
| line-height | normal | 27.2px | \|\|\|div#1 |
| h | 0 | 1072 | \|\|\|div#1 |
| position | absolute | static | \|\|\|div#1 > \|\|\|div#1 |
| box-sizing | content-box | border-box | \|\|\|div#1 > \|\|\|div#1 |
| background-color | rgba(0, 0, 0, 0) | rgb(255, 255, 255) | \|\|\|div#1 > \|\|\|div#1 |
| color | rgb(128, 0, 128) | rgb(15, 17, 21) | \|\|\|div#1 > \|\|\|div#1 |
| font-size | 14px | 16px | \|\|\|div#1 > \|\|\|div#1 |
| line-height | normal | 27.2px | \|\|\|div#1 > \|\|\|div#1 |
| display | block | flex | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |
| box-sizing | content-box | border-box | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |
| width | 70px | 94px | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |

## settings-general 1920x1072

| Property | Official | Ours | Key |
| --- | --- | --- | --- |
| box-sizing | content-box | border-box | \|\|\|div#1 |
| height | 0px | 1072px | \|\|\|div#1 |
| color | rgb(128, 0, 128) | rgb(15, 17, 21) | \|\|\|div#1 |
| font-size | 14px | 16px | \|\|\|div#1 |
| line-height | normal | 27.2px | \|\|\|div#1 |
| h | 0 | 1072 | \|\|\|div#1 |
| position | absolute | static | \|\|\|div#1 > \|\|\|div#1 |
| box-sizing | content-box | border-box | \|\|\|div#1 > \|\|\|div#1 |
| background-color | rgba(0, 0, 0, 0) | rgb(255, 255, 255) | \|\|\|div#1 > \|\|\|div#1 |
| color | rgb(128, 0, 128) | rgb(15, 17, 21) | \|\|\|div#1 > \|\|\|div#1 |
| font-size | 14px | 16px | \|\|\|div#1 > \|\|\|div#1 |
| line-height | normal | 27.2px | \|\|\|div#1 > \|\|\|div#1 |
| display | block | flex | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |
| box-sizing | content-box | border-box | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |
| width | 70px | 94px | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |

## settings-account 1920x1072

| Property | Official | Ours | Key |
| --- | --- | --- | --- |
| box-sizing | content-box | border-box | \|\|\|div#1 |
| height | 0px | 1072px | \|\|\|div#1 |
| color | rgb(128, 0, 128) | rgb(15, 17, 21) | \|\|\|div#1 |
| font-size | 14px | 16px | \|\|\|div#1 |
| line-height | normal | 27.2px | \|\|\|div#1 |
| h | 0 | 1072 | \|\|\|div#1 |
| position | absolute | static | \|\|\|div#1 > \|\|\|div#1 |
| box-sizing | content-box | border-box | \|\|\|div#1 > \|\|\|div#1 |
| background-color | rgba(0, 0, 0, 0) | rgb(255, 255, 255) | \|\|\|div#1 > \|\|\|div#1 |
| color | rgb(128, 0, 128) | rgb(15, 17, 21) | \|\|\|div#1 > \|\|\|div#1 |
| font-size | 14px | 16px | \|\|\|div#1 > \|\|\|div#1 |
| line-height | normal | 27.2px | \|\|\|div#1 > \|\|\|div#1 |
| display | block | flex | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |
| box-sizing | content-box | border-box | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |
| width | 70px | 94px | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |

## settings-data 1920x1072

| Property | Official | Ours | Key |
| --- | --- | --- | --- |
| box-sizing | content-box | border-box | \|\|\|div#1 |
| height | 0px | 1072px | \|\|\|div#1 |
| color | rgb(128, 0, 128) | rgb(15, 17, 21) | \|\|\|div#1 |
| font-size | 14px | 16px | \|\|\|div#1 |
| line-height | normal | 27.2px | \|\|\|div#1 |
| h | 0 | 1072 | \|\|\|div#1 |
| position | absolute | static | \|\|\|div#1 > \|\|\|div#1 |
| box-sizing | content-box | border-box | \|\|\|div#1 > \|\|\|div#1 |
| background-color | rgba(0, 0, 0, 0) | rgb(255, 255, 255) | \|\|\|div#1 > \|\|\|div#1 |
| color | rgb(128, 0, 128) | rgb(15, 17, 21) | \|\|\|div#1 > \|\|\|div#1 |
| font-size | 14px | 16px | \|\|\|div#1 > \|\|\|div#1 |
| line-height | normal | 27.2px | \|\|\|div#1 > \|\|\|div#1 |
| display | block | flex | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |
| box-sizing | content-box | border-box | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |
| width | 70px | 94px | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |

## settings-terms 1920x1072

| Property | Official | Ours | Key |
| --- | --- | --- | --- |
| box-sizing | content-box | border-box | \|\|\|div#1 |
| height | 0px | 1072px | \|\|\|div#1 |
| color | rgb(128, 0, 128) | rgb(15, 17, 21) | \|\|\|div#1 |
| font-size | 14px | 16px | \|\|\|div#1 |
| line-height | normal | 27.2px | \|\|\|div#1 |
| h | 0 | 1072 | \|\|\|div#1 |
| position | absolute | static | \|\|\|div#1 > \|\|\|div#1 |
| box-sizing | content-box | border-box | \|\|\|div#1 > \|\|\|div#1 |
| background-color | rgba(0, 0, 0, 0) | rgb(255, 255, 255) | \|\|\|div#1 > \|\|\|div#1 |
| color | rgb(128, 0, 128) | rgb(15, 17, 21) | \|\|\|div#1 > \|\|\|div#1 |
| font-size | 14px | 16px | \|\|\|div#1 > \|\|\|div#1 |
| line-height | normal | 27.2px | \|\|\|div#1 > \|\|\|div#1 |
| display | block | flex | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |
| box-sizing | content-box | border-box | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |
| width | 70px | 94px | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |

## search-dialog 1920x1072

| Property | Official | Ours | Key |
| --- | --- | --- | --- |
| box-sizing | content-box | border-box | \|\|\|div#1 |
| height | 0px | 1072px | \|\|\|div#1 |
| color | rgb(128, 0, 128) | rgb(15, 17, 21) | \|\|\|div#1 |
| font-size | 14px | 16px | \|\|\|div#1 |
| line-height | normal | 27.2px | \|\|\|div#1 |
| h | 0 | 1072 | \|\|\|div#1 |
| position | absolute | static | \|\|\|div#1 > \|\|\|div#1 |
| box-sizing | content-box | border-box | \|\|\|div#1 > \|\|\|div#1 |
| background-color | rgba(0, 0, 0, 0) | rgb(255, 255, 255) | \|\|\|div#1 > \|\|\|div#1 |
| color | rgb(128, 0, 128) | rgb(15, 17, 21) | \|\|\|div#1 > \|\|\|div#1 |
| font-size | 14px | 16px | \|\|\|div#1 > \|\|\|div#1 |
| line-height | normal | 27.2px | \|\|\|div#1 > \|\|\|div#1 |
| display | block | flex | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |
| box-sizing | content-box | border-box | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |
| width | 70px | 94px | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |

## sidebar-item-menu 1920x1072

| Property | Official | Ours | Key |
| --- | --- | --- | --- |
| box-sizing | content-box | border-box | \|\|\|div#1 |
| height | 0px | 1072px | \|\|\|div#1 |
| color | rgb(128, 0, 128) | rgb(15, 17, 21) | \|\|\|div#1 |
| font-size | 14px | 16px | \|\|\|div#1 |
| line-height | normal | 27.2px | \|\|\|div#1 |
| h | 0 | 1072 | \|\|\|div#1 |
| position | absolute | static | \|\|\|div#1 > \|\|\|div#1 |
| box-sizing | content-box | border-box | \|\|\|div#1 > \|\|\|div#1 |
| background-color | rgba(0, 0, 0, 0) | rgb(255, 255, 255) | \|\|\|div#1 > \|\|\|div#1 |
| color | rgb(128, 0, 128) | rgb(15, 17, 21) | \|\|\|div#1 > \|\|\|div#1 |
| font-size | 14px | 16px | \|\|\|div#1 > \|\|\|div#1 |
| line-height | normal | 27.2px | \|\|\|div#1 > \|\|\|div#1 |
| display | block | flex | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |
| box-sizing | content-box | border-box | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |
| width | 70px | 94px | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |

## sidebar-collapsed 1920x1072

| Property | Official | Ours | Key |
| --- | --- | --- | --- |
| box-sizing | content-box | border-box | \|\|\|div#1 |
| height | 0px | 1072px | \|\|\|div#1 |
| color | rgb(128, 0, 128) | rgb(15, 17, 21) | \|\|\|div#1 |
| font-size | 14px | 16px | \|\|\|div#1 |
| line-height | normal | 27.2px | \|\|\|div#1 |
| h | 0 | 1072 | \|\|\|div#1 |
| position | absolute | static | \|\|\|div#1 > \|\|\|div#1 |
| box-sizing | content-box | border-box | \|\|\|div#1 > \|\|\|div#1 |
| background-color | rgba(0, 0, 0, 0) | rgb(255, 255, 255) | \|\|\|div#1 > \|\|\|div#1 |
| color | rgb(128, 0, 128) | rgb(15, 17, 21) | \|\|\|div#1 > \|\|\|div#1 |
| font-size | 14px | 16px | \|\|\|div#1 > \|\|\|div#1 |
| line-height | normal | 27.2px | \|\|\|div#1 > \|\|\|div#1 |
| display | block | flex | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#1 |
| position | static | fixed | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#1 |
| box-sizing | content-box | border-box | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#1 |

## answer 1920x1072

| Property | Official | Ours | Key |
| --- | --- | --- | --- |
| box-sizing | content-box | border-box | \|\|\|div#1 |
| height | 0px | 1072px | \|\|\|div#1 |
| color | rgb(128, 0, 128) | rgb(15, 17, 21) | \|\|\|div#1 |
| font-size | 14px | 16px | \|\|\|div#1 |
| line-height | normal | 27.2px | \|\|\|div#1 |
| h | 0 | 1072 | \|\|\|div#1 |
| position | absolute | static | \|\|\|div#1 > \|\|\|div#1 |
| box-sizing | content-box | border-box | \|\|\|div#1 > \|\|\|div#1 |
| background-color | rgba(0, 0, 0, 0) | rgb(255, 255, 255) | \|\|\|div#1 > \|\|\|div#1 |
| color | rgb(128, 0, 128) | rgb(15, 17, 21) | \|\|\|div#1 > \|\|\|div#1 |
| font-size | 14px | 16px | \|\|\|div#1 > \|\|\|div#1 |
| line-height | normal | 27.2px | \|\|\|div#1 > \|\|\|div#1 |
| display | block | flex | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |
| box-sizing | content-box | border-box | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |
| width | 70px | 94px | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |

## thinking-collapsed 1920x1072

| Property | Official | Ours | Key |
| --- | --- | --- | --- |
| box-sizing | content-box | border-box | \|\|\|div#1 |
| height | 0px | 1072px | \|\|\|div#1 |
| color | rgb(128, 0, 128) | rgb(15, 17, 21) | \|\|\|div#1 |
| font-size | 14px | 16px | \|\|\|div#1 |
| line-height | normal | 27.2px | \|\|\|div#1 |
| h | 0 | 1072 | \|\|\|div#1 |
| position | absolute | static | \|\|\|div#1 > \|\|\|div#1 |
| box-sizing | content-box | border-box | \|\|\|div#1 > \|\|\|div#1 |
| background-color | rgba(0, 0, 0, 0) | rgb(255, 255, 255) | \|\|\|div#1 > \|\|\|div#1 |
| color | rgb(128, 0, 128) | rgb(15, 17, 21) | \|\|\|div#1 > \|\|\|div#1 |
| font-size | 14px | 16px | \|\|\|div#1 > \|\|\|div#1 |
| line-height | normal | 27.2px | \|\|\|div#1 > \|\|\|div#1 |
| display | block | flex | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |
| box-sizing | content-box | border-box | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |
| width | 70px | 94px | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |

## scroll-up 1920x1072

| Property | Official | Ours | Key |
| --- | --- | --- | --- |
| box-sizing | content-box | border-box | \|\|\|div#1 |
| height | 0px | 1072px | \|\|\|div#1 |
| color | rgb(128, 0, 128) | rgb(15, 17, 21) | \|\|\|div#1 |
| font-size | 14px | 16px | \|\|\|div#1 |
| line-height | normal | 27.2px | \|\|\|div#1 |
| h | 0 | 1072 | \|\|\|div#1 |
| position | absolute | static | \|\|\|div#1 > \|\|\|div#1 |
| box-sizing | content-box | border-box | \|\|\|div#1 > \|\|\|div#1 |
| background-color | rgba(0, 0, 0, 0) | rgb(255, 255, 255) | \|\|\|div#1 > \|\|\|div#1 |
| color | rgb(128, 0, 128) | rgb(15, 17, 21) | \|\|\|div#1 > \|\|\|div#1 |
| font-size | 14px | 16px | \|\|\|div#1 > \|\|\|div#1 |
| line-height | normal | 27.2px | \|\|\|div#1 > \|\|\|div#1 |
| display | block | flex | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |
| box-sizing | content-box | border-box | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |
| width | 70px | 94px | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |

## sidebar-date-groups 1920x1072

| Property | Official | Ours | Key |
| --- | --- | --- | --- |
| box-sizing | content-box | border-box | \|\|\|div#1 |
| height | 0px | 1072px | \|\|\|div#1 |
| color | rgb(128, 0, 128) | rgb(15, 17, 21) | \|\|\|div#1 |
| font-size | 14px | 16px | \|\|\|div#1 |
| line-height | normal | 27.2px | \|\|\|div#1 |
| h | 0 | 1072 | \|\|\|div#1 |
| position | absolute | static | \|\|\|div#1 > \|\|\|div#1 |
| box-sizing | content-box | border-box | \|\|\|div#1 > \|\|\|div#1 |
| background-color | rgba(0, 0, 0, 0) | rgb(255, 255, 255) | \|\|\|div#1 > \|\|\|div#1 |
| color | rgb(128, 0, 128) | rgb(15, 17, 21) | \|\|\|div#1 > \|\|\|div#1 |
| font-size | 14px | 16px | \|\|\|div#1 > \|\|\|div#1 |
| line-height | normal | 27.2px | \|\|\|div#1 > \|\|\|div#1 |
| display | block | flex | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |
| box-sizing | content-box | border-box | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |
| width | 70px | 94px | \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\|div#1 > \|\|\|div#1 > \|\|\|div#2 > \|\|\| |

