深度思考和智能搜索默认打开，刷新后回到打开；本次页面里改过的开关在新建对话后保留，刷新不记住。SP-CMP-255、SP-CMP-256。

理由：昊辰 11/26 00:30 发来 chat.deepseek.com 首页截图，两个开关默认打开、刷新后仍打开，并说明官方也不记住改动。基线条目由筑衡按昊辰的截图证据批准修改，覆盖 11/23 12:51 记录的「默认关闭」（r9-toggles.md）。

为什么之前记成关闭：SP-CMP-255/256 只读了官方 bundle 里的本地兜底值（create("thinkingEnabled", false)、create("searchEnabled", false) 和 search_state_on_launch 兜底 "keep"），capture 为空就标成 confirmed。真实默认由运行时下发的远程开关决定，bundle 里看不到。仓库里的官方截图 docs/parity/compare/home-light.png 和 home.png 当时已经是两个都打开，docs/parity/official-behavior-from-source.md 也写着 "Both toggles stay on by default"，但没有检查把记录的默认值和官方截图对比。

新增检查：
- apps/web/e2e/composer-defaults.spec.ts：新上下文空存储下，落地页和输入框两个开关为按下状态并使用官方选中样式（浅色、深色、390 手机），刷新和新建对话后仍打开，第一条请求带 thinking enabled 和搜索工具；本次页面改关后新建对话保持关闭、刷新回到打开；旧版本存下的 deepapi-toggles 不覆盖默认。
- apps/web/e2e/official-defaults.spec.ts + fixtures/official-defaults.json：defaultPrefs 的每个键都要有登记；有官方对应的默认值必须指向仓库里的官方截图（sha256 固定）并按像素判定开或关，和登记值不一致就失败；我们首次加载的渲染要和登记值一致。

旧断言改动（每条都是这两个默认值或刷新不记住的直接后果，逐条列在下面）：
