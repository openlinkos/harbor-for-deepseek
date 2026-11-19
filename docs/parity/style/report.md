# Style audit

Visible painted elements only. Keys are the region plus the accessible name or text. Sidebar rows align by position, and extra official chats are not missing UI. Geometry allows ±0.5px. A text box may differ by 1px in width, height, or line-height when its font size, weight, and color already match. Container inheritance is not compared.

The replaced 1920 captures are included. `search-dialog` at 1440 is the home screen with the greeting and the open sidebar, and no chat is open. The 1920 search file was captured with the sidebar collapsed, so Harbor collapses the sidebar before opening search at that width.

| State | Viewport | Official visible | Matched equal | Matched with diff | Official only | Harbor only | Allowlisted | Unexplained | Result |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| home-with-history | 1440x900 | 65 | 28 | 0 | 0 | 6 | 20 | 0 | PASS |
| user-menu | 1440x900 | 76 | 28 | 0 | 5 | 9 | 29 | 0 | PASS |
| settings-general | 1440x900 | 104 | 52 | 0 | 0 | 6 | 19 | 0 | PASS |
| settings-account | 1440x900 | 112 | 38 | 2 | 12 | 9 | 19 | 27 | FAIL |
| settings-data | 1440x900 | 100 | 38 | 9 | 6 | 7 | 19 | 40 | FAIL |
| settings-terms | 1440x900 | 90 | 39 | 2 | 4 | 12 | 19 | 17 | FAIL |
| search-dialog | 1440x900 | 71 | 34 | 0 | 0 | 6 | 19 | 0 | PASS |
| sidebar-item-menu | 1440x900 | 79 | 40 | 0 | 0 | 6 | 19 | 0 | PASS |
| sidebar-collapsed | 1440x900 | 23 | 22 | 0 | 0 | 0 | 0 | 0 | PASS |
| answer | 1440x900 | 172 | 14 | 16 | 45 | 27 | 21 | 133 | FAIL |
| thinking-collapsed | 1440x900 | 167 | 14 | 18 | 44 | 25 | 21 | 141 | FAIL |
| scroll-up | 1440x900 | 143 | 16 | 19 | 32 | 17 | 20 | 149 | FAIL |
| sidebar-date-groups | 1440x900 | 65 | 28 | 0 | 0 | 6 | 19 | 0 | PASS |
| home-with-history | 1920x1072 | 73 | 28 | 0 | 0 | 6 | 19 | 0 | PASS |
| user-menu | 1920x1072 | 83 | 28 | 0 | 3 | 9 | 27 | 0 | PASS |
| settings-general | 1920x1072 | 112 | 52 | 0 | 0 | 6 | 19 | 0 | PASS |
| settings-account | 1920x1072 | 120 | 38 | 2 | 12 | 9 | 19 | 27 | FAIL |
| settings-data | 1920x1072 | 108 | 38 | 9 | 6 | 7 | 19 | 40 | FAIL |
| settings-terms | 1920x1072 | 98 | 39 | 2 | 4 | 12 | 19 | 17 | FAIL |
| search-dialog | 1920x1072 | 29 | 28 | 0 | 0 | 0 | 0 | 0 | PASS |
| sidebar-item-menu | 1920x1072 | 87 | 40 | 0 | 0 | 6 | 19 | 0 | PASS |
| sidebar-collapsed | 1920x1072 | 23 | 22 | 0 | 0 | 0 | 0 | 0 | PASS |
| answer | 1920x1072 | 202 | 14 | 17 | 53 | 26 | 20 | 149 | FAIL |
| thinking-collapsed | 1920x1072 | 205 | 14 | 18 | 53 | 25 | 21 | 150 | FAIL |
| scroll-up | 1920x1072 | 205 | 18 | 21 | 46 | 29 | 21 | 207 | FAIL |
| sidebar-date-groups | 1920x1072 | 73 | 28 | 0 | 0 | 6 | 19 | 0 | PASS |
| home-with-history | 390x844 | 23 | 3 | 5 | 13 | 9 | 4 | 53 | FAIL |
| user-menu | 390x844 | 94 | 7 | 16 | 24 | 15 | 41 | 116 | FAIL |
| settings-general | 390x844 | 123 | 9 | 27 | 41 | 25 | 34 | 180 | FAIL |
| settings-account | 390x844 | 131 | 7 | 26 | 44 | 20 | 37 | 179 | FAIL |
| settings-data | 390x844 | 119 | 7 | 27 | 42 | 36 | 34 | 185 | FAIL |
| settings-terms | 390x844 | 109 | 8 | 25 | 35 | 22 | 34 | 165 | FAIL |
| answer | 390x844 | 107 | 3 | 13 | 77 | 18 | 21 | 159 | FAIL |
| thinking-collapsed | 390x844 | 128 | 1 | 13 | 57 | 20 | 16 | 136 | FAIL |
| scroll-up | 390x844 | 33 | 2 | 10 | 16 | 26 | 13 | 128 | FAIL |
| mobile-drawer | 390x844 | 72 | 7 | 12 | 13 | 16 | 23 | 83 | FAIL |
| mobile-item-sheet | 390x844 | 95 | 15 | 21 | 21 | 33 | 38 | 154 | FAIL |

