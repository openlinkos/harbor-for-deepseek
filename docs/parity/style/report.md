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
| settings-terms | 1440x900 | 89 | 43 | 0 | 0 | 11 | 18 | 6 | FAIL |
| search-dialog | 1440x900 | 70 | 34 | 0 | 0 | 5 | 18 | 0 | PASS |
| sidebar-item-menu | 1440x900 | 78 | 40 | 0 | 0 | 5 | 18 | 0 | PASS |
| sidebar-collapsed | 1440x900 | 23 | 22 | 0 | 0 | 0 | 0 | 0 | PASS |
| answer | 1440x900 | 126 | 14 | 48 | 16 | 7 | 19 | 158 | FAIL |
| thinking-collapsed | 1440x900 | 128 | 14 | 29 | 33 | 35 | 19 | 159 | FAIL |
| scroll-up | 1440x900 | 118 | 16 | 19 | 31 | 16 | 19 | 110 | FAIL |
| sidebar-date-groups | 1440x900 | 64 | 28 | 0 | 0 | 5 | 18 | 0 | PASS |
| home-with-history | 1920x1072 | 72 | 28 | 0 | 0 | 5 | 18 | 0 | PASS |
| user-menu | 1920x1072 | 82 | 28 | 0 | 3 | 8 | 26 | 0 | PASS |
| settings-general | 1920x1072 | 111 | 52 | 0 | 0 | 5 | 18 | 0 | PASS |
| settings-account | 1920x1072 | 119 | 60 | 0 | 0 | 5 | 18 | 0 | PASS |
| settings-data | 1920x1072 | 107 | 50 | 0 | 0 | 5 | 18 | 0 | PASS |
| settings-terms | 1920x1072 | 97 | 43 | 0 | 0 | 11 | 18 | 6 | FAIL |
| search-dialog | 1920x1072 | 29 | 28 | 0 | 0 | 0 | 0 | 0 | PASS |
| sidebar-item-menu | 1920x1072 | 86 | 40 | 0 | 0 | 5 | 18 | 0 | PASS |
| sidebar-collapsed | 1920x1072 | 23 | 22 | 0 | 0 | 0 | 0 | 0 | PASS |
| answer | 1920x1072 | 147 | 14 | 51 | 20 | 11 | 19 | 182 | FAIL |
| thinking-collapsed | 1920x1072 | 150 | 14 | 30 | 42 | 33 | 19 | 172 | FAIL |
| scroll-up | 1920x1072 | 150 | 18 | 21 | 44 | 16 | 19 | 148 | FAIL |
| sidebar-date-groups | 1920x1072 | 72 | 28 | 0 | 0 | 5 | 18 | 0 | PASS |
| home-with-history | 390x844 | 23 | 19 | 0 | 0 | 0 | 0 | 0 | PASS |
| user-menu | 390x844 | 93 | 6 | 13 | 28 | 20 | 38 | 66 | FAIL |
| settings-general | 390x844 | 122 | 7 | 25 | 45 | 30 | 31 | 134 | FAIL |
| settings-account | 390x844 | 130 | 8 | 35 | 35 | 22 | 31 | 143 | FAIL |
| settings-data | 390x844 | 118 | 6 | 23 | 44 | 29 | 31 | 146 | FAIL |
| settings-terms | 390x844 | 108 | 7 | 23 | 37 | 28 | 31 | 111 | FAIL |
| answer | 390x844 | 54 | 2 | 14 | 31 | 46 | 21 | 132 | FAIL |
| thinking-collapsed | 390x844 | 62 | 2 | 13 | 27 | 41 | 8 | 160 | FAIL |
| scroll-up | 390x844 | 33 | 2 | 10 | 16 | 27 | 8 | 101 | FAIL |
| mobile-drawer | 390x844 | 71 | 18 | 10 | 2 | 7 | 18 | 38 | FAIL |
| mobile-item-sheet | 390x844 | 94 | 11 | 25 | 19 | 58 | 29 | 194 | FAIL |

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

- main > contentinfo @560,378 516×64 › missing — vs footer
- main > link ‘GitHub’ › missing — vs GitHub
- main > link ‘许可证’ › missing — vs 许可证
- main > link ‘OpenLinkOS’ › missing — vs OpenLinkOS
- main > link ‘openlinkos/harbor-for-de’ › missing — vs openlinkos/harbor-for-de
- main > link ‘platform.deepseek.com’ › missing — vs platform.deepseek.com

## search-dialog 1440x900

No unexplained diffs.

## sidebar-item-menu 1440x900

No unexplained diffs.

## sidebar-collapsed 1440x900

No unexplained diffs.

## answer 1440x900

