# Style audit

Visible painted elements only. Keys are the region plus the accessible name or text. Sidebar rows align by position, and extra official chats are not missing UI. Geometry allows ±0.5px. A text box may differ by 1px in width, height, or line-height when its font size, weight, and color already match. Container inheritance is not compared.

The replaced 1920 captures are included. `search-dialog` at 1440 is the home screen with the greeting and the open sidebar, and no chat is open. The 1920 search file was captured with the sidebar collapsed, so Harbor collapses the sidebar before opening search at that width.

| State | Viewport | Official visible | Matched equal | Matched with diff | Official only | Harbor only | Allowlisted | Unexplained | Result |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| home-with-history | 1440x900 | 64 | 28 | 0 | 0 | 5 | 19 | 0 | PASS |
| user-menu | 1440x900 | 75 | 28 | 0 | 5 | 8 | 28 | 0 | PASS |
| settings-general | 1440x900 | 103 | 52 | 0 | 0 | 5 | 18 | 0 | PASS |
| settings-account | 1440x900 | 111 | 60 | 0 | 0 | 5 | 18 | 0 | PASS |
| settings-data | 1440x900 | 99 | 50 | 0 | 0 | 5 | 18 | 0 | PASS |
| settings-terms | 1440x900 | 89 | 43 | 0 | 0 | 11 | 24 | 0 | PASS |
| search-dialog | 1440x900 | 70 | 34 | 0 | 0 | 5 | 18 | 0 | PASS |
| sidebar-item-menu | 1440x900 | 78 | 41 | 0 | 0 | 5 | 18 | 0 | PASS |
| sidebar-collapsed | 1440x900 | 23 | 22 | 0 | 0 | 0 | 0 | 0 | PASS |
| answer | 1440x900 | 121 | 74 | 1 | 0 | 5 | 19 | 3 | FAIL |
| thinking-collapsed | 1440x900 | 123 | 27 | 12 | 34 | 40 | 19 | 106 | FAIL |
| scroll-up | 1440x900 | 114 | 28 | 6 | 31 | 15 | 19 | 70 | FAIL |
| sidebar-date-groups | 1440x900 | 64 | 28 | 0 | 0 | 5 | 18 | 0 | PASS |
| home-with-history | 1920x1072 | 72 | 28 | 0 | 0 | 5 | 18 | 0 | PASS |
| user-menu | 1920x1072 | 82 | 28 | 0 | 3 | 8 | 26 | 0 | PASS |
| settings-general | 1920x1072 | 111 | 52 | 0 | 0 | 5 | 18 | 0 | PASS |
| settings-account | 1920x1072 | 119 | 60 | 0 | 0 | 5 | 18 | 0 | PASS |
| settings-data | 1920x1072 | 107 | 50 | 0 | 0 | 5 | 18 | 0 | PASS |
| settings-terms | 1920x1072 | 97 | 43 | 0 | 0 | 11 | 24 | 0 | PASS |
| search-dialog | 1920x1072 | 29 | 28 | 0 | 0 | 0 | 0 | 0 | PASS |
| sidebar-item-menu | 1920x1072 | 86 | 41 | 0 | 0 | 5 | 18 | 0 | PASS |
| sidebar-collapsed | 1920x1072 | 23 | 22 | 0 | 0 | 0 | 0 | 0 | PASS |
| answer | 1920x1072 | 141 | 38 | 39 | 6 | 8 | 19 | 58 | FAIL |
| thinking-collapsed | 1920x1072 | 144 | 27 | 11 | 44 | 40 | 19 | 112 | FAIL |
| scroll-up | 1920x1072 | 144 | 31 | 8 | 44 | 15 | 19 | 114 | FAIL |
| sidebar-date-groups | 1920x1072 | 72 | 28 | 0 | 0 | 5 | 18 | 0 | PASS |
| home-with-history | 390x844 | 23 | 19 | 0 | 0 | 0 | 0 | 0 | PASS |
| user-menu | 390x844 | 93 | 6 | 13 | 28 | 20 | 38 | 66 | FAIL |
| settings-general | 390x844 | 122 | 7 | 25 | 45 | 30 | 31 | 134 | FAIL |
| settings-account | 390x844 | 130 | 8 | 35 | 35 | 22 | 31 | 143 | FAIL |
| settings-data | 390x844 | 118 | 6 | 23 | 44 | 29 | 31 | 146 | FAIL |
| settings-terms | 390x844 | 108 | 7 | 23 | 37 | 28 | 35 | 107 | FAIL |
| answer | 390x844 | 54 | 4 | 9 | 35 | 40 | 18 | 94 | FAIL |
| thinking-collapsed | 390x844 | 62 | 2 | 13 | 29 | 46 | 9 | 145 | FAIL |
| scroll-up | 390x844 | 33 | 2 | 9 | 19 | 29 | 11 | 97 | FAIL |
| mobile-drawer | 390x844 | 71 | 18 | 10 | 2 | 7 | 18 | 38 | FAIL |
| mobile-item-sheet | 390x844 | 94 | 12 | 22 | 23 | 50 | 29 | 138 | FAIL |

