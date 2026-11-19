# Style audit

Visible painted elements only. Keys are the region plus the accessible name or text. Sidebar rows align by position, and extra official chats are not missing UI. Geometry allows ±0.5px. Text-bearing elements are compared on text color and font metrics. Container inheritance is not compared.

The replaced 1920 captures are included. `search-dialog` at 1440 is the home screen with the greeting and the sidebar list, and no chat is open. The 1920 search capture has the collapsed icon rail instead of the open sidebar, which is why it has fewer elements and does not match the open-sidebar Harbor capture.

| State | Viewport | Official visible | Matched equal | Matched with diff | Official only | Harbor only | Allowlisted | Unexplained | Result |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| home-with-history | 1440x900 | 65 | 28 | 0 | 0 | 7 | 23 | 0 | PASS |
| user-menu | 1440x900 | 76 | 24 | 1 | 7 | 15 | 40 | 10 | FAIL |
| settings-general | 1440x900 | 104 | 28 | 19 | 6 | 13 | 61 | 166 | FAIL |
| settings-account | 1440x900 | 112 | 28 | 11 | 13 | 10 | 42 | 77 | FAIL |
| settings-data | 1440x900 | 100 | 28 | 16 | 5 | 10 | 50 | 133 | FAIL |
| settings-terms | 1440x900 | 90 | 28 | 11 | 6 | 15 | 42 | 82 | FAIL |
| search-dialog | 1440x900 | 71 | 35 | 0 | 0 | 6 | 24 | 0 | PASS |
| sidebar-item-menu | 1440x900 | 79 | 15 | 5 | 19 | 48 | 23 | 69 | FAIL |
| sidebar-collapsed | 1440x900 | 23 | 22 | 0 | 0 | 0 | 4 | 0 | PASS |
| answer | 1440x900 | 172 | 15 | 16 | 43 | 27 | 32 | 123 | FAIL |
| thinking-collapsed | 1440x900 | 167 | 15 | 18 | 42 | 25 | 34 | 129 | FAIL |
| scroll-up | 1440x900 | 143 | 17 | 19 | 30 | 17 | 41 | 129 | FAIL |
| sidebar-date-groups | 1440x900 | 65 | 29 | 0 | 0 | 6 | 22 | 0 | PASS |
| home-with-history | 1920x1072 | 73 | 27 | 0 | 0 | 8 | 24 | 0 | PASS |
| user-menu | 1920x1072 | 83 | 24 | 1 | 5 | 15 | 38 | 10 | FAIL |
| settings-general | 1920x1072 | 112 | 26 | 19 | 6 | 16 | 63 | 167 | FAIL |
| settings-account | 1920x1072 | 120 | 26 | 11 | 13 | 12 | 44 | 77 | FAIL |
| settings-data | 1920x1072 | 108 | 26 | 16 | 5 | 12 | 52 | 133 | FAIL |
| settings-terms | 1920x1072 | 98 | 26 | 11 | 6 | 17 | 44 | 82 | FAIL |
| search-dialog | 1920x1072 | 29 | 8 | 4 | 17 | 28 | 18 | 37 | FAIL |
| sidebar-item-menu | 1920x1072 | 87 | 13 | 5 | 17 | 50 | 24 | 68 | FAIL |
| sidebar-collapsed | 1920x1072 | 23 | 22 | 0 | 0 | 0 | 4 | 0 | PASS |
| answer | 1920x1072 | 202 | 13 | 17 | 51 | 28 | 36 | 136 | FAIL |
| thinking-collapsed | 1920x1072 | 205 | 13 | 18 | 51 | 27 | 36 | 138 | FAIL |
| scroll-up | 1920x1072 | 205 | 17 | 21 | 44 | 31 | 56 | 175 | FAIL |
| sidebar-date-groups | 1920x1072 | 73 | 27 | 0 | 0 | 8 | 24 | 0 | PASS |
| home-with-history | 390x844 | 23 | 1 | 7 | 15 | 10 | 5 | 60 | FAIL |
| user-menu | 390x844 | 94 | 3 | 17 | 24 | 23 | 57 | 98 | FAIL |
| settings-general | 390x844 | 123 | 3 | 37 | 32 | 33 | 79 | 279 | FAIL |
| settings-account | 390x844 | 131 | 3 | 26 | 47 | 25 | 63 | 174 | FAIL |
| settings-data | 390x844 | 119 | 3 | 30 | 37 | 38 | 67 | 217 | FAIL |
| settings-terms | 390x844 | 109 | 3 | 27 | 34 | 32 | 60 | 183 | FAIL |
| answer | 390x844 | 107 | 1 | 12 | 82 | 25 | 33 | 142 | FAIL |
| thinking-collapsed | 390x844 | 128 | 1 | 12 | 92 | 25 | 23 | 160 | FAIL |
| scroll-up | 390x844 | 33 | 1 | 12 | 16 | 25 | 22 | 124 | FAIL |
| mobile-drawer | 390x844 | 72 | 3 | 13 | 16 | 20 | 28 | 76 | FAIL |
| mobile-item-sheet | 390x844 | 95 | 4 | 24 | 24 | 44 | 52 | 166 | FAIL |