## home-with-history 1440x900

No unexplained diffs.

## user-menu 1440x900

No unexplained diffs.

## settings-general 1440x900

No unexplained diffs.

## settings-account 1440x900

- main > div @560,374 516×60 › y 374 vs 387.98
- main > div @560,374 516×60 › h 60 vs 47.59
- main > div @560,374 516×60 › box-shadow rgba(0, 0, 0, 0.1) 0px 1px 0px 0px inset vs none
- main > div @560,374 516×60 › line-height 22px vs 23.8px
- main > div @560,374 516×60 › padding-top 12px vs 0px
- main > div @560,374 516×60 › padding-bottom 12px vs 0px
- main > div ‘手机号码’ › y 314 vs 330.39
- main > div ‘手机号码’ › h 60 vs 47.59
- main > div ‘手机号码’ › box-shadow rgba(0, 0, 0, 0.1) 0px 1px 0px 0px inset vs none
- main > div ‘手机号码’ › line-height 22px vs 23.8px
- main > div ‘手机号码’ › padding-top 12px vs 0px
- main > div ‘手机号码’ › padding-bottom 12px vs 0px

## settings-data 1440x900

- main > span ‘管理’ › x 1026 vs 1048
- main > span ‘管理’ › y 359 vs 343
- main > span ‘导出’ › x 1026 vs 1048
- main > span ‘导出’ › y 432 vs 403
- main > span ‘删除’ › box-shadow none vs rgb(242, 90, 90) 0px 0px 0px 1px inset
- main > span ‘删除’ › color rgb(236, 19, 19) vs rgb(242, 90, 90)
- main > switch @1036,285 40×24 › y 285 vs 283
- main > switch @1036,285 40×24 › h 24 vs 22
- main > switch @1036,285 40×24 › border-top-left-radius 4096px vs 999px
- main > switch @1036,285 40×24 › border-top-right-radius 4096px vs 999px
- main > switch @1036,285 40×24 › border-bottom-right-radius 4096px vs 999px
- main > switch @1036,285 40×24 › border-bottom-left-radius 4096px vs 999px

## settings-terms 1440x900

- main > span ‘查看’ › x 1026 vs 1048
- main > span ‘查看’ › y 273 vs 283
- main > span ‘查看’ › color rgb(15, 17, 21) vs rgb(57, 100, 254)
- main > span ‘查看’ › x 1026 vs 1048
- main > span ‘查看’ › y 333 vs 343
- main > span ‘查看’ › color rgb(15, 17, 21) vs rgb(57, 100, 254)
- main > div ‘隐私政策’ › y 314 vs 324
- main > button @1004,266 72×36 › missing a vs —
- main > div @1004,266 72×36 › missing div vs —
- main > button @1004,326 72×36 › missing a vs —
- main > div @1004,326 72×36 › missing div vs —
- main > contentinfo @560,388 516×64 › missing — vs footer

## search-dialog 1440x900

No unexplained diffs.

## sidebar-item-menu 1440x900

No unexplained diffs.

## sidebar-collapsed 1440x900

No unexplained diffs.

## answer 1440x900

- sidebar > row 1 › background-color rgba(0, 0, 0, 0) vs rgb(228, 237, 253)
- control ‘深度思考’ › x 475.5 vs 443.5
- control ‘深度思考’ › y 825 vs 816.61
- control ‘智能搜索’ › x 577.52 vs 545.5
- control ‘智能搜索’ › y 825 vs 816.61
- main > span ‘深度思考’ › x 504.5 vs 472.5
- main > span ‘深度思考’ › y 830 vs 821.61
- main > span ‘智能搜索’ › x 606.52 vs 574.5
- main > span ‘智能搜索’ › y 830 vs 821.61
- main > button @1391,12 34×34 › x 1391 vs 1392
- main > button @1391,12 34×34 › y 12 vs 10
- main > button @1391,12 34×34 › w 34 vs 32