- sidebar > row 1 › background-color rgba(0, 0, 0, 0) vs rgb(228, 237, 253)
- control ‘深度思考’ › y 825 vs 816.61
- control ‘智能搜索’ › y 825 vs 816.61
- main > span ‘深度思考’ › y 830 vs 821.61
- main > span ‘智能搜索’ › y 830 vs 821.61
- main > code ‘captureStyleAudit’ › x 492.5 vs 496.5
- main > code ‘captureStyleAudit’ › y 274 vs 278.98
- main > code ‘captureStyleAudit’ › w 143.28 vs 150.81
- main > code ‘captureStyleAudit’ › h 22 vs 18
- main > code ‘captureStyleAudit’ › padding-right 5px vs 4px
- main > code ‘captureStyleAudit’ › padding-left 5px vs 4px
- main > code ‘ReferenceError’ › x 964.8 vs 975.64

## thinking-collapsed 1440x900

- sidebar > row 1 › background-color rgba(0, 0, 0, 0) vs rgb(228, 237, 253)
- control ‘深度思考’ › y 825 vs 816.61
- control ‘智能搜索’ › y 825 vs 816.61
- main > span ‘深度思考’ › y 830 vs 821.61
- main > span ‘智能搜索’ › y 830 vs 821.61
- main > code ‘captureStyleAudit’ › x 599.92 vs 496.5
- main > code ‘captureStyleAudit’ › y 390 vs 397.89
- main > code ‘captureStyleAudit’ › w 143.28 vs 150.81
- main > code ‘captureStyleAudit’ › h 22 vs 18
- main > code ‘captureStyleAudit’ › padding-right 5px vs 4px
- main > code ‘captureStyleAudit’ › padding-left 5px vs 4px
- main > code ‘ReferenceError’ › x 964.8 vs 975.64

## scroll-up 1440x900

- sidebar > row 1 › background-color rgba(0, 0, 0, 0) vs rgb(228, 237, 253)
- control ‘深度思考’ › y 825 vs 816.61
- control ‘智能搜索’ › y 825 vs 816.61
- main > span ‘深度思考’ › y 830 vs 821.61
- main > span ‘智能搜索’ › y 830 vs 821.61
- main > button @1391,12 34×34 › x 1391 vs 1392
- main > button @1391,12 34×34 › y 12 vs 10
- main > button @1391,12 34×34 › w 34 vs 32
- main > button @1391,12 34×34 › h 34 vs 32
- main > button @1391,12 34×34 › border-top-left-radius 4096px vs 8px
- main > button @1391,12 34×34 › border-top-right-radius 4096px vs 8px
- main > button @1391,12 34×34 › border-bottom-right-radius 4096px vs 8px

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

- main > contentinfo @800,464 516×64 › missing — vs footer
- main > link ‘GitHub’ › missing — vs GitHub
- main > link ‘许可证’ › missing — vs 许可证
- main > link ‘OpenLinkOS’ › missing — vs OpenLinkOS
- main > link ‘openlinkos/harbor-for-de’ › missing — vs openlinkos/harbor-for-de
- main > link ‘platform.deepseek.com’ › missing — vs platform.deepseek.com

## search-dialog 1920x1072

No unexplained diffs.

## sidebar-item-menu 1920x1072

No unexplained diffs.

## sidebar-collapsed 1920x1072

No unexplained diffs.

## answer 1920x1072

- sidebar > row 1 › background-color rgba(0, 0, 0, 0) vs rgb(228, 237, 253)
- control ‘深度思考’ › y 997 vs 988.61
- control ‘智能搜索’ › y 997 vs 988.61
- main > span ‘深度思考’ › y 1002 vs 993.61
- main > span ‘智能搜索’ › y 1002 vs 993.61
- main > code ‘captureStyleAudit’ › x 839.92 vs 736.5
- main > code ‘captureStyleAudit’ › y 148 vs 423.98
- main > code ‘captureStyleAudit’ › w 143.28 vs 150.81
- main > code ‘captureStyleAudit’ › h 22 vs 18
- main > code ‘captureStyleAudit’ › padding-right 5px vs 4px
- main > code ‘captureStyleAudit’ › padding-left 5px vs 4px
- main > code ‘ReferenceError’ › x 1204.8 vs 1215.64

## thinking-collapsed 1920x1072

- sidebar > row 1 › background-color rgba(0, 0, 0, 0) vs rgb(228, 237, 253)
- control ‘深度思考’ › y 997 vs 988.61
- control ‘智能搜索’ › y 997 vs 988.61
- main > span ‘深度思考’ › y 1002 vs 993.61
- main > span ‘智能搜索’ › y 1002 vs 993.61
- main > code ‘captureStyleAudit’ › x 839.92 vs 736.5
- main > code ‘captureStyleAudit’ › y 390 vs 397.89
- main > code ‘captureStyleAudit’ › w 143.28 vs 150.81
- main > code ‘captureStyleAudit’ › h 22 vs 18
- main > code ‘captureStyleAudit’ › padding-right 5px vs 4px
- main > code ‘captureStyleAudit’ › padding-left 5px vs 4px
- main > code ‘ReferenceError’ › x 1204.8 vs 1215.64

## scroll-up 1920x1072