## home-with-history 1440x900

No unexplained diffs.

## user-menu 1440x900

- sidebar > div @12,134 236×22 › y 134 vs 146
- sidebar > div @12,134 236×22 › background-color rgb(249, 250, 251) vs rgba(0, 0, 0, 0)
- sidebar > div @12,134 236×22 › box-shadow rgb(249, 250, 251) 4px 0px 0px 0px vs none
- sidebar > div @12,134 236×22 › font-weight 500 vs 400
- sidebar > div @12,134 236×22 › padding-top 2px vs 0px
- sidebar > div @12,134 236×22 › padding-right 8px vs 0px
- sidebar > div @12,134 236×22 › padding-bottom 2px vs 0px
- sidebar > div @12,134 236×22 › padding-left 10px vs 0px
- sidebar > button @226,139 12×12 › missing div vs —
- sidebar > icon 12×12 @226,139 › missing svg vs —

## settings-general 1440x900

- main > icon 16×16 @364,320 › y 320 vs 316
- main > icon 14×14 @1065,226 › w 14 vs 16
- main > icon 14×14 @1065,226 › h 14 vs 16
- main > icon 16×16 @364,364 › y 364 vs 356
- sidebar > div @12,134 236×22 › y 134 vs 146
- sidebar > div @12,134 236×22 › background-color rgb(249, 250, 251) vs rgba(0, 0, 0, 0)
- sidebar > div @12,134 236×22 › box-shadow rgb(249, 250, 251) 4px 0px 0px 0px vs none
- sidebar > div @12,134 236×22 › font-weight 500 vs 400
- sidebar > div @12,134 236×22 › padding-top 2px vs 0px
- sidebar > div @12,134 236×22 › padding-right 8px vs 0px
- sidebar > div @12,134 236×22 › padding-bottom 2px vs 0px
- sidebar > div @12,134 236×22 › padding-left 10px vs 0px

## settings-account 1440x900

- main > icon 16×16 @364,320 › y 320 vs 316
- main > icon 14×14 @1065,226 › w 14 vs 16
- main > icon 14×14 @1065,226 › h 14 vs 16
- main > icon 16×16 @364,364 › y 364 vs 356
- sidebar > div @12,134 236×22 › y 134 vs 146
- sidebar > div @12,134 236×22 › background-color rgb(249, 250, 251) vs rgba(0, 0, 0, 0)
- sidebar > div @12,134 236×22 › box-shadow rgb(249, 250, 251) 4px 0px 0px 0px vs none
- sidebar > div @12,134 236×22 › font-weight 500 vs 400
- sidebar > div @12,134 236×22 › padding-top 2px vs 0px
- sidebar > div @12,134 236×22 › padding-right 8px vs 0px
- sidebar > div @12,134 236×22 › padding-bottom 2px vs 0px
- sidebar > div @12,134 236×22 › padding-left 10px vs 0px

