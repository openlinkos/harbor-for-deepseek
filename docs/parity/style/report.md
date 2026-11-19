# Style audit

Visible painted elements only. Keys are the region plus the accessible name or text. Sidebar rows align by position, and extra official chats are not missing UI. Geometry allows ±0.5px. Text-bearing elements are compared on text color and font metrics. Container inheritance is not compared.

Nine 1920 captures still show the open 「定时器解释」 answer instead of the home screen. They are listed and skipped until they are recaptured: `search-dialog`, `settings-general`, `settings-account`, `settings-data`, `settings-terms`, `user-menu`, `sidebar-item-menu`, `sidebar-date-groups`, `sidebar-collapsed`.

| State | Viewport | Official visible | Matched equal | Matched with diff | Official only | Harbor only | Allowlisted | Unexplained | Result |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| home-with-history | 1440x900 | 62 | 3 | 21 | 5 | 15 | 18 | 87 | FAIL |
| user-menu | 1440x900 | 73 | 3 | 18 | 12 | 15 | 15 | 78 | FAIL |
| settings-general | 1440x900 | 96 | 3 | 37 | 14 | 23 | 17 | 221 | FAIL |
| settings-account | 1440x900 | 100 | 3 | 30 | 12 | 20 | 17 | 135 | FAIL |
| settings-data | 1440x900 | 91 | 3 | 34 | 9 | 21 | 17 | 209 | FAIL |
| settings-terms | 1440x900 | 84 | 3 | 29 | 12 | 26 | 17 | 136 | FAIL |
| search-dialog | 1440x900 | 68 | 3 | 21 | 11 | 16 | 17 | 76 | FAIL |
| sidebar-item-menu | 1440x900 | 75 | 2 | 14 | 23 | 55 | 17 | 125 | FAIL |
| sidebar-collapsed | 1440x900 | 19 | 2 | 13 | 4 | 21 | 11 | 51 | FAIL |
| answer | 1440x900 | 156 | 2 | 21 | 40 | 38 | 18 | 162 | FAIL |
| thinking-collapsed | 1440x900 | 154 | 2 | 23 | 42 | 36 | 17 | 174 | FAIL |
| scroll-up | 1440x900 | 132 | 4 | 25 | 32 | 27 | 17 | 184 | FAIL |
| sidebar-date-groups | 1440x900 | 62 | 3 | 22 | 5 | 14 | 17 | 89 | FAIL |
| home-with-history | 1920x1072 | 70 | 2 | 21 | 5 | 16 | 19 | 85 | FAIL |
| user-menu | 1920x1072 | 200 | 2 | 14 | 59 | 20 | 17 | — | skip |
| settings-general | 1920x1072 | 224 | 2 | 31 | 63 | 31 | 21 | — | skip |
| settings-account | 1920x1072 | 228 | 2 | 24 | 61 | 27 | 21 | — | skip |
| settings-data | 1920x1072 | 219 | 2 | 28 | 58 | 28 | 21 | — | skip |
| settings-terms | 1920x1072 | 212 | 2 | 23 | 61 | 33 | 21 | — | skip |
| search-dialog | 1920x1072 | 196 | 2 | 15 | 60 | 23 | 21 | — | skip |
| sidebar-item-menu | 1920x1072 | 202 | 2 | 21 | 56 | 50 | 20 | — | skip |
| sidebar-collapsed | 1920x1072 | 138 | 1 | 9 | 53 | 26 | 13 | — | skip |
| answer | 1920x1072 | 184 | 2 | 20 | 47 | 39 | 19 | 173 | FAIL |
| thinking-collapsed | 1920x1072 | 190 | 2 | 22 | 48 | 37 | 20 | 176 | FAIL |
| scroll-up | 1920x1072 | 190 | 6 | 25 | 41 | 41 | 20 | 233 | FAIL |
| sidebar-date-groups | 1920x1072 | 190 | 2 | 16 | 54 | 21 | 21 | — | skip |
| home-with-history | 390x844 | 19 | 1 | 5 | 13 | 13 | 4 | 38 | FAIL |
| user-menu | 390x844 | 88 | 2 | 14 | 25 | 24 | 18 | 120 | FAIL |
| settings-general | 390x844 | 111 | 3 | 31 | 35 | 43 | 21 | 292 | FAIL |
| settings-account | 390x844 | 115 | 3 | 24 | 38 | 27 | 12 | 205 | FAIL |
| settings-data | 390x844 | 106 | 3 | 24 | 36 | 50 | 21 | 264 | FAIL |
| settings-terms | 390x844 | 99 | 3 | 21 | 34 | 43 | 21 | 195 | FAIL |
| answer | 390x844 | 96 | 1 | 10 | 74 | 29 | 4 | 143 | FAIL |
| thinking-collapsed | 390x844 | 120 | 1 | 10 | 87 | 28 | 4 | 153 | FAIL |
| scroll-up | 390x844 | 29 | 1 | 10 | 16 | 28 | 4 | 121 | FAIL |
| mobile-drawer | 390x844 | 67 | 2 | 10 | 17 | 27 | 22 | 77 | FAIL |
| mobile-item-sheet | 390x844 | 89 | 2 | 22 | 25 | 54 | 23 | 213 | FAIL |

## home-with-history 1440x900

- sidebar > group 1 › x 12 vs 22
- sidebar > group 1 › w 236 vs 24
- sidebar > group 1 › h 22 vs 18
- sidebar > group 1 › background-color rgb(249, 250, 251) vs rgba(0, 0, 0, 0)
- sidebar > group 1 › box-shadow rgb(249, 250, 251) 4px 0px 0px 0px vs none
- sidebar > group 1 › padding-top 2px vs 0px
- sidebar > group 1 › padding-right 10px vs 0px
- sidebar > group 1 › padding-bottom 2px vs 0px
- sidebar > group 1 › padding-left 10px vs 0px
- control ‘深度思考’ › x 475.5 vs 471.5
- control ‘深度思考’ › y 462.5 vs 460
- main > greeting 1 › x 728.5 vs 713.5
- main > greeting 1 › y 326.5 vs 337
- main > greeting 1 › w 288 vs 312
- sidebar > span ‘开启新对话’ › x 106 vs 83
- sidebar > span ‘开启新对话’ › w 70 vs 94
- sidebar > span ‘开启新对话’ › h 20 vs 19
- main > span ‘深度思考’ › x 504.5 vs 500.5
- main > span ‘深度思考’ › y 467.5 vs 465
- main > span ‘智能搜索’ › x 606.52 vs 600.5