## thinking-collapsed 1440x900

- sidebar > row 1 › background-color rgba(0, 0, 0, 0) vs rgb(228, 237, 253)
- control ‘深度思考’ › x 475.5 vs 443.5
- control ‘深度思考’ › y 825 vs 816.61
- control ‘智能搜索’ › x 577.52 vs 545.5
- control ‘智能搜索’ › y 825 vs 816.61
- main > span ‘深度思考’ › x 504.5 vs 472.5
- main > span ‘深度思考’ › y 830 vs 821.61
- main > span ‘智能搜索’ › x 606.52 vs 574.5
- main > span ‘智能搜索’ › y 830 vs 821.61
- main > button @1391,12 34×34 › x 1391 vs 1392
- main > button @1391,12 34×34 › y 12 vs 10
- main > button @1391,12 34×34 › w 34 vs 32

## scroll-up 1440x900

- sidebar > row 1 › background-color rgba(0, 0, 0, 0) vs rgb(228, 237, 253)
- control ‘深度思考’ › x 475.5 vs 443.5
- control ‘深度思考’ › y 825 vs 816.61
- control ‘智能搜索’ › x 577.52 vs 545.5
- control ‘智能搜索’ › y 825 vs 816.61
- main > span ‘深度思考’ › x 504.5 vs 472.5
- main > span ‘深度思考’ › y 830 vs 821.61
- main > span ‘智能搜索’ › x 606.52 vs 574.5
- main > span ‘智能搜索’ › y 830 vs 821.61
- main > button @1391,12 34×34 › x 1391 vs 1392
- main > button @1391,12 34×34 › y 12 vs 10
- main > button @1391,12 34×34 › w 34 vs 32

## sidebar-date-groups 1440x900

No unexplained diffs.

## home-with-history 1920x1072

No unexplained diffs.

## user-menu 1920x1072

No unexplained diffs.

## settings-general 1920x1072

No unexplained diffs.

## settings-account 1920x1072

- main > div @800,460 516×60 › y 460 vs 473.98
- main > div @800,460 516×60 › h 60 vs 47.59
- main > div @800,460 516×60 › box-shadow rgba(0, 0, 0, 0.1) 0px 1px 0px 0px inset vs none
- main > div @800,460 516×60 › line-height 22px vs 23.8px
- main > div @800,460 516×60 › padding-top 12px vs 0px
- main > div @800,460 516×60 › padding-bottom 12px vs 0px
- main > div ‘手机号码’ › y 400 vs 416.39
- main > div ‘手机号码’ › h 60 vs 47.59
- main > div ‘手机号码’ › box-shadow rgba(0, 0, 0, 0.1) 0px 1px 0px 0px inset vs none
- main > div ‘手机号码’ › line-height 22px vs 23.8px
- main > div ‘手机号码’ › padding-top 12px vs 0px
- main > div ‘手机号码’ › padding-bottom 12px vs 0px

## settings-data 1920x1072

- main > span ‘管理’ › x 1266 vs 1288
- main > span ‘管理’ › y 445 vs 429
- main > span ‘导出’ › x 1266 vs 1288
- main > span ‘导出’ › y 518 vs 489
- main > span ‘删除’ › box-shadow none vs rgb(242, 90, 90) 0px 0px 0px 1px inset
- main > span ‘删除’ › color rgb(236, 19, 19) vs rgb(242, 90, 90)
- main > switch @1276,371 40×24 › y 371 vs 369
- main > switch @1276,371 40×24 › h 24 vs 22
- main > switch @1276,371 40×24 › border-top-left-radius 4096px vs 999px
- main > switch @1276,371 40×24 › border-top-right-radius 4096px vs 999px
- main > switch @1276,371 40×24 › border-bottom-right-radius 4096px vs 999px
- main > switch @1276,371 40×24 › border-bottom-left-radius 4096px vs 999px

## settings-terms 1920x1072

- main > span ‘查看’ › x 1266 vs 1288
- main > span ‘查看’ › y 359 vs 369
- main > span ‘查看’ › color rgb(15, 17, 21) vs rgb(57, 100, 254)
- main > span ‘查看’ › x 1266 vs 1288
- main > span ‘查看’ › y 419 vs 429
- main > span ‘查看’ › color rgb(15, 17, 21) vs rgb(57, 100, 254)
- main > div ‘隐私政策’ › y 400 vs 410
- main > button @1244,352 72×36 › missing a vs —
- main > div @1244,352 72×36 › missing div vs —
- main > button @1244,412 72×36 › missing a vs —
- main > div @1244,412 72×36 › missing div vs —
- main > contentinfo @800,474 516×64 › missing — vs footer