## settings-data 1440x900

- main > icon 16×16 @364,320 › y 320 vs 316
- main > switch @1036,285 40×24 › x 1036 vs 1038
- main > switch @1036,285 40×24 › y 285 vs 290.98
- main > switch @1036,285 40×24 › border-top-left-radius 4096px vs 999px
- main > switch @1036,285 40×24 › border-top-right-radius 4096px vs 999px
- main > switch @1036,285 40×24 › border-bottom-right-radius 4096px vs 999px
- main > switch @1036,285 40×24 › border-bottom-left-radius 4096px vs 999px
- main > switch @1036,285 40×24 › color rgb(0, 0, 0) vs rgb(15, 17, 21)
- main > switch @1036,285 40×24 › padding-top 1px vs 0px
- main > switch @1036,285 40×24 › padding-right 6px vs 0px
- main > switch @1036,285 40×24 › padding-bottom 1px vs 0px
- main > switch @1036,285 40×24 › padding-left 6px vs 0px

## settings-terms 1440x900

- main > icon 16×16 @364,320 › y 320 vs 316
- main > icon 14×14 @1065,226 › w 14 vs 16
- main > icon 14×14 @1065,226 › h 14 vs 16
- main > icon 16×16 @364,364 › y 364 vs 356
- sidebar > div @12,134 236×22 › y 134 vs 146
- sidebar > div @12,134 236×22 › background-color rgb(249, 250, 251) vs rgba(0, 0, 0, 0)
- sidebar > div @12,134 236×22 › box-shadow rgb(249, 250, 251) 4px 0px 0px 0px vs none
- sidebar > div @12,134 236×22 › font-weight 500 vs 400
- sidebar > div @12,134 236×22 › padding-top 2px vs 0px
- sidebar > div @12,134 236×22 › padding-right 8px vs 0px
- sidebar > div @12,134 236×22 › padding-bottom 2px vs 0px
- sidebar > div @12,134 236×22 › padding-left 10px vs 0px

## search-dialog 1440x900

No unexplained diffs.

## sidebar-item-menu 1440x900

- sidebar > row 1 › h 40 vs 50
- sidebar > row 1 › background-color rgba(0, 0, 0, 0) vs rgb(228, 237, 253)
- control ‘深度思考’ › x 475.5 vs 443.5
- control ‘深度思考’ › y 462.5 vs 816.61
- control ‘智能搜索’ › x 577.52 vs 545.5
- control ‘智能搜索’ › y 462.5 vs 816.61
- main > span ‘深度思考’ › x 504.5 vs 472.5
- main > span ‘深度思考’ › y 467.5 vs 821.61
- main > span ‘智能搜索’ › x 606.52 vs 574.5
- main > span ‘智能搜索’ › y 467.5 vs 821.61
- main > icon 34×25 @709,330 › missing svg vs —
- main > span ‘欢迎回来，随时开始吧’ › missing 欢迎回来，随时开始吧 vs —

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
- main > button @1391,12 34×34 › border-top-left-radius 4096px vs 8px

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
- main > button @1391,12 34×34 › border-top-left-radius 4096px vs 8px

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
- main > button @1391,12 34×34 › border-top-left-radius 4096px vs 8px

## sidebar-date-groups 1440x900

No unexplained diffs.

## home-with-history 1920x1072

No unexplained diffs.

## user-menu 1920x1072

- sidebar > div @12,134 236×22 › y 134 vs 146
- sidebar > div @12,134 236×22 › background-color rgb(249, 250, 251) vs rgba(0, 0, 0, 0)
- sidebar > div @12,134 236×22 › box-shadow rgb(249, 250, 251) 4px 0px 0px 0px vs none
- sidebar > div @12,134 236×22 › font-weight 500 vs 400
- sidebar > div @12,134 236×22 › padding-top 2px vs 0px
- sidebar > div @12,134 236×22 › padding-right 8px vs 0px
- sidebar > div @12,134 236×22 › padding-bottom 2px vs 0px
- sidebar > div @12,134 236×22 › padding-left 10px vs 0px
- sidebar > button @226,139 12×12 › missing div vs —
- sidebar > icon 12×12 @226,139 › missing svg vs —