## home-with-history 1440x900

No unexplained diffs.

## user-menu 1440x900

No unexplained diffs.

## settings-general 1440x900

No unexplained diffs.

## settings-account 1440x900

No unexplained diffs.

## settings-data 1440x900

No unexplained diffs.

## settings-terms 1440x900

No unexplained diffs.

## search-dialog 1440x900

No unexplained diffs.

## sidebar-item-menu 1440x900

No unexplained diffs.

## sidebar-collapsed 1440x900

No unexplained diffs.

## answer 1440x900

- main > span ‘10 秒后执行一次’ › y 650 vs 648.8
- main > span ‘10 秒后执行一次’ › w 121.39 vs 118.47
- main > span ‘10 秒后执行一次’ › h 20 vs 22

## thinking-collapsed 1440x900

- sidebar > row 1 › background-color rgba(0, 0, 0, 0) vs rgb(228, 237, 253)
- main > button @1391,12 34×34 › x 1391 vs 1390
- main > button @1391,12 34×34 › y 12 vs 10
- main > icon 16×16 @1400,21 › x 1400 vs 1399
- main > icon 16×16 @1400,21 › y 21 vs 19
- main > icon 14×14 @1203,704 › x 1202.5 vs 1214.5
- main > icon 14×14 @1203,704 › y 704 vs 721.8
- main > icon 14×14 @1203,704 › w 14 vs 12
- main > icon 14×14 @1203,704 › h 14 vs 12
- main > div @475,276 752×40 › x 474.5 vs 488.5
- main > div @475,276 752×40 › y 276 vs 253.8
- main > div @475,276 752×40 › w 752 vs 724

## scroll-up 1440x900

- sidebar > row 1 › background-color rgba(0, 0, 0, 0) vs rgb(228, 237, 253)
- main > div @475,475 752×40 › y 475 vs 479.8
- main > div @475,475 752×40 › h 40 vs 28
- main > div @475,475 752×40 › background-color rgb(255, 255, 255) vs rgba(0, 0, 0, 0)
- main > div @475,475 752×40 › border-top-left-radius 12px vs 0px
- main > div @475,475 752×40 › border-top-right-radius 12px vs 0px
- main > button @1391,12 34×34 › x 1391 vs 1390
- main > button @1391,12 34×34 › y 12 vs 10
- main > icon 16×16 @1400,21 › x 1400 vs 1399
- main > icon 16×16 @1400,21 › y 21 vs 19
- main > div @475,707 752×40 › y 707 vs 699.8
- main > div @475,707 752×40 › h 40 vs 28

## sidebar-date-groups 1440x900

No unexplained diffs.

## home-with-history 1920x1072

No unexplained diffs.

## user-menu 1920x1072

No unexplained diffs.

## settings-general 1920x1072

No unexplained diffs.

## settings-account 1920x1072

No unexplained diffs.

## settings-data 1920x1072

No unexplained diffs.

## settings-terms 1920x1072

No unexplained diffs.

## search-dialog 1920x1072

No unexplained diffs.

## sidebar-item-menu 1920x1072

No unexplained diffs.

## sidebar-collapsed 1920x1072

No unexplained diffs.

## answer 1920x1072

- main > icon 12×12 @715,116 › y 116 vs 112.89
- main > icon 12×12 @715,116 › w 12 vs 16
- main > icon 12×12 @715,116 › h 12 vs 16
- main > icon 14×16 @1407,72 › x 1407.48 vs 1406.5
- main > icon 14×16 @1407,72 › y 72 vs 65
- main > icon 14×16 @1407,72 › w 14 vs 20
- main > icon 14×16 @1407,72 › h 16 vs 20
- main > div @715,266 752×116 › y 266 vs 256.8
- main > div @715,266 752×40 › y 266 vs 256.8
- main > div @715,266 752×40 › y 266 vs 256.8
- main > icon 12×12 @715,370 › y 370 vs 360.8
- main > icon 12×12 @1455,370 › y 370 vs 360.8