## user-menu 1440x900

- sidebar > row 1 › h 40 vs 50.09
- sidebar > row 1 › border-top-left-radius 12px vs 0px
- sidebar > row 1 › border-top-right-radius 12px vs 0px
- sidebar > row 1 › border-bottom-right-radius 12px vs 0px
- sidebar > row 1 › border-bottom-left-radius 12px vs 0px
- sidebar > row 1 › font-size 14px vs 16px
- sidebar > row 1 › line-height 22px vs 27.2px
- sidebar > row 1 › padding-top 9px vs 6px
- sidebar > row 1 › padding-right 6px vs 4px
- sidebar > row 1 › padding-bottom 9px vs 6px
- sidebar > row 1 › padding-left 10px vs 4px
- control ‘深度思考’ › x 475.5 vs 471.5
- control ‘深度思考’ › y 462.5 vs 460
- main > greeting 1 › x 752.5 vs 737.5
- main > greeting 1 › y 326.5 vs 337
- main > greeting 1 › w 240 vs 264
- sidebar > span ‘开启新对话’ › x 106 vs 83
- sidebar > span ‘开启新对话’ › w 70 vs 94
- sidebar > span ‘开启新对话’ › h 20 vs 19
- main > span ‘深度思考’ › x 504.5 vs 500.5

## settings-general 1440x900