## settings-general 1920x1072

- main > icon 16×16 @604,406 › y 406 vs 402
- main > icon 14×14 @1305,312 › w 14 vs 16
- main > icon 14×14 @1305,312 › h 14 vs 16
- main > icon 16×16 @604,450 › y 450 vs 442
- sidebar > div @12,134 236×22 › y 134 vs 146
- sidebar > div @12,134 236×22 › background-color rgb(249, 250, 251) vs rgba(0, 0, 0, 0)
- sidebar > div @12,134 236×22 › box-shadow rgb(249, 250, 251) 4px 0px 0px 0px vs none
- sidebar > div @12,134 236×22 › font-weight 500 vs 400
- sidebar > div @12,134 236×22 › padding-top 2px vs 0px
- sidebar > div @12,134 236×22 › padding-right 8px vs 0px
- sidebar > div @12,134 236×22 › padding-bottom 2px vs 0px
- sidebar > div @12,134 236×22 › padding-left 10px vs 0px

## settings-account 1920x1072

- main > icon 16×16 @604,406 › y 406 vs 402
- main > icon 14×14 @1305,312 › w 14 vs 16
- main > icon 14×14 @1305,312 › h 14 vs 16
- main > icon 16×16 @604,450 › y 450 vs 442
- sidebar > div @12,134 236×22 › y 134 vs 146
- sidebar > div @12,134 236×22 › background-color rgb(249, 250, 251) vs rgba(0, 0, 0, 0)
- sidebar > div @12,134 236×22 › box-shadow rgb(249, 250, 251) 4px 0px 0px 0px vs none
- sidebar > div @12,134 236×22 › font-weight 500 vs 400
- sidebar > div @12,134 236×22 › padding-top 2px vs 0px
- sidebar > div @12,134 236×22 › padding-right 8px vs 0px
- sidebar > div @12,134 236×22 › padding-bottom 2px vs 0px
- sidebar > div @12,134 236×22 › padding-left 10px vs 0px

## settings-data 1920x1072

- main > icon 16×16 @604,406 › y 406 vs 402
- main > switch @1276,371 40×24 › x 1276 vs 1278
- main > switch @1276,371 40×24 › y 371 vs 376.98
- main > switch @1276,371 40×24 › border-top-left-radius 4096px vs 999px
- main > switch @1276,371 40×24 › border-top-right-radius 4096px vs 999px
- main > switch @1276,371 40×24 › border-bottom-right-radius 4096px vs 999px
- main > switch @1276,371 40×24 › border-bottom-left-radius 4096px vs 999px
- main > switch @1276,371 40×24 › color rgb(0, 0, 0) vs rgb(15, 17, 21)
- main > switch @1276,371 40×24 › padding-top 1px vs 0px
- main > switch @1276,371 40×24 › padding-right 6px vs 0px
- main > switch @1276,371 40×24 › padding-bottom 1px vs 0px
- main > switch @1276,371 40×24 › padding-left 6px vs 0px

## settings-terms 1920x1072

- main > icon 16×16 @604,406 › y 406 vs 402
- main > icon 14×14 @1305,312 › w 14 vs 16
- main > icon 14×14 @1305,312 › h 14 vs 16
- main > icon 16×16 @604,450 › y 450 vs 442
- sidebar > div @12,134 236×22 › y 134 vs 146
- sidebar > div @12,134 236×22 › background-color rgb(249, 250, 251) vs rgba(0, 0, 0, 0)
- sidebar > div @12,134 236×22 › box-shadow rgb(249, 250, 251) 4px 0px 0px 0px vs none
- sidebar > div @12,134 236×22 › font-weight 500 vs 400
- sidebar > div @12,134 236×22 › padding-top 2px vs 0px
- sidebar > div @12,134 236×22 › padding-right 8px vs 0px
- sidebar > div @12,134 236×22 › padding-bottom 2px vs 0px
- sidebar > div @12,134 236×22 › padding-left 10px vs 0px