## thinking-collapsed 1920x1072

- sidebar > row 1 › background-color rgba(0, 0, 0, 0) vs rgb(228, 237, 253)
- main > button @1871,12 34×34 › x 1871 vs 1870
- main > button @1871,12 34×34 › y 12 vs 10
- main > icon 16×16 @1880,21 › x 1880 vs 1879
- main > icon 16×16 @1880,21 › y 21 vs 19
- main > div @715,276 752×40 › x 714.5 vs 728.5
- main > div @715,276 752×40 › y 276 vs 253.8
- main > div @715,276 752×40 › w 752 vs 724
- main > div @715,276 752×40 › h 40 vs 44
- main > div @715,276 752×40 › background-color rgb(255, 255, 255) vs rgba(0, 0, 0, 0)
- main > div @715,276 752×40 › border-top-left-radius 12px vs 0px
- main > div @715,276 752×40 › border-top-right-radius 12px vs 0px

## scroll-up 1920x1072

- sidebar > row 1 › background-color rgba(0, 0, 0, 0) vs rgb(228, 237, 253)
- main > button @1871,12 34×34 › x 1871 vs 1870
- main > button @1871,12 34×34 › y 12 vs 10
- main > icon 16×16 @1880,21 › x 1880 vs 1879
- main > icon 16×16 @1880,21 › y 21 vs 19
- main > div @715,950 752×40 › y 950 vs 963.8
- main > div @715,950 752×40 › h 40 vs 28
- main > div @715,950 752×40 › background-color rgb(255, 255, 255) vs rgba(0, 0, 0, 0)
- main > div @715,950 752×40 › border-top-left-radius 12px vs 0px
- main > div @715,950 752×40 › border-top-right-radius 12px vs 0px
- main > div @715,508 752×40 › y 508 vs 523.8
- main > div @715,508 752×40 › h 40 vs 28

## sidebar-date-groups 1920x1072

No unexplained diffs.

## home-with-history 390x844

No unexplained diffs.

## user-menu 390x844

- sidebar 1 › padding-top 6px vs 12px
- sidebar 1 › padding-bottom 0px vs 12px
- sidebar > span ‘开启新对话’ › y 70 vs 76
- sidebar > span ‘开启新对话’ › box-shadow rgba(72, 104, 178, 0.04) 0px -2px 2px 0px, rgba(106, 111, 117, 0.09) 0px 2px 2px 0px, rgba vs rgba(0, 0, 0, 0.06) 0px 1px 2px 0px, rgba(15, 17, 21, 0.04) 0px 4px 12px 0px
- sidebar > span ‘智能搜索’ › x 131.02 vs 147
- sidebar > span ‘智能搜索’ › y 769 vs 423.5
- row-more 1 › w 28 vs 32
- row-more 1 › h 28 vs 32
- row-more 1 › border-top-left-radius 4096px vs 8px
- row-more 1 › border-top-right-radius 4096px vs 8px
- row-more 1 › border-bottom-right-radius 4096px vs 8px
- row-more 1 › border-bottom-left-radius 4096px vs 8px

## settings-general 390x844

- sidebar 1 › padding-top 6px vs 12px
- sidebar 1 › padding-bottom 0px vs 12px
- sidebar > span ‘开启新对话’ › y 70 vs 76
- sidebar > span ‘开启新对话’ › box-shadow rgba(72, 104, 178, 0.04) 0px -2px 2px 0px, rgba(106, 111, 117, 0.09) 0px 2px 2px 0px, rgba vs rgba(0, 0, 0, 0.06) 0px 1px 2px 0px, rgba(15, 17, 21, 0.04) 0px 4px 12px 0px
- sidebar > span ‘智能搜索’ › x 131.02 vs 147
- sidebar > span ‘智能搜索’ › y 769 vs 423.5
- sidebar > span ‘通用设置’ › x 24 vs 8
- sidebar > span ‘通用设置’ › y 128 vs 113.09
- sidebar > span ‘通用设置’ › w 108 vs 98
- sidebar > span ‘账号管理’ › x 136 vs 110
- sidebar > span ‘账号管理’ › y 128 vs 113.09
- sidebar > span ‘账号管理’ › w 108 vs 98