## search-dialog 1920x1072

No unexplained diffs.

## sidebar-item-menu 1920x1072

No unexplained diffs.

## sidebar-collapsed 1920x1072

No unexplained diffs.

## answer 1920x1072

- sidebar > row 1 › background-color rgba(0, 0, 0, 0) vs rgb(228, 237, 253)
- control ‘深度思考’ › x 715.5 vs 683.5
- control ‘深度思考’ › y 997 vs 988.61
- control ‘智能搜索’ › x 817.52 vs 785.5
- control ‘智能搜索’ › y 997 vs 988.61
- main > span ‘深度思考’ › x 744.5 vs 712.5
- main > span ‘深度思考’ › y 1002 vs 993.61
- main > span ‘智能搜索’ › x 846.52 vs 814.5
- main > span ‘智能搜索’ › y 1002 vs 993.61
- main > button @1871,12 34×34 › x 1871 vs 1872
- main > button @1871,12 34×34 › y 12 vs 10
- main > button @1871,12 34×34 › w 34 vs 32

## thinking-collapsed 1920x1072

- sidebar > row 1 › background-color rgba(0, 0, 0, 0) vs rgb(228, 237, 253)
- control ‘深度思考’ › x 715.5 vs 683.5
- control ‘深度思考’ › y 997 vs 988.61
- control ‘智能搜索’ › x 817.52 vs 785.5
- control ‘智能搜索’ › y 997 vs 988.61
- main > span ‘深度思考’ › x 744.5 vs 712.5
- main > span ‘深度思考’ › y 1002 vs 993.61
- main > span ‘智能搜索’ › x 846.52 vs 814.5
- main > span ‘智能搜索’ › y 1002 vs 993.61
- main > button @1871,12 34×34 › x 1871 vs 1872
- main > button @1871,12 34×34 › y 12 vs 10
- main > button @1871,12 34×34 › w 34 vs 32

## scroll-up 1920x1072

- sidebar > row 1 › background-color rgba(0, 0, 0, 0) vs rgb(228, 237, 253)
- control ‘深度思考’ › x 715.5 vs 683.5
- control ‘深度思考’ › y 997 vs 988.61
- control ‘智能搜索’ › x 817.52 vs 785.5
- control ‘智能搜索’ › y 997 vs 988.61
- main > span ‘深度思考’ › x 744.5 vs 712.5
- main > span ‘深度思考’ › y 1002 vs 993.61
- main > span ‘智能搜索’ › x 846.52 vs 814.5
- main > span ‘智能搜索’ › y 1002 vs 993.61
- main > button @1871,12 34×34 › x 1871 vs 1872
- main > button @1871,12 34×34 › y 12 vs 10
- main > button @1871,12 34×34 › w 34 vs 32

## sidebar-date-groups 1920x1072

No unexplained diffs.

## home-with-history 390x844

- control ‘智能搜索’ › x 147.02 vs 143
- control ‘智能搜索’ › y 423.5 vs 494.5
- sidebar > span ‘智能搜索’ › x 176.02 vs 172
- sidebar > span ‘智能搜索’ › y 428.5 vs 499.5
- sidebar > button @10,12 44×44 › x 10 vs 6
- sidebar > button @10,12 44×44 › y 12 vs 6
- sidebar > button @10,12 44×44 › border-top-left-radius 4096px vs 8px
- sidebar > button @10,12 44×44 › border-top-right-radius 4096px vs 8px
- sidebar > button @10,12 44×44 › border-bottom-right-radius 4096px vs 8px
- sidebar > button @10,12 44×44 › border-bottom-left-radius 4096px vs 8px
- sidebar > button @10,12 44×44 › padding-top 0px vs 1px
- sidebar > button @10,12 44×44 › padding-right 0px vs 6px

## user-menu 390x844