## search-dialog 1920x1072

- control ‘深度思考’ › x 585 vs 715.5
- main > span ‘深度思考’ › x 614 vs 744.5
- main > span ‘智能搜索’ › x 716.02 vs 846.5
- main > icon 14×14 @698,559 › x 698.02 vs 726.5
- sidebar > div @59,12 114×40 › missing div vs —
- sidebar > button @63,15 34×34 › missing div vs —
- sidebar > icon 16×16 @72,24 › missing svg vs —
- sidebar > button @99,15 34×34 › missing div vs —
- sidebar > icon 16×16 @108,24 › missing svg vs —
- sidebar > button @135,15 34×34 › missing div vs —
- sidebar > icon 16×16 @144,24 › missing svg vs —
- main > icon 34×25 @782,416 › missing svg vs —

## sidebar-item-menu 1920x1072

- sidebar > row 1 › h 40 vs 50
- sidebar > row 1 › background-color rgba(0, 0, 0, 0) vs rgb(228, 237, 253)
- control ‘深度思考’ › x 715.5 vs 683.5
- control ‘深度思考’ › y 548.5 vs 988.61
- control ‘智能搜索’ › x 817.52 vs 785.5
- control ‘智能搜索’ › y 548.5 vs 988.61
- main > span ‘深度思考’ › x 744.5 vs 712.5
- main > span ‘深度思考’ › y 553.5 vs 993.61
- main > span ‘智能搜索’ › x 846.52 vs 814.5
- main > span ‘智能搜索’ › y 553.5 vs 993.61
- main > icon 34×25 @937,416 › missing svg vs —
- main > span ‘你好，我能帮什么忙吗？’ › missing 你好，我能帮什么忙吗？ vs —

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
- main > button @1871,12 34×34 › border-top-left-radius 4096px vs 8px

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
- main > button @1871,12 34×34 › border-top-left-radius 4096px vs 8px

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
- main > button @1871,12 34×34 › border-top-left-radius 4096px vs 8px

## sidebar-date-groups 1920x1072

No unexplained diffs.

## home-with-history 390x844

- control ‘深度思考’ › x 45 vs 41
- control ‘深度思考’ › y 423.5 vs 494.5
- control ‘智能搜索’ › x 147.02 vs 143
- control ‘智能搜索’ › y 423.5 vs 494.5
- sidebar > span ‘深度思考’ › x 74 vs 70
- sidebar > span ‘深度思考’ › y 428.5 vs 499.5
- sidebar > span ‘智能搜索’ › x 176.02 vs 172
- sidebar > span ‘智能搜索’ › y 428.5 vs 499.5
- sidebar > button @10,12 44×44 › x 10 vs 6
- sidebar > button @10,12 44×44 › y 12 vs 6
- sidebar > button @10,12 44×44 › border-top-left-radius 4096px vs 8px
- sidebar > button @10,12 44×44 › border-top-right-radius 4096px vs 8px

## user-menu 390x844

- control ‘深度思考’ › x 29 vs 41
- control ‘深度思考’ › y 769 vs 494.5
- sidebar 1 › padding-top 6px vs 12px
- sidebar 1 › padding-bottom 0px vs 12px
- sidebar > span ‘开启新对话’ › y 80 vs 86
- sidebar > span ‘深度思考’ › x 58 vs 70
- sidebar > span ‘深度思考’ › y 774 vs 499.5
- sidebar > span ‘智能搜索’ › x 160.02 vs 172
- sidebar > span ‘智能搜索’ › y 774 vs 499.5
- sidebar > icon 16×16 @84,82 › y 82 vs 87.5
- sidebar > button @198,25 16×16 › y 24.5 vs 30.5
- sidebar > icon 16×16 @198,25 › y 24.5 vs 30.5