## settings-account 390x844

- sidebar 1 › padding-top 6px vs 12px
- sidebar 1 › padding-bottom 0px vs 12px
- sidebar > span ‘开启新对话’ › y 70 vs 76
- sidebar > span ‘开启新对话’ › box-shadow rgba(72, 104, 178, 0.04) 0px -2px 2px 0px, rgba(106, 111, 117, 0.09) 0px 2px 2px 0px, rgba vs rgba(0, 0, 0, 0.06) 0px 1px 2px 0px, rgba(15, 17, 21, 0.04) 0px 4px 12px 0px
- sidebar > span ‘智能搜索’ › x 131.02 vs 147
- sidebar > span ‘智能搜索’ › y 769 vs 423.5
- sidebar > span ‘通用设置’ › x 24 vs 8
- sidebar > span ‘通用设置’ › y 128 vs 113.09
- sidebar > span ‘通用设置’ › w 108 vs 98
- sidebar > span ‘账号管理’ › x 136 vs 110
- sidebar > span ‘账号管理’ › y 128 vs 113.09
- sidebar > span ‘账号管理’ › w 108 vs 98

## settings-data 390x844

- sidebar 1 › padding-top 6px vs 12px
- sidebar 1 › padding-bottom 0px vs 12px
- sidebar > span ‘开启新对话’ › y 70 vs 76
- sidebar > span ‘开启新对话’ › box-shadow rgba(72, 104, 178, 0.04) 0px -2px 2px 0px, rgba(106, 111, 117, 0.09) 0px 2px 2px 0px, rgba vs rgba(0, 0, 0, 0.06) 0px 1px 2px 0px, rgba(15, 17, 21, 0.04) 0px 4px 12px 0px
- sidebar > span ‘智能搜索’ › x 131.02 vs 147
- sidebar > span ‘智能搜索’ › y 769 vs 423.5
- sidebar > span ‘通用设置’ › x -78 vs -22
- sidebar > span ‘通用设置’ › y 128 vs 113.09
- sidebar > span ‘通用设置’ › w 108 vs 98
- sidebar > span ‘账号管理’ › x 34 vs 80
- sidebar > span ‘账号管理’ › y 128 vs 113.09
- sidebar > span ‘账号管理’ › w 108 vs 98

## settings-terms 390x844

- sidebar 1 › padding-top 6px vs 12px
- sidebar 1 › padding-bottom 0px vs 12px
- sidebar > span ‘开启新对话’ › y 70 vs 76
- sidebar > span ‘开启新对话’ › box-shadow rgba(72, 104, 178, 0.04) 0px -2px 2px 0px, rgba(106, 111, 117, 0.09) 0px 2px 2px 0px, rgba vs rgba(0, 0, 0, 0.06) 0px 1px 2px 0px, rgba(15, 17, 21, 0.04) 0px 4px 12px 0px
- sidebar > span ‘智能搜索’ › x 131.02 vs 147
- sidebar > span ‘智能搜索’ › y 769 vs 423.5
- sidebar > span ‘通用设置’ › x -78 vs -22
- sidebar > span ‘通用设置’ › y 128 vs 113.09
- sidebar > span ‘通用设置’ › w 108 vs 98
- sidebar > span ‘账号管理’ › x 34 vs 80
- sidebar > span ‘账号管理’ › y 128 vs 113.09
- sidebar > span ‘账号管理’ › w 108 vs 98

## answer 390x844

- control ‘智能搜索’ › x 131.02 vs 139
- control ‘智能搜索’ › y 769 vs 732.8
- sidebar > span ‘智能搜索’ › x 160.02 vs 168
- sidebar > span ‘智能搜索’ › y 774 vs 737.8
- sidebar > div ‘内容由 AI 生成，请仔细甄别’ › x 16 vs 24
- sidebar > div ‘内容由 AI 生成，请仔细甄别’ › y 816 vs 807.8
- sidebar > div ‘内容由 AI 生成，请仔细甄别’ › w 358 vs 342
- main > button @331,12 44×44 › x 331 vs 348
- main > button @331,12 44×44 › w 44 vs 32
- main > button @331,12 44×44 › h 44 vs 32
- main > button @331,12 44×44 › border-top-left-radius 4096px vs 8px
- main > button @331,12 44×44 › border-top-right-radius 4096px vs 8px