- sidebar 1 › padding-top 6px vs 12px
- sidebar 1 › padding-bottom 0px vs 12px
- sidebar > span ‘开启新对话’ › y 70 vs 76
- sidebar > span ‘开启新对话’ › box-shadow rgba(72, 104, 178, 0.04) 0px -2px 2px 0px, rgba(106, 111, 117, 0.09) 0px 2px 2px 0px, rgba vs rgba(0, 0, 0, 0.06) 0px 1px 2px 0px, rgba(15, 17, 21, 0.04) 0px 4px 12px 0px
- sidebar > span ‘智能搜索’ › x 131.02 vs 143
- sidebar > span ‘智能搜索’ › y 769 vs 494.5
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
- sidebar > span ‘智能搜索’ › x 131.02 vs 143
- sidebar > span ‘智能搜索’ › y 769 vs 494.5
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
- sidebar > span ‘智能搜索’ › x 131.02 vs 143
- sidebar > span ‘智能搜索’ › y 769 vs 494.5
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
- sidebar > span ‘智能搜索’ › x 131.02 vs 143
- sidebar > span ‘智能搜索’ › y 769 vs 494.5
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
- sidebar > span ‘智能搜索’ › x 131.02 vs 143
- sidebar > span ‘智能搜索’ › y 769 vs 494.5
- sidebar > span ‘通用设置’ › x -78 vs -22
- sidebar > span ‘通用设置’ › y 128 vs 113.09
- sidebar > span ‘通用设置’ › w 108 vs 98
- sidebar > span ‘账号管理’ › x 34 vs 80
- sidebar > span ‘账号管理’ › y 128 vs 113.09
- sidebar > span ‘账号管理’ › w 108 vs 98

## answer 390x844

- control ‘智能搜索’ › x 131.02 vs 143
- control ‘智能搜索’ › y 769 vs 726.31
- sidebar > span ‘智能搜索’ › x 160.02 vs 172
- sidebar > span ‘智能搜索’ › y 774 vs 731.31
- row-more 1 › border-top-left-radius 4096px vs 50%
- row-more 1 › border-top-right-radius 4096px vs 50%
- row-more 1 › border-bottom-right-radius 4096px vs 50%
- row-more 1 › border-bottom-left-radius 4096px vs 50%
- row-more 1 › font-size 13px vs 16px
- row-more 1 › line-height 20px vs 27.2px
- row-more 1 › padding-top 0px vs 1px
- row-more 1 › padding-right 0px vs 6px

## thinking-collapsed 390x844

- control ‘智能搜索’ › x 131.02 vs 143
- control ‘智能搜索’ › y 769 vs 726.31
- sidebar > span ‘智能搜索’ › x 160.02 vs 172
- sidebar > span ‘智能搜索’ › y 774 vs 731.31
- row-more 1 › w 34 vs 28
- row-more 1 › h 34 vs 28
- row-more 1 › border-top-left-radius 4096px vs 50%
- row-more 1 › border-top-right-radius 4096px vs 50%
- row-more 1 › border-bottom-right-radius 4096px vs 50%
- row-more 1 › border-bottom-left-radius 4096px vs 50%
- row-more 1 › font-size 14px vs 16px
- row-more 1 › line-height 22px vs 27.2px

## scroll-up 390x844

- control ‘智能搜索’ › x 131.02 vs 143
- control ‘智能搜索’ › y 769 vs 726.31
- sidebar > span ‘智能搜索’ › x 160.02 vs 172
- sidebar > span ‘智能搜索’ › y 774 vs 731.31
- sidebar > button @10,12 44×44 › x 10 vs 6
- sidebar > button @10,12 44×44 › y 12 vs 6
- sidebar > button @10,12 44×44 › border-top-left-radius 4096px vs 8px
- sidebar > button @10,12 44×44 › border-top-right-radius 4096px vs 8px
- sidebar > button @10,12 44×44 › border-bottom-right-radius 4096px vs 8px
- sidebar > button @10,12 44×44 › border-bottom-left-radius 4096px vs 8px
- sidebar > button @10,12 44×44 › padding-top 0px vs 1px
- sidebar > button @10,12 44×44 › padding-right 0px vs 6px

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
- sidebar > row 2 › x 12 vs 36
- sidebar > row 2 › w 236 vs 170
- sidebar > row 2 › border-top-left-radius 12px vs 0px
- sidebar > row 2 › border-top-right-radius 12px vs 0px
- sidebar > row 2 › border-bottom-right-radius 12px vs 0px
- sidebar > row 2 › border-bottom-left-radius 12px vs 0px
- sidebar > row 2 › line-height 22px vs 23.8px
- sidebar > row 2 › padding-top 9px vs 8px
- sidebar > row 2 › padding-right 6px vs 0px
- sidebar > row 2 › padding-bottom 9px vs 8px