## settings-general 390x844

- control ‘深度思考’ › x 29 vs 41
- control ‘深度思考’ › y 769 vs 494.5
- sidebar 1 › padding-top 6px vs 12px
- sidebar 1 › padding-bottom 0px vs 12px
- sidebar > span ‘开启新对话’ › y 80 vs 86
- sidebar > span ‘深度思考’ › x 58 vs 70
- sidebar > span ‘深度思考’ › y 774 vs 499.5
- sidebar > span ‘智能搜索’ › x 160.02 vs 172
- sidebar > span ‘智能搜索’ › y 774 vs 499.5
- sidebar > dialog @0,64 390×780 › y 64 vs 59.09
- sidebar > dialog @0,64 390×780 › h 780 vs 784.91
- sidebar > icon 16×16 @84,82 › y 82 vs 87.5

## settings-account 390x844

- control ‘深度思考’ › x 29 vs 41
- control ‘深度思考’ › y 769 vs 494.5
- sidebar 1 › padding-top 6px vs 12px
- sidebar 1 › padding-bottom 0px vs 12px
- sidebar > span ‘开启新对话’ › y 80 vs 86
- sidebar > span ‘深度思考’ › x 58 vs 70
- sidebar > span ‘深度思考’ › y 774 vs 499.5
- sidebar > span ‘智能搜索’ › x 160.02 vs 172
- sidebar > span ‘智能搜索’ › y 774 vs 499.5
- sidebar > div @24,322 342×60 › x 24 vs 22
- sidebar > div @24,322 342×60 › y 322 vs 328.88
- sidebar > div @24,322 342×60 › box-shadow rgba(0, 0, 0, 0.1) 0px 1px 0px 0px inset vs none

## settings-data 390x844

- control ‘深度思考’ › x 29 vs 41
- control ‘深度思考’ › y 769 vs 494.5
- sidebar 1 › padding-top 6px vs 12px
- sidebar 1 › padding-bottom 0px vs 12px
- sidebar > span ‘开启新对话’ › y 80 vs 86
- sidebar > span ‘深度思考’ › x 58 vs 70
- sidebar > span ‘深度思考’ › y 774 vs 499.5
- sidebar > span ‘智能搜索’ › x 160.02 vs 172
- sidebar > span ‘智能搜索’ › y 774 vs 499.5
- sidebar > div ‘我共享的链接’ › x 24 vs 22
- sidebar > div ‘我共享的链接’ › y 306 vs 308.06
- sidebar > div ‘我共享的链接’ › box-shadow rgba(0, 0, 0, 0.1) 0px 1px 0px 0px inset vs none

## settings-terms 390x844

- control ‘深度思考’ › x 29 vs 41
- control ‘深度思考’ › y 769 vs 494.5
- sidebar 1 › padding-top 6px vs 12px
- sidebar 1 › padding-bottom 0px vs 12px
- sidebar > span ‘开启新对话’ › y 80 vs 86
- sidebar > span ‘深度思考’ › x 58 vs 70
- sidebar > span ‘深度思考’ › y 774 vs 499.5
- sidebar > span ‘智能搜索’ › x 160.02 vs 172
- sidebar > span ‘智能搜索’ › y 774 vs 499.5
- sidebar > dialog @0,64 390×780 › y 64 vs 59.09
- sidebar > dialog @0,64 390×780 › h 780 vs 784.91
- sidebar > icon 16×16 @84,82 › y 82 vs 87.5

## answer 390x844

- control ‘深度思考’ › x 29 vs 41
- control ‘深度思考’ › y 769 vs 726.31
- control ‘智能搜索’ › x 131.02 vs 143
- control ‘智能搜索’ › y 769 vs 726.31
- sidebar > span ‘深度思考’ › x 58 vs 70
- sidebar > span ‘深度思考’ › y 774 vs 731.31
- sidebar > span ‘智能搜索’ › x 160.02 vs 172
- sidebar > span ‘智能搜索’ › y 774 vs 731.31
- main > span ‘)’ › x 298.13 vs 294
- main > span ‘)’ › y 118.22 vs 116
- main > span ‘)’ › font-size 13px vs 16px
- main > span ‘)’ › color rgb(56, 58, 66) vs rgb(92, 97, 102)