## thinking-collapsed 390x844

- control ‘智能搜索’ › x 131.02 vs 139
- control ‘智能搜索’ › y 769 vs 733
- sidebar > span ‘智能搜索’ › x 160.02 vs 168
- sidebar > span ‘智能搜索’ › y 774 vs 738
- row-more 1 › w 34 vs 36
- row-more 1 › h 34 vs 36
- row-more 1 › background-color rgba(0, 0, 0, 0) vs rgb(255, 255, 255)
- row-more 1 › box-shadow none vs rgba(0, 0, 0, 0.2) 0px 0px 1px 0px, rgba(0, 0, 0, 0.02) 0px 0px 4px 0px, rgba(0, 0, 0, 0.0
- row-more 1 › border-top-left-radius 4096px vs 50%
- row-more 1 › border-top-right-radius 4096px vs 50%
- row-more 1 › border-bottom-right-radius 4096px vs 50%
- row-more 1 › border-bottom-left-radius 4096px vs 50%

## scroll-up 390x844

- control ‘智能搜索’ › x 131.02 vs 139
- control ‘智能搜索’ › y 769 vs 733
- sidebar > span ‘智能搜索’ › x 160.02 vs 168
- sidebar > span ‘智能搜索’ › y 774 vs 738
- row-more 1 › w 34 vs 36
- row-more 1 › h 34 vs 36
- row-more 1 › background-color rgba(0, 0, 0, 0) vs rgb(255, 255, 255)
- row-more 1 › box-shadow none vs rgba(0, 0, 0, 0.2) 0px 0px 1px 0px, rgba(0, 0, 0, 0.02) 0px 0px 4px 0px, rgba(0, 0, 0, 0.0
- row-more 1 › border-top-left-radius 4096px vs 50%
- row-more 1 › border-top-right-radius 4096px vs 50%
- row-more 1 › border-bottom-right-radius 4096px vs 50%
- row-more 1 › border-bottom-left-radius 4096px vs 50%

## mobile-drawer 390x844

- sidebar 1 › padding-top 6px vs 12px
- sidebar 1 › padding-bottom 0px vs 12px
- sidebar > span ‘开启新对话’ › y 70 vs 76
- sidebar > span ‘开启新对话’ › box-shadow rgba(72, 104, 178, 0.04) 0px -2px 2px 0px, rgba(106, 111, 117, 0.09) 0px 2px 2px 0px, rgba vs rgba(0, 0, 0, 0.06) 0px 1px 2px 0px, rgba(15, 17, 21, 0.04) 0px 4px 12px 0px
- row-more 1 › w 34 vs 32
- row-more 1 › h 34 vs 32
- row-more 1 › border-top-left-radius 4096px vs 8px
- row-more 1 › border-top-right-radius 4096px vs 8px
- row-more 1 › border-bottom-right-radius 4096px vs 8px
- row-more 1 › border-bottom-left-radius 4096px vs 8px
- row-more 1 › font-size 14px vs 16px
- row-more 1 › color rgb(15, 17, 21) vs rgb(97, 102, 107)

## mobile-item-sheet 390x844

- sidebar > row 1 › h 40 vs 46
- sidebar > row 1 › background-color rgba(0, 0, 0, 0) vs rgb(228, 237, 253)
- sidebar 1 › padding-top 6px vs 12px
- sidebar 1 › padding-bottom 0px vs 12px
- sidebar > span ‘开启新对话’ › y 70 vs 76
- sidebar > span ‘开启新对话’ › box-shadow rgba(72, 104, 178, 0.04) 0px -2px 2px 0px, rgba(106, 111, 117, 0.09) 0px 2px 2px 0px, rgba vs rgba(0, 0, 0, 0.06) 0px 1px 2px 0px, rgba(15, 17, 21, 0.04) 0px 4px 12px 0px
- sidebar > span ‘智能搜索’ › x 131.02 vs 139
- sidebar > span ‘智能搜索’ › y 769 vs 732.8
- row-more 1 › w 28 vs 12
- row-more 1 › h 28 vs 12
- row-more 1 › background-color rgba(0, 0, 0, 0) vs rgb(249, 250, 251)
- row-more 1 › font-size 13px vs 14px