- sidebar > row 1 › background-color rgba(0, 0, 0, 0) vs rgb(228, 237, 253)
- control ‘深度思考’ › y 997 vs 988.61
- control ‘智能搜索’ › y 997 vs 988.61
- main > span ‘深度思考’ › y 1002 vs 993.61
- main > span ‘智能搜索’ › y 1002 vs 993.61
- main > button @1871,12 34×34 › x 1871 vs 1872
- main > button @1871,12 34×34 › y 12 vs 10
- main > button @1871,12 34×34 › w 34 vs 32
- main > button @1871,12 34×34 › h 34 vs 32
- main > button @1871,12 34×34 › border-top-left-radius 4096px vs 8px
- main > button @1871,12 34×34 › border-top-right-radius 4096px vs 8px
- main > button @1871,12 34×34 › border-bottom-right-radius 4096px vs 8px

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

- control ‘智能搜索’ › x 131.02 vs 151
- control ‘智能搜索’ › y 769 vs 734.31
- sidebar > span ‘智能搜索’ › x 160.02 vs 180
- sidebar > span ‘智能搜索’ › y 774 vs 739.31
- row-more 1 › padding-top 0px vs 1px
- row-more 1 › padding-right 0px vs 6px
- row-more 1 › padding-bottom 0px vs 1px
- row-more 1 › padding-left 0px vs 6px
- row-more 2 › padding-top 0px vs 1px
- row-more 2 › padding-right 0px vs 6px
- row-more 2 › padding-bottom 0px vs 1px
- row-more 2 › padding-left 0px vs 6px

## thinking-collapsed 390x844

- control ‘智能搜索’ › x 131.02 vs 151
- control ‘智能搜索’ › y 769 vs 734.31
- sidebar > span ‘智能搜索’ › x 160.02 vs 180
- sidebar > span ‘智能搜索’ › y 774 vs 739.31
- sidebar > div @16,710 358×106 › x 16 vs 36
- sidebar > div @16,710 358×106 › y 710 vs 713.8
- sidebar > div @16,710 358×106 › w 358 vs 318
- sidebar > div @16,710 358×106 › h 106 vs 94
- sidebar > div @16,710 358×106 › background-color rgb(255, 255, 255) vs rgb(249, 250, 251)
- sidebar > div @16,710 358×106 › box-shadow rgba(0, 0, 0, 0.02) 0px 4px 10px 0px, rgba(0, 0, 0, 0.04) 0px 2px 4px 0px vs none
- sidebar > div @16,710 358×106 › border-top-left-radius 24px vs 12px
- sidebar > div @16,710 358×106 › border-top-right-radius 24px vs 12px

## scroll-up 390x844

- control ‘智能搜索’ › x 131.02 vs 151
- control ‘智能搜索’ › y 769 vs 734.31
- sidebar > span ‘智能搜索’ › x 160.02 vs 180
- sidebar > span ‘智能搜索’ › y 774 vs 739.31
- sidebar > div ‘内容由 AI 生成，请仔细甄别’ › x 16 vs 36
- sidebar > div ‘内容由 AI 生成，请仔细甄别’ › y 816 vs 809.31
- sidebar > div ‘内容由 AI 生成，请仔细甄别’ › w 358 vs 318
- sidebar > div ‘内容由 AI 生成，请仔细甄别’ › h 28 vs 18.69
- sidebar > div ‘内容由 AI 生成，请仔细甄别’ › background-color rgb(255, 255, 255) vs rgba(0, 0, 0, 0)
- sidebar > div ‘内容由 AI 生成，请仔细甄别’ › line-height 16px vs 18.7px
- sidebar > div ‘内容由 AI 生成，请仔细甄别’ › padding-top 6px vs 0px
- sidebar > div ‘内容由 AI 生成，请仔细甄别’ › padding-bottom 6px vs 0px

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

- sidebar > row 1 › h 40 vs 50
- sidebar > row 1 › background-color rgba(0, 0, 0, 0) vs rgb(228, 237, 253)
- sidebar 1 › padding-top 6px vs 12px
- sidebar 1 › padding-bottom 0px vs 12px
- sidebar > span ‘开启新对话’ › y 70 vs 76
- sidebar > span ‘开启新对话’ › box-shadow rgba(72, 104, 178, 0.04) 0px -2px 2px 0px, rgba(106, 111, 117, 0.09) 0px 2px 2px 0px, rgba vs rgba(0, 0, 0, 0.06) 0px 1px 2px 0px, rgba(15, 17, 21, 0.04) 0px 4px 12px 0px
- sidebar > span ‘智能搜索’ › x 131.02 vs 151
- sidebar > span ‘智能搜索’ › y 769 vs 734.31
- row-more 1 › w 28 vs 12
- row-more 1 › h 28 vs 12
- row-more 1 › background-color rgba(0, 0, 0, 0) vs rgb(249, 250, 251)
- row-more 1 › font-size 13px vs 14px