## thinking-collapsed 390x844

- control ‘深度思考’ › x 29 vs 41
- control ‘深度思考’ › y 769 vs 726.31
- control ‘智能搜索’ › x 131.02 vs 143
- control ‘智能搜索’ › y 769 vs 726.31
- sidebar > span ‘深度思考’ › x 58 vs 70
- sidebar > span ‘深度思考’ › y 774 vs 731.31
- sidebar > span ‘智能搜索’ › x 160.02 vs 172
- sidebar > span ‘智能搜索’ › y 774 vs 731.31
- sidebar > button @10,12 44×44 › x 10 vs 6
- sidebar > button @10,12 44×44 › y 12 vs 6
- sidebar > button @10,12 44×44 › border-top-left-radius 4096px vs 8px
- sidebar > button @10,12 44×44 › border-top-right-radius 4096px vs 8px

## scroll-up 390x844

- control ‘深度思考’ › x 29 vs 41
- control ‘深度思考’ › y 769 vs 726.31
- control ‘智能搜索’ › x 131.02 vs 143
- control ‘智能搜索’ › y 769 vs 726.31
- sidebar > span ‘深度思考’ › x 58 vs 70
- sidebar > span ‘深度思考’ › y 774 vs 731.31
- sidebar > span ‘智能搜索’ › x 160.02 vs 172
- sidebar > span ‘智能搜索’ › y 774 vs 731.31
- sidebar > button @10,12 44×44 › x 10 vs 6
- sidebar > button @10,12 44×44 › y 12 vs 6
- sidebar > button @10,12 44×44 › border-top-left-radius 4096px vs 8px
- sidebar > button @10,12 44×44 › border-top-right-radius 4096px vs 8px

## mobile-drawer 390x844

- sidebar 1 › padding-top 6px vs 12px
- sidebar 1 › padding-bottom 0px vs 12px
- sidebar > span ‘开启新对话’ › y 80 vs 86
- sidebar > icon 16×16 @84,82 › y 82 vs 87.5
- sidebar > button @198,25 16×16 › y 24.5 vs 30.5
- sidebar > icon 16×16 @198,25 › y 24.5 vs 30.5
- sidebar > button @232,25 16×16 › y 24.5 vs 30.5
- sidebar > icon 16×16 @232,25 › y 24.5 vs 30.5
- sidebar > div @12,70 236×40 › y 70 vs 76
- sidebar > div @12,70 236×40 › box-shadow rgba(72, 104, 178, 0.04) 0px -2px 2px 0px, rgba(106, 111, 117, 0.09) 0px 2px 2px 0px, rgba vs rgba(0, 0, 0, 0.06) 0px 1px 2px 0px, rgba(15, 17, 21, 0.04) 0px 4px 12px 0px
- sidebar > button @10,12 44×44 › x 10 vs 6
- sidebar > button @10,12 44×44 › y 12 vs 6

## mobile-item-sheet 390x844

- sidebar > row 1 › h 40 vs 50
- sidebar > row 1 › background-color rgba(0, 0, 0, 0) vs rgb(228, 237, 253)
- sidebar > row 2 › x 12 vs 36
- sidebar > row 2 › border-top-left-radius 12px vs 0px
- sidebar > row 2 › border-top-right-radius 12px vs 0px
- sidebar > row 2 › border-bottom-right-radius 12px vs 0px
- sidebar > row 2 › border-bottom-left-radius 12px vs 0px
- sidebar > row 2 › padding-top 9px vs 8px
- sidebar > row 2 › padding-right 6px vs 0px
- sidebar > row 2 › padding-bottom 9px vs 8px
- sidebar > row 2 › padding-left 10px vs 0px
- control ‘深度思考’ › x 29 vs 41