- control ‘深度思考’ › x 475.5 vs 471.5
- control ‘深度思考’ › y 462.5 vs 460
- main > greeting 1 › x 752.5 vs 737.5
- main > greeting 1 › y 326.5 vs 337
- main > greeting 1 › w 240 vs 264
- sidebar > span ‘开启新对话’ › x 106 vs 83
- sidebar > span ‘开启新对话’ › w 70 vs 94
- sidebar > span ‘开启新对话’ › h 20 vs 19
- main > span ‘深度思考’ › x 504.5 vs 500.5
- main > span ‘深度思考’ › y 467.5 vs 465
- main > span ‘智能搜索’ › x 606.52 vs 600.5
- main > span ‘智能搜索’ › y 467.5 vs 465
- sidebar > div @0,0 1440×900 › background-color rgba(0, 0, 0, 0.36) vs rgb(255, 255, 255)
- main > dialog @340,200 760×500 › box-shadow rgba(0, 0, 0, 0) 0px 0px 0px 1px inset, rgba(0, 0, 0, 0.2) 0px 0px 1px 0px, rgba(0, 0, 0,  vs rgba(0, 0, 0, 0.2) 0px 0px 1px 0px, rgba(0, 0, 0, 0.02) 0px 0px 4px 0px, rgba(0, 0, 0, 0.0
- main > dialog @340,200 760×500 › border-top-left-radius 24px vs 16px
- main > dialog @340,200 760×500 › border-top-right-radius 24px vs 16px
- main > dialog @340,200 760×500 › border-bottom-right-radius 24px vs 16px
- main > dialog @340,200 760×500 › border-bottom-left-radius 24px vs 16px
- sidebar > div @12,134 236×22 › h 22 vs 20.39
- sidebar > div @12,134 236×22 › background-color rgb(249, 250, 251) vs rgba(0, 0, 0, 0)

## settings-account 1440x900

- control ‘深度思考’ › x 475.5 vs 471.5
- control ‘深度思考’ › y 462.5 vs 460
- main > greeting 1 › x 752.5 vs 737.5
- main > greeting 1 › y 326.5 vs 337
- main > greeting 1 › w 240 vs 264
- sidebar > span ‘开启新对话’ › x 106 vs 83
- sidebar > span ‘开启新对话’ › w 70 vs 94
- sidebar > span ‘开启新对话’ › h 20 vs 19
- main > span ‘深度思考’ › x 504.5 vs 500.5
- main > span ‘深度思考’ › y 467.5 vs 465
- main > span ‘智能搜索’ › x 606.52 vs 600.5
- main > span ‘智能搜索’ › y 467.5 vs 465
- sidebar > div @0,0 1440×900 › background-color rgba(0, 0, 0, 0.36) vs rgb(255, 255, 255)
- main > dialog @340,200 760×500 › box-shadow rgba(0, 0, 0, 0) 0px 0px 0px 1px inset, rgba(0, 0, 0, 0.2) 0px 0px 1px 0px, rgba(0, 0, 0,  vs rgba(0, 0, 0, 0.2) 0px 0px 1px 0px, rgba(0, 0, 0, 0.02) 0px 0px 4px 0px, rgba(0, 0, 0, 0.0
- main > dialog @340,200 760×500 › border-top-left-radius 24px vs 16px
- main > dialog @340,200 760×500 › border-top-right-radius 24px vs 16px
- main > dialog @340,200 760×500 › border-bottom-right-radius 24px vs 16px
- main > dialog @340,200 760×500 › border-bottom-left-radius 24px vs 16px
- sidebar > div @12,134 236×22 › h 22 vs 20.39
- sidebar > div @12,134 236×22 › background-color rgb(249, 250, 251) vs rgba(0, 0, 0, 0)

## settings-data 1440x900

- control ‘深度思考’ › x 475.5 vs 471.5
- control ‘深度思考’ › y 462.5 vs 460
- main > greeting 1 › x 752.5 vs 737.5
- main > greeting 1 › y 326.5 vs 337
- main > greeting 1 › w 240 vs 264
- sidebar > span ‘开启新对话’ › x 106 vs 83
- sidebar > span ‘开启新对话’ › w 70 vs 94
- sidebar > span ‘开启新对话’ › h 20 vs 19
- main > span ‘深度思考’ › x 504.5 vs 500.5
- main > span ‘深度思考’ › y 467.5 vs 465
- main > span ‘智能搜索’ › x 606.52 vs 600.5
- main > span ‘智能搜索’ › y 467.5 vs 465
- sidebar > div @0,0 1440×900 › background-color rgba(0, 0, 0, 0.36) vs rgb(255, 255, 255)
- main > dialog @340,200 760×500 › box-shadow rgba(0, 0, 0, 0) 0px 0px 0px 1px inset, rgba(0, 0, 0, 0.2) 0px 0px 1px 0px, rgba(0, 0, 0,  vs rgba(0, 0, 0, 0.2) 0px 0px 1px 0px, rgba(0, 0, 0, 0.02) 0px 0px 4px 0px, rgba(0, 0, 0, 0.0
- main > dialog @340,200 760×500 › border-top-left-radius 24px vs 16px
- main > dialog @340,200 760×500 › border-top-right-radius 24px vs 16px
- main > dialog @340,200 760×500 › border-bottom-right-radius 24px vs 16px
- main > dialog @340,200 760×500 › border-bottom-left-radius 24px vs 16px
- sidebar > div @12,134 236×22 › h 22 vs 20.39
- sidebar > div @12,134 236×22 › background-color rgb(249, 250, 251) vs rgba(0, 0, 0, 0)

## settings-terms 1440x900

- control ‘深度思考’ › x 475.5 vs 471.5
- control ‘深度思考’ › y 462.5 vs 460
- main > greeting 1 › x 752.5 vs 737.5
- main > greeting 1 › y 326.5 vs 337
- main > greeting 1 › w 240 vs 264
- sidebar > span ‘开启新对话’ › x 106 vs 83
- sidebar > span ‘开启新对话’ › w 70 vs 94
- sidebar > span ‘开启新对话’ › h 20 vs 19
- main > span ‘深度思考’ › x 504.5 vs 500.5
- main > span ‘深度思考’ › y 467.5 vs 465
- main > span ‘智能搜索’ › x 606.52 vs 600.5
- main > span ‘智能搜索’ › y 467.5 vs 465
- sidebar > div @0,0 1440×900 › background-color rgba(0, 0, 0, 0.36) vs rgb(255, 255, 255)
- main > dialog @340,200 760×500 › box-shadow rgba(0, 0, 0, 0) 0px 0px 0px 1px inset, rgba(0, 0, 0, 0.2) 0px 0px 1px 0px, rgba(0, 0, 0,  vs rgba(0, 0, 0, 0.2) 0px 0px 1px 0px, rgba(0, 0, 0, 0.02) 0px 0px 4px 0px, rgba(0, 0, 0, 0.0
- main > dialog @340,200 760×500 › border-top-left-radius 24px vs 16px
- main > dialog @340,200 760×500 › border-top-right-radius 24px vs 16px
- main > dialog @340,200 760×500 › border-bottom-right-radius 24px vs 16px
- main > dialog @340,200 760×500 › border-bottom-left-radius 24px vs 16px
- sidebar > div @12,134 236×22 › h 22 vs 20.39
- sidebar > div @12,134 236×22 › background-color rgb(249, 250, 251) vs rgba(0, 0, 0, 0)

## search-dialog 1440x900

- control ‘深度思考’ › x 475.5 vs 471.5
- control ‘深度思考’ › y 462.5 vs 460
- main > greeting 1 › x 752.5 vs 737.5
- main > greeting 1 › y 326.5 vs 337
- main > greeting 1 › w 240 vs 264
- sidebar > span ‘开启新对话’ › x 106 vs 83
- sidebar > span ‘开启新对话’ › w 70 vs 94
- sidebar > span ‘开启新对话’ › h 20 vs 19
- main > span ‘深度思考’ › x 504.5 vs 500.5
- main > span ‘深度思考’ › y 467.5 vs 465
- main > span ‘智能搜索’ › x 606.52 vs 600.5
- main > span ‘智能搜索’ › y 467.5 vs 465
- sidebar > div @0,0 1440×900 › background-color rgba(0, 0, 0, 0.36) vs rgb(255, 255, 255)
- sidebar > div @12,134 236×22 › h 22 vs 20.39
- sidebar > div @12,134 236×22 › background-color rgb(249, 250, 251) vs rgba(0, 0, 0, 0)
- sidebar > div @12,134 236×22 › box-shadow rgb(249, 250, 251) 4px 0px 0px 0px vs none
- sidebar > div @12,134 236×22 › font-weight 500 vs 400
- sidebar > div @12,134 236×22 › line-height 18px vs 20.4px
- sidebar > div @12,134 236×22 › padding-top 2px vs 0px
- sidebar > div @12,134 236×22 › padding-right 8px vs 0px

## sidebar-item-menu 1440x900

- sidebar > row 1 › h 40 vs 50
- sidebar > row 1 › background-color rgba(0, 0, 0, 0) vs rgb(228, 237, 253)
- sidebar > group 1 › x 12 vs 22
- sidebar > group 1 › w 236 vs 24
- sidebar > group 1 › h 22 vs 18
- sidebar > group 1 › background-color rgb(249, 250, 251) vs rgba(0, 0, 0, 0)
- sidebar > group 1 › box-shadow rgb(249, 250, 251) 4px 0px 0px 0px vs none
- sidebar > group 1 › padding-top 2px vs 0px
- sidebar > group 1 › padding-right 10px vs 0px
- sidebar > group 1 › padding-bottom 2px vs 0px
- sidebar > group 1 › padding-left 10px vs 0px
- control ‘深度思考’ › x 475.5 vs 439.5
- control ‘深度思考’ › y 462.5 vs 810.61
- sidebar > span ‘开启新对话’ › x 106 vs 83
- sidebar > span ‘开启新对话’ › w 70 vs 94
- sidebar > span ‘开启新对话’ › h 20 vs 19
- main > span ‘深度思考’ › x 504.5 vs 468.5
- main > span ‘深度思考’ › y 467.5 vs 815.61
- main > span ‘智能搜索’ › x 606.52 vs 568.5
- main > span ‘智能搜索’ › y 467.5 vs 815.61

## sidebar-collapsed 1440x900

- control ‘深度思考’ › x 345 vs 341
- control ‘深度思考’ › y 462.5 vs 460
- main > greeting 1 › x 622 vs 607
- main > greeting 1 › y 326.5 vs 337
- main > greeting 1 › w 240 vs 264
- main > span ‘深度思考’ › x 374 vs 370
- main > span ‘深度思考’ › y 467.5 vs 465
- main > span ‘智能搜索’ › x 476.02 vs 470
- main > span ‘智能搜索’ › y 467.5 vs 465
- main > div @332,386 776×124 › y 385.5 vs 389
- main > icon 14×14 @356,473 › x 356 vs 352
- main > icon 14×14 @356,473 › y 472.5 vs 470
- main > button @1061,463 34×34 › x 1061 vs 1065
- main > button @1061,463 34×34 › y 462.5 vs 460
- main > button @1061,463 34×34 › opacity 0.4 vs 0.45
- main > button @1061,463 34×34 › padding-top 0px vs 1px
- main > button @1061,463 34×34 › padding-right 0px vs 6px
- main > button @1061,463 34×34 › padding-bottom 0px vs 1px
- main > button @1061,463 34×34 › padding-left 0px vs 6px
- main > icon 16×16 @1070,472 › x 1070 vs 1074

## answer 1440x900

- sidebar > row 1 › h 40 vs 50
- sidebar > row 1 › background-color rgba(0, 0, 0, 0) vs rgb(228, 237, 253)
- sidebar > group 1 › x 12 vs 22
- sidebar > group 1 › w 236 vs 24
- sidebar > group 1 › h 22 vs 18
- sidebar > group 1 › background-color rgb(249, 250, 251) vs rgba(0, 0, 0, 0)
- sidebar > group 1 › box-shadow rgb(249, 250, 251) 4px 0px 0px 0px vs none
- sidebar > group 1 › padding-top 2px vs 0px
- sidebar > group 1 › padding-right 10px vs 0px
- sidebar > group 1 › padding-bottom 2px vs 0px
- sidebar > group 1 › padding-left 10px vs 0px
- control ‘深度思考’ › x 475.5 vs 439.5
- control ‘深度思考’ › y 825 vs 810.61
- sidebar > span ‘开启新对话’ › x 106 vs 83
- sidebar > span ‘开启新对话’ › w 70 vs 94
- sidebar > span ‘开启新对话’ › h 20 vs 19
- main > span ‘深度思考’ › x 504.5 vs 468.5
- main > span ‘深度思考’ › y 830 vs 815.61
- main > span ‘智能搜索’ › x 606.52 vs 568.5
- main > span ‘智能搜索’ › y 830 vs 815.61

## thinking-collapsed 1440x900

- sidebar > row 1 › h 40 vs 50
- sidebar > row 1 › background-color rgba(0, 0, 0, 0) vs rgb(228, 237, 253)
- sidebar > group 1 › x 12 vs 22
- sidebar > group 1 › w 236 vs 24
- sidebar > group 1 › h 22 vs 18
- sidebar > group 1 › background-color rgb(249, 250, 251) vs rgba(0, 0, 0, 0)
- sidebar > group 1 › box-shadow rgb(249, 250, 251) 4px 0px 0px 0px vs none
- sidebar > group 1 › padding-top 2px vs 0px
- sidebar > group 1 › padding-right 10px vs 0px
- sidebar > group 1 › padding-bottom 2px vs 0px
- sidebar > group 1 › padding-left 10px vs 0px
- control ‘深度思考’ › x 475.5 vs 439.5
- control ‘深度思考’ › y 825 vs 810.61
- sidebar > span ‘开启新对话’ › x 106 vs 83
- sidebar > span ‘开启新对话’ › w 70 vs 94
- sidebar > span ‘开启新对话’ › h 20 vs 19
- main > span ‘深度思考’ › x 504.5 vs 468.5
- main > span ‘深度思考’ › y 830 vs 815.61
- main > span ‘智能搜索’ › x 606.52 vs 568.5
- main > span ‘智能搜索’ › y 830 vs 815.61

## scroll-up 1440x900

- sidebar > row 1 › h 40 vs 50
- sidebar > row 1 › background-color rgba(0, 0, 0, 0) vs rgb(228, 237, 253)
- sidebar > group 1 › x 12 vs 22
- sidebar > group 1 › w 236 vs 24
- sidebar > group 1 › h 22 vs 18
- sidebar > group 1 › background-color rgb(249, 250, 251) vs rgba(0, 0, 0, 0)
- sidebar > group 1 › box-shadow rgb(249, 250, 251) 4px 0px 0px 0px vs none
- sidebar > group 1 › padding-top 2px vs 0px
- sidebar > group 1 › padding-right 10px vs 0px
- sidebar > group 1 › padding-bottom 2px vs 0px
- sidebar > group 1 › padding-left 10px vs 0px
- control ‘深度思考’ › x 475.5 vs 439.5
- control ‘深度思考’ › y 825 vs 810.61
- sidebar > span ‘开启新对话’ › x 106 vs 83
- sidebar > span ‘开启新对话’ › w 70 vs 94
- sidebar > span ‘开启新对话’ › h 20 vs 19
- main > span ‘深度思考’ › x 504.5 vs 468.5
- main > span ‘深度思考’ › y 830 vs 815.61
- main > span ‘智能搜索’ › x 606.52 vs 568.5
- main > span ‘智能搜索’ › y 830 vs 815.61

## sidebar-date-groups 1440x900

- sidebar > group 1 › x 12 vs 22
- sidebar > group 1 › w 236 vs 24
- sidebar > group 1 › h 22 vs 18
- sidebar > group 1 › background-color rgb(249, 250, 251) vs rgba(0, 0, 0, 0)
- sidebar > group 1 › box-shadow rgb(249, 250, 251) 4px 0px 0px 0px vs none
- sidebar > group 1 › padding-top 2px vs 0px
- sidebar > group 1 › padding-right 10px vs 0px
- sidebar > group 1 › padding-bottom 2px vs 0px
- sidebar > group 1 › padding-left 10px vs 0px
- control ‘深度思考’ › x 475.5 vs 471.5
- control ‘深度思考’ › y 462.5 vs 460
- main > greeting 1 › x 752.5 vs 725.5
- main > greeting 1 › y 326.5 vs 337
- main > greeting 1 › w 240 vs 288
- sidebar > span ‘开启新对话’ › x 106 vs 83
- sidebar > span ‘开启新对话’ › w 70 vs 94
- sidebar > span ‘开启新对话’ › h 20 vs 19
- main > span ‘深度思考’ › x 504.5 vs 500.5
- main > span ‘深度思考’ › y 467.5 vs 465
- main > span ‘智能搜索’ › x 606.52 vs 600.5

## home-with-history 1920x1072

- sidebar > group 1 › x 12 vs 22
- sidebar > group 1 › w 236 vs 24
- sidebar > group 1 › h 22 vs 18
- sidebar > group 1 › background-color rgb(249, 250, 251) vs rgba(0, 0, 0, 0)
- sidebar > group 1 › box-shadow rgb(249, 250, 251) 4px 0px 0px 0px vs none
- sidebar > group 1 › padding-top 2px vs 0px
- sidebar > group 1 › padding-right 10px vs 0px
- sidebar > group 1 › padding-bottom 2px vs 0px
- sidebar > group 1 › padding-left 10px vs 0px
- control ‘深度思考’ › x 715.5 vs 711.5
- control ‘深度思考’ › y 548.5 vs 537.41
- main > greeting 1 › x 944.5 vs 965.5
- main > greeting 1 › y 412.5 vs 414.41
- main > greeting 1 › w 336 vs 288
- sidebar > span ‘开启新对话’ › x 106 vs 83
- sidebar > span ‘开启新对话’ › w 70 vs 94
- sidebar > span ‘开启新对话’ › h 20 vs 19
- main > span ‘深度思考’ › x 744.5 vs 740.5
- main > span ‘深度思考’ › y 553.5 vs 542.41
- main > span ‘智能搜索’ › x 846.52 vs 840.5

## answer 1920x1072

- sidebar > row 1 › h 40 vs 50
- sidebar > row 1 › background-color rgba(0, 0, 0, 0) vs rgb(228, 237, 253)
- sidebar > group 1 › x 12 vs 22
- sidebar > group 1 › w 236 vs 24
- sidebar > group 1 › h 22 vs 18
- sidebar > group 1 › background-color rgb(249, 250, 251) vs rgba(0, 0, 0, 0)
- sidebar > group 1 › box-shadow rgb(249, 250, 251) 4px 0px 0px 0px vs none
- sidebar > group 1 › padding-top 2px vs 0px
- sidebar > group 1 › padding-right 10px vs 0px
- sidebar > group 1 › padding-bottom 2px vs 0px
- sidebar > group 1 › padding-left 10px vs 0px
- control ‘深度思考’ › x 715.5 vs 679.5
- control ‘深度思考’ › y 997 vs 982.61
- sidebar > span ‘开启新对话’ › x 106 vs 83
- sidebar > span ‘开启新对话’ › w 70 vs 94
- sidebar > span ‘开启新对话’ › h 20 vs 19
- main > span ‘深度思考’ › x 744.5 vs 708.5
- main > span ‘深度思考’ › y 1002 vs 987.61
- main > span ‘智能搜索’ › x 846.52 vs 808.5
- main > span ‘智能搜索’ › y 1002 vs 987.61

## thinking-collapsed 1920x1072

- sidebar > row 1 › h 40 vs 50
- sidebar > row 1 › background-color rgba(0, 0, 0, 0) vs rgb(228, 237, 253)
- sidebar > group 1 › x 12 vs 22
- sidebar > group 1 › w 236 vs 24
- sidebar > group 1 › h 22 vs 18
- sidebar > group 1 › background-color rgb(249, 250, 251) vs rgba(0, 0, 0, 0)
- sidebar > group 1 › box-shadow rgb(249, 250, 251) 4px 0px 0px 0px vs none
- sidebar > group 1 › padding-top 2px vs 0px
- sidebar > group 1 › padding-right 10px vs 0px
- sidebar > group 1 › padding-bottom 2px vs 0px
- sidebar > group 1 › padding-left 10px vs 0px
- control ‘深度思考’ › x 715.5 vs 679.5
- control ‘深度思考’ › y 997 vs 982.61
- sidebar > span ‘开启新对话’ › x 106 vs 83
- sidebar > span ‘开启新对话’ › w 70 vs 94
- sidebar > span ‘开启新对话’ › h 20 vs 19
- main > span ‘深度思考’ › x 744.5 vs 708.5
- main > span ‘深度思考’ › y 1002 vs 987.61
- main > span ‘智能搜索’ › x 846.52 vs 808.5
- main > span ‘智能搜索’ › y 1002 vs 987.61

## scroll-up 1920x1072

- sidebar > row 1 › h 40 vs 50
- sidebar > row 1 › background-color rgba(0, 0, 0, 0) vs rgb(228, 237, 253)
- sidebar > group 1 › x 12 vs 22
- sidebar > group 1 › w 236 vs 24
- sidebar > group 1 › h 22 vs 18
- sidebar > group 1 › background-color rgb(249, 250, 251) vs rgba(0, 0, 0, 0)
- sidebar > group 1 › box-shadow rgb(249, 250, 251) 4px 0px 0px 0px vs none
- sidebar > group 1 › padding-top 2px vs 0px
- sidebar > group 1 › padding-right 10px vs 0px
- sidebar > group 1 › padding-bottom 2px vs 0px
- sidebar > group 1 › padding-left 10px vs 0px
- control ‘深度思考’ › x 715.5 vs 679.5
- control ‘深度思考’ › y 997 vs 982.61
- sidebar > span ‘开启新对话’ › x 106 vs 83
- sidebar > span ‘开启新对话’ › w 70 vs 94
- sidebar > span ‘开启新对话’ › h 20 vs 19
- main > span ‘深度思考’ › x 744.5 vs 708.5
- main > span ‘深度思考’ › y 1002 vs 987.61
- main > span ‘智能搜索’ › x 846.52 vs 808.5
- main > span ‘智能搜索’ › y 1002 vs 987.61

## home-with-history 390x844

- control ‘深度思考’ › x 45 vs 37
- control ‘深度思考’ › y 423.5 vs 479
- control ‘智能搜索’ › x 147.02 vs 137
- control ‘智能搜索’ › y 423.5 vs 479
- sidebar > span ‘深度思考’ › x 74 vs 66
- sidebar > span ‘深度思考’ › y 428.5 vs 484
- sidebar > span ‘智能搜索’ › x 176.02 vs 166
- sidebar > span ‘智能搜索’ › y 428.5 vs 484
- main > icon 20×20 @348,24 › x 348 vs 350
- main > icon 20×20 @348,24 › y 24 vs 16
- main > icon 20×20 @348,24 › w 20 vs 24
- main > icon 20×20 @348,24 › h 20 vs 24
- sidebar > div @224,16 104×36 › missing div vs —
- sidebar > icon 14×14 @239,27 › missing svg vs —
- sidebar > span ‘下载应用’ › missing 下载应用 vs —
- sidebar > icon 30×22 @75,313 › missing svg vs —
- sidebar > span ‘欢迎回来，随时开始吧’ › missing 欢迎回来，随时开始吧 vs —
- sidebar > div @32,365 326×106 › missing div vs —
- sidebar > textbox @33,370 324×42 › missing textarea vs —
- sidebar > icon 14×14 @56,434 › missing svg vs —

## user-menu 390x844

- sidebar > row 1 › h 40 vs 50.09
- sidebar > row 1 › border-top-left-radius 12px vs 0px
- sidebar > row 1 › border-top-right-radius 12px vs 0px
- sidebar > row 1 › border-bottom-right-radius 12px vs 0px
- sidebar > row 1 › border-bottom-left-radius 12px vs 0px
- sidebar > row 1 › font-size 14px vs 16px
- sidebar > row 1 › line-height 22px vs 27.2px
- sidebar > row 1 › padding-top 9px vs 6px
- sidebar > row 1 › padding-right 6px vs 4px
- sidebar > row 1 › padding-bottom 9px vs 6px
- sidebar > row 1 › padding-left 10px vs 4px
- control ‘开启新对话’ › y 70 vs 76
- control ‘开启新对话’ › box-shadow rgba(72, 104, 178, 0.04) 0px -2px 2px 0px, rgba(106, 111, 117, 0.09) 0px 2px 2px 0px, rgba vs rgba(0, 0, 0, 0.06) 0px 1px 2px 0px, rgba(15, 17, 21, 0.04) 0px 4px 12px 0px
- control ‘深度思考’ › x 29 vs 37
- control ‘深度思考’ › y 769 vs 479
- sidebar > span ‘开启新对话’ › x 106 vs 83
- sidebar > span ‘开启新对话’ › y 80 vs 86.5
- sidebar > span ‘开启新对话’ › w 70 vs 94
- sidebar > span ‘开启新对话’ › h 20 vs 19
- sidebar > span ‘深度思考’ › x 58 vs 66

## settings-general 390x844

- control ‘开启新对话’ › y 70 vs 76
- control ‘开启新对话’ › box-shadow rgba(72, 104, 178, 0.04) 0px -2px 2px 0px, rgba(106, 111, 117, 0.09) 0px 2px 2px 0px, rgba vs rgba(0, 0, 0, 0.06) 0px 1px 2px 0px, rgba(15, 17, 21, 0.04) 0px 4px 12px 0px
- control ‘深度思考’ › x 29 vs 37
- control ‘深度思考’ › y 769 vs 479
- sidebar > span ‘开启新对话’ › x 106 vs 83
- sidebar > span ‘开启新对话’ › y 80 vs 86.5
- sidebar > span ‘开启新对话’ › w 70 vs 94
- sidebar > span ‘开启新对话’ › h 20 vs 19
- sidebar > span ‘深度思考’ › x 58 vs 66
- sidebar > span ‘深度思考’ › y 774 vs 484
- sidebar > span ‘智能搜索’ › x 160.02 vs 166
- sidebar > span ‘智能搜索’ › y 774 vs 484
- sidebar > div @0,0 390×844 › background-color rgba(0, 0, 0, 0.4) vs rgb(255, 255, 255)
- sidebar > div @0,0 390×844 › background-color rgba(0, 0, 0, 0.36) vs rgba(0, 0, 0, 0.4)
- sidebar > div @0,0 390×844 › font-size 14px vs 16px
- sidebar > div @0,0 390×844 › line-height normal vs 27.2px
- sidebar > div @0,0 390×844 › color rgb(128, 0, 128) vs rgb(15, 17, 21)
- sidebar > div @0,0 390×844 › padding-top 0px vs 1px
- sidebar > div @0,0 390×844 › padding-right 0px vs 6px
- sidebar > div @0,0 390×844 › padding-bottom 0px vs 1px

## settings-account 390x844

- sidebar > row 1 › h 40 vs 50.09
- sidebar > row 1 › border-top-left-radius 12px vs 0px
- sidebar > row 1 › border-top-right-radius 12px vs 0px
- sidebar > row 1 › border-bottom-right-radius 12px vs 0px
- sidebar > row 1 › border-bottom-left-radius 12px vs 0px
- sidebar > row 1 › font-size 14px vs 16px
- sidebar > row 1 › line-height 22px vs 27.2px
- sidebar > row 1 › padding-top 9px vs 6px
- sidebar > row 1 › padding-right 6px vs 4px
- sidebar > row 1 › padding-bottom 9px vs 6px
- sidebar > row 1 › padding-left 10px vs 4px
- control ‘开启新对话’ › y 70 vs 76
- control ‘开启新对话’ › box-shadow rgba(72, 104, 178, 0.04) 0px -2px 2px 0px, rgba(106, 111, 117, 0.09) 0px 2px 2px 0px, rgba vs rgba(0, 0, 0, 0.06) 0px 1px 2px 0px, rgba(15, 17, 21, 0.04) 0px 4px 12px 0px
- control ‘深度思考’ › x 29 vs 37
- control ‘深度思考’ › y 769 vs 479
- sidebar > span ‘开启新对话’ › x 106 vs 83
- sidebar > span ‘开启新对话’ › y 80 vs 86.5
- sidebar > span ‘开启新对话’ › w 70 vs 94
- sidebar > span ‘开启新对话’ › h 20 vs 19
- sidebar > span ‘深度思考’ › x 58 vs 66

## settings-data 390x844

- control ‘开启新对话’ › y 70 vs 76
- control ‘开启新对话’ › box-shadow rgba(72, 104, 178, 0.04) 0px -2px 2px 0px, rgba(106, 111, 117, 0.09) 0px 2px 2px 0px, rgba vs rgba(0, 0, 0, 0.06) 0px 1px 2px 0px, rgba(15, 17, 21, 0.04) 0px 4px 12px 0px
- control ‘深度思考’ › x 29 vs 37
- control ‘深度思考’ › y 769 vs 479
- sidebar > span ‘开启新对话’ › x 106 vs 83
- sidebar > span ‘开启新对话’ › y 80 vs 86.5
- sidebar > span ‘开启新对话’ › w 70 vs 94
- sidebar > span ‘开启新对话’ › h 20 vs 19
- sidebar > span ‘深度思考’ › x 58 vs 66
- sidebar > span ‘深度思考’ › y 774 vs 484
- sidebar > span ‘智能搜索’ › x 160.02 vs 166
- sidebar > span ‘智能搜索’ › y 774 vs 484
- sidebar > div @0,0 390×844 › background-color rgba(0, 0, 0, 0.4) vs rgb(255, 255, 255)
- sidebar > div @0,0 390×844 › background-color rgba(0, 0, 0, 0.36) vs rgba(0, 0, 0, 0.4)
- sidebar > div @0,0 390×844 › font-size 14px vs 16px
- sidebar > div @0,0 390×844 › line-height normal vs 27.2px
- sidebar > div @0,0 390×844 › color rgb(128, 0, 128) vs rgb(15, 17, 21)
- sidebar > div @0,0 390×844 › padding-top 0px vs 1px
- sidebar > div @0,0 390×844 › padding-right 0px vs 6px
- sidebar > div @0,0 390×844 › padding-bottom 0px vs 1px

## settings-terms 390x844

- control ‘开启新对话’ › y 70 vs 76
- control ‘开启新对话’ › box-shadow rgba(72, 104, 178, 0.04) 0px -2px 2px 0px, rgba(106, 111, 117, 0.09) 0px 2px 2px 0px, rgba vs rgba(0, 0, 0, 0.06) 0px 1px 2px 0px, rgba(15, 17, 21, 0.04) 0px 4px 12px 0px
- control ‘深度思考’ › x 29 vs 37
- control ‘深度思考’ › y 769 vs 479
- sidebar > span ‘开启新对话’ › x 106 vs 83
- sidebar > span ‘开启新对话’ › y 80 vs 86.5
- sidebar > span ‘开启新对话’ › w 70 vs 94
- sidebar > span ‘开启新对话’ › h 20 vs 19
- sidebar > span ‘深度思考’ › x 58 vs 66
- sidebar > span ‘深度思考’ › y 774 vs 484
- sidebar > span ‘智能搜索’ › x 160.02 vs 166
- sidebar > span ‘智能搜索’ › y 774 vs 484
- sidebar > div @0,0 390×844 › background-color rgba(0, 0, 0, 0.4) vs rgb(255, 255, 255)
- sidebar > div @0,0 390×844 › background-color rgba(0, 0, 0, 0.36) vs rgba(0, 0, 0, 0.4)
- sidebar > div @0,0 390×844 › font-size 14px vs 16px
- sidebar > div @0,0 390×844 › line-height normal vs 27.2px
- sidebar > div @0,0 390×844 › color rgb(128, 0, 128) vs rgb(15, 17, 21)
- sidebar > div @0,0 390×844 › padding-top 0px vs 1px
- sidebar > div @0,0 390×844 › padding-right 0px vs 6px
- sidebar > div @0,0 390×844 › padding-bottom 0px vs 1px

## answer 390x844

- control ‘深度思考’ › x 29 vs 37
- control ‘深度思考’ › y 769 vs 720.31
- control ‘智能搜索’ › x 131.02 vs 137
- control ‘智能搜索’ › y 769 vs 720.31
- sidebar > span ‘深度思考’ › x 58 vs 66
- sidebar > span ‘深度思考’ › y 774 vs 725.31
- sidebar > span ‘智能搜索’ › x 160.02 vs 166
- sidebar > span ‘智能搜索’ › y 774 vs 725.31
- main > span ‘)’ › x 298.13 vs 294
- main > span ‘)’ › y 118.22 vs 116
- main > span ‘)’ › w 7.28 vs 20
- main > span ‘)’ › h 14 vs 20
- main > span ‘)’ › font-size 13px vs 16px
- main > span ‘)’ › line-height 22px vs 27.2px
- main > span ‘)’ › color rgb(56, 58, 66) vs rgb(92, 97, 102)
- main > icon 20×20 @343,24 › x 343 vs 350
- main > icon 20×20 @343,24 › y 24 vs 16
- main > icon 20×20 @343,24 › w 20 vs 24
- main > icon 20×20 @343,24 › h 20 vs 24
- sidebar > div ‘内容由 AI 生成，请仔细甄别’ › y 816 vs 809.31

## thinking-collapsed 390x844

- control ‘深度思考’ › x 29 vs 37
- control ‘深度思考’ › y 769 vs 720.31
- control ‘智能搜索’ › x 131.02 vs 137
- control ‘智能搜索’ › y 769 vs 720.31
- sidebar > span ‘深度思考’ › x 58 vs 66
- sidebar > span ‘深度思考’ › y 774 vs 725.31
- sidebar > span ‘智能搜索’ › x 160.02 vs 166
- sidebar > span ‘智能搜索’ › y 774 vs 725.31
- sidebar > icon 14×14 @195,270 › x 194.94 vs 194
- sidebar > icon 14×14 @195,270 › y 270 vs 276.58
- sidebar > icon 14×14 @195,270 › w 14 vs 20
- sidebar > icon 14×14 @195,270 › h 14 vs 20
- main > icon 20×20 @343,24 › x 343 vs 350
- main > icon 20×20 @343,24 › y 24 vs 16
- main > icon 20×20 @343,24 › w 20 vs 24
- main > icon 20×20 @343,24 › h 20 vs 24
- sidebar > div ‘内容由 AI 生成，请仔细甄别’ › y 816 vs 809.31
- sidebar > div ‘内容由 AI 生成，请仔细甄别’ › h 28 vs 18.69
- sidebar > div ‘内容由 AI 生成，请仔细甄别’ › background-color rgb(255, 255, 255) vs rgba(0, 0, 0, 0)
- sidebar > div ‘内容由 AI 生成，请仔细甄别’ › line-height 16px vs 18.7px

## scroll-up 390x844

- control ‘深度思考’ › x 29 vs 37
- control ‘深度思考’ › y 769 vs 720.31
- control ‘智能搜索’ › x 131.02 vs 137
- control ‘智能搜索’ › y 769 vs 720.31
- sidebar > span ‘深度思考’ › x 58 vs 66
- sidebar > span ‘深度思考’ › y 774 vs 725.31
- sidebar > span ‘智能搜索’ › x 160.02 vs 166
- sidebar > span ‘智能搜索’ › y 774 vs 725.31
- main > icon 20×20 @343,24 › x 343 vs 350
- main > icon 20×20 @343,24 › y 24 vs 16
- main > icon 20×20 @343,24 › w 20 vs 24
- main > icon 20×20 @343,24 › h 20 vs 24
- sidebar > div ‘内容由 AI 生成，请仔细甄别’ › y 816 vs 809.31
- sidebar > div ‘内容由 AI 生成，请仔细甄别’ › h 28 vs 18.69
- sidebar > div ‘内容由 AI 生成，请仔细甄别’ › background-color rgb(255, 255, 255) vs rgba(0, 0, 0, 0)
- sidebar > div ‘内容由 AI 生成，请仔细甄别’ › line-height 16px vs 18.7px
- sidebar > div ‘内容由 AI 生成，请仔细甄别’ › padding-top 6px vs 0px
- sidebar > div ‘内容由 AI 生成，请仔细甄别’ › padding-bottom 6px vs 0px
- main > icon 20×20 @289,24 › x 289 vs 302
- main > icon 20×20 @289,24 › y 24 vs 16

## mobile-drawer 390x844

- control ‘开启新对话’ › y 70 vs 76
- control ‘开启新对话’ › box-shadow rgba(72, 104, 178, 0.04) 0px -2px 2px 0px, rgba(106, 111, 117, 0.09) 0px 2px 2px 0px, rgba vs rgba(0, 0, 0, 0.06) 0px 1px 2px 0px, rgba(15, 17, 21, 0.04) 0px 4px 12px 0px
- sidebar > span ‘开启新对话’ › x 106 vs 83
- sidebar > span ‘开启新对话’ › y 80 vs 86.5
- sidebar > span ‘开启新对话’ › w 70 vs 94
- sidebar > span ‘开启新对话’ › h 20 vs 19
- sidebar > div @0,0 390×844 › background-color rgba(0, 0, 0, 0.4) vs rgb(255, 255, 255)
- sidebar > div @12,134 236×22 › y 134 vs 140
- sidebar > div @12,134 236×22 › h 22 vs 20.39
- sidebar > div @12,134 236×22 › background-color rgb(249, 250, 251) vs rgba(0, 0, 0, 0)
- sidebar > div @12,134 236×22 › box-shadow rgb(249, 250, 251) 4px 0px 0px 0px vs none
- sidebar > div @12,134 236×22 › font-weight 500 vs 400
- sidebar > div @12,134 236×22 › line-height 18px vs 20.4px
- sidebar > div @12,134 236×22 › padding-top 2px vs 0px
- sidebar > div @12,134 236×22 › padding-right 8px vs 0px
- sidebar > div @12,134 236×22 › padding-bottom 2px vs 0px
- sidebar > div @12,134 236×22 › padding-left 10px vs 0px
- sidebar > div ‘H’ › x 18 vs 16
- sidebar > div ‘H’ › y 796 vs 790.95
- sidebar > icon 16×16 @84,82 › x 84 vs 83

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
- sidebar > row 2 › padding-left 10px vs 0px
- sidebar > group 1 › x 12 vs 22
- sidebar > group 1 › w 236 vs 24
- sidebar > group 1 › h 22 vs 18
- sidebar > group 1 › background-color rgb(249, 250, 251) vs rgba(0, 0, 0, 0)
- sidebar > group 1 › box-shadow rgb(249, 250, 251) 4px 0px 0px 0px vs none
- sidebar > group 1 › padding-top 2px vs 0px
- sidebar > group 1 › padding-right 10px vs 0px

