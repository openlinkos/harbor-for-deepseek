深度思考和智能搜索默认打开，刷新后回到打开；本次页面里改过的开关在新建对话后保留，刷新不记住。SP-CMP-255、SP-CMP-256。

理由：昊辰 11/26 00:30 发来 chat.deepseek.com 首页截图，两个开关默认打开、刷新后仍打开，并说明官方也不记住改动。基线条目由筑衡按昊辰的截图证据批准修改，覆盖 11/23 12:51 记录的「默认关闭」（r9-toggles.md）。

为什么之前记成关闭：SP-CMP-255/256 只读了官方 bundle 里的本地兜底值（create("thinkingEnabled", false)、create("searchEnabled", false) 和 search_state_on_launch 兜底 "keep"），capture 为空就标成 confirmed。真实默认由运行时下发的远程开关决定，bundle 里看不到。仓库里的官方截图 docs/parity/compare/home-light.png 和 home.png 当时已经是两个都打开，docs/parity/official-behavior-from-source.md 也写着 "Both toggles stay on by default"，但没有检查把记录的默认值和官方截图对比。

新增检查：
- apps/web/e2e/composer-defaults.spec.ts：新上下文空存储下，落地页和输入框两个开关为按下状态并使用官方选中样式（浅色、深色、390 手机），刷新和新建对话后仍打开，第一条请求带 thinking enabled 和搜索工具；本次页面改关后新建对话保持关闭、刷新回到打开；旧版本存下的 deepapi-toggles 不覆盖默认。
- apps/web/e2e/official-defaults.spec.ts + fixtures/official-defaults.json：defaultPrefs 的每个键都要有登记；有官方对应的默认值必须指向仓库里的官方截图（sha256 固定）并按像素判定开或关，和登记值不一致就失败；我们首次加载的渲染要和登记值一致。

旧断言改动（每条都是这两个默认值或刷新不记住的直接后果，逐条列在下面）：

apps/web/e2e/toggles.spec.ts:102 旧无首断言（r9:102 把 expectChip thinking true 改成 false）新 expectChip toggle-thinking true，（a），SP-CMP-255，理由：昊辰 11/26 00:30 截图证据。
apps/web/e2e/toggles.spec.ts:103 旧无点击（r9 去掉了把思考点开的点击）新 click toggle-thinking，（b），SP-CMP-255，理由：昊辰 11/26 00:30 截图证据。点关之后原来的 false 和请求 thinking disabled 仍保留。
apps/web/e2e/toggles.spec.ts:120 旧无点击 新 click toggle-thinking，（b），SP-CMP-255，理由：昊辰 11/26 00:30 截图证据。点关之后新建对话、快捷键仍断言关。
apps/web/e2e/toggles.spec.ts:133 旧 expectChip toggle-thinking false 新 true，（a），SP-CMP-255，理由：昊辰 11/26 00:30 截图证据。刷新不记住，回到打开。不是 r9 行的简单取反：r9 时思考写入 localStorage，刷新仍关。
apps/web/e2e/toggles.spec.ts:140 旧 thinking type disabled 新 enabled，（a），SP-CMP-255，理由：昊辰 11/26 00:30 截图证据。刷新后的第一条请求回到打开。
apps/web/e2e/toggles.spec.ts:151 旧 expectChip toggle-search true 新 false，（a），SP-CMP-256，理由：昊辰 11/26 00:30 截图证据。对 r9:148 取反。默认已开，原有点击把它关掉。
apps/web/e2e/toggles.spec.ts:154 旧 expectChip toggle-search true 新 false，（a），SP-CMP-256，理由：昊辰 11/26 00:30 截图证据。对 r9:151 取反。
apps/web/e2e/toggles.spec.ts:156 旧 expectChip toggle-search true 新 false，（a），SP-CMP-256，理由：昊辰 11/26 00:30 截图证据。对 r9:153 取反。
apps/web/e2e/toggles.spec.ts:158 旧 expectChip toggle-search true 新 false，（a），SP-CMP-256，理由：昊辰 11/26 00:30 截图证据。对 r9:155 取反。
apps/web/e2e/toggles.spec.ts:162 旧 expectChip toggle-search false 新 true，（a），SP-CMP-256，理由：昊辰 11/26 00:30 截图证据。对 r9:159 取反。刷新回到打开。
apps/web/e2e/toggles.spec.ts:168 旧 hasSearch false 新 true，（a），SP-CMP-256，理由：昊辰 11/26 00:30 截图证据。对 r9:165 取反。
apps/web/e2e/toggles.spec.ts:169 旧 thinking type disabled 新 enabled，（a），SP-CMP-255，理由：昊辰 11/26 00:30 截图证据。对 r9:166 取反。
apps/web/e2e/toggles.spec.ts:176 旧 expectChip landing-thinking false 新 true，（a），SP-CMP-255，理由：昊辰 11/26 00:30 截图证据。对 r9:173 取反。
apps/web/e2e/toggles.spec.ts:177 旧 expectChip landing-search false 新 true，（a），SP-CMP-256，理由：昊辰 11/26 00:30 截图证据。对 r9:174 取反。
apps/web/e2e/toggles.spec.ts:178 旧点击在关断言之后 新 click landing-thinking 挪到关断言之前，（b），SP-CMP-255，理由：昊辰 11/26 00:30 截图证据。
apps/web/e2e/toggles.spec.ts:179 旧点击在关断言之后 新 click landing-search 挪到关断言之前，（b），SP-CMP-256，理由：昊辰 11/26 00:30 截图证据。
apps/web/e2e/toggles.spec.ts:180 旧点击后 expectChip landing-thinking true（r9:178）新该 true 断言删除，点击后仍用未改文本的 false，（a），SP-CMP-255，理由：昊辰 11/26 00:30 截图证据。
apps/web/e2e/toggles.spec.ts:181 旧点击后 expectChip landing-search true（r9:179）新该 true 断言删除，点击后仍用未改文本的 false，（a），SP-CMP-256，理由：昊辰 11/26 00:30 截图证据。
apps/web/e2e/toggles.spec.ts:187 旧 expectChip toggle-thinking true 新 false，（a），SP-CMP-255，理由：昊辰 11/26 00:30 截图证据。对 r9:184 取反。本次会话里落地页点关后进入对话仍关。
apps/web/e2e/toggles.spec.ts:188 旧 expectChip toggle-search true 新 false，（a），SP-CMP-256，理由：昊辰 11/26 00:30 截图证据。对 r9:185 取反。
apps/web/e2e/toggles.spec.ts:193 旧 expectChip toggle-search false 新 true，（a），SP-CMP-256，理由：昊辰 11/26 00:30 截图证据。对 r9:190 取反。刷新回到打开。
apps/web/e2e/toggles.spec.ts:197 旧 hasSearch false 新 true，（a），SP-CMP-256，理由：昊辰 11/26 00:30 截图证据。对 r9:194 取反。
apps/web/e2e/toggles.spec.ts:204 旧 click toggle-search 新 click toggle-thinking，（b），SP-CMP-255，理由：昊辰 11/26 00:30 截图证据。默认两个都开；点掉思考后，搜索仍开，原有「不渲染思考壳、请求带搜索」断言不动。
apps/web/e2e/toggles.spec.ts:227 旧无点击 新 click toggle-thinking，（b），SP-CMP-255，理由：昊辰 11/26 00:30 截图证据。点关后打开已有对话，本次会话仍关。
apps/web/e2e/toggles.spec.ts:241 旧 expectChip toggle-thinking false 新 true，（a），SP-CMP-255，理由：昊辰 11/26 00:30 截图证据。刷新回到打开。回答正文「已思考 / 3+5=8」未改。

apps/web/e2e/parity.spec.ts:232 旧 poll class on false 新 true，（a），SP-CMP-255，理由：昊辰 11/26 00:30 截图证据。对 r9:211 取反。r9 之后该断言已从 toHaveClass 改成 poll，只翻布尔。
apps/web/e2e/parity.spec.ts:233 旧 poll class on false 新 true，（a），SP-CMP-256，理由：昊辰 11/26 00:30 截图证据。对 r9:212 取反。
apps/web/e2e/parity.spec.ts:236 旧 poll class on true 新 false，（a），SP-CMP-255，理由：昊辰 11/26 00:30 截图证据。对 r9:215 取反。点击之后。
apps/web/e2e/parity.spec.ts:238 旧 poll class on true 新 false，（a），SP-CMP-256，理由：昊辰 11/26 00:30 截图证据。对 r9:217 取反。点击之后。
apps/web/e2e/parity.spec.ts:620 旧直接 setInputFiles 新先 click toggle-search，（b），SP-CMP-256，理由：昊辰 11/26 00:30 截图证据。搜索开时附件被拒；`.drafts` 含 note.txt 的原断言未改。
apps/web/e2e/parity.spec.ts:920 旧 background-color rgb(255, 255, 255) 新 rgb(237, 243, 254)，（c），SP-CMP-255，理由：昊辰 11/26 00:30 截图证据。对 r9:879 取反。开态颜色改回点击前。
apps/web/e2e/parity.spec.ts:921 旧 color rgb(15, 17, 21) 新 rgb(57, 100, 254)，（c），SP-CMP-255，理由：昊辰 11/26 00:30 截图证据。对 r9:880 取反。
apps/web/e2e/parity.spec.ts:923 旧 border-top-color rgb(183, 200, 254) 在点亮之后 新回到点击之前，（c），SP-CMP-255，理由：昊辰 11/26 00:30 截图证据。对 r9:887 取反。
apps/web/e2e/parity.spec.ts:926 旧 background-color rgb(237, 243, 254) 新 rgb(255, 255, 255)，（c），SP-CMP-255，理由：昊辰 11/26 00:30 截图证据。对 r9:884 取反。点击并移开鼠标之后的关态。
apps/web/e2e/parity.spec.ts:927 旧 color rgb(57, 100, 254) 新 rgb(15, 17, 21)，（c），SP-CMP-255，理由：昊辰 11/26 00:30 截图证据。对 r9:885 取反。

apps/web/e2e/compare.spec.ts:174 旧 poll class on false 新 true，（a），SP-CMP-255，理由：昊辰 11/26 00:30 截图证据。对 r9:174 取反。只翻布尔，不改回 toHaveClass。
apps/web/e2e/compare.spec.ts:175 旧 poll class on false 新 true，（a），SP-CMP-256，理由：昊辰 11/26 00:30 截图证据。对 r9:175 取反。
apps/web/e2e/compare.spec.ts:270 旧 poll class on false 新 true，（a），SP-CMP-255，理由：昊辰 11/26 00:30 截图证据。对 r9:270 取反。
apps/web/e2e/compare.spec.ts:271 旧 poll class on false 新 true，（a），SP-CMP-256，理由：昊辰 11/26 00:30 截图证据。对 r9:271 取反。

apps/web/e2e/popover.spec.ts:179 旧 poll class on false 新 true，（a），SP-CMP-255，理由：昊辰 11/26 00:30 截图证据。对 r9:179 取反。
apps/web/e2e/popover.spec.ts:180 旧 poll class on false 新 true，（a），SP-CMP-256，理由：昊辰 11/26 00:30 截图证据。对 r9:180 取反。
apps/web/e2e/popover.spec.ts:181 旧 r9 增加的 thinking.click() 与 search.click() 新删除这两下点击，（b），SP-CMP-255/256，理由：昊辰 11/26 00:30 截图证据。默认已开，再点会关掉，后面的 Enter 关 / Space 开断言保持原值。

apps/web/e2e/fixed-model.spec.ts:220 旧 not.toHaveClass(/\bon\b/) 新 toHaveClass(/\bon\b/)，（a），SP-CMP-255，理由：昊辰 11/26 00:30 截图证据。对 r9:220 取反。
apps/web/e2e/fixed-model.spec.ts:221 旧 r9 增加的 toggle-thinking.click() 新删除，（b），SP-CMP-255，理由：昊辰 11/26 00:30 截图证据。请求仍断言 thinking.type enabled。
apps/web/e2e/fixed-model.spec.ts:239 旧 not.toHaveClass(/\bon\b/) 新 toHaveClass(/\bon\b/)，（a），SP-CMP-255，理由：昊辰 11/26 00:30 截图证据。对 r9:240 取反。行号因上一处删除点击而前移。
apps/web/e2e/fixed-model.spec.ts:240 旧 r9 增加的 toggle-thinking.click() 新删除，（b），SP-CMP-255，理由：昊辰 11/26 00:30 截图证据。其后点关、disabled、再点开、enabled 的断言未改。

apps/web/e2e/chat.spec.ts:151 旧 click toggle-search 新 click toggle-thinking，（b），SP-CMP-255，理由：昊辰 11/26 00:30 截图证据。默认两个都开；点掉思考后搜索仍开，冰岛搜索回复断言未改。
apps/web/e2e/chat.spec.ts:242 旧 click toggle-search 新 click toggle-thinking，（b），SP-CMP-255，理由：昊辰 11/26 00:30 截图证据。手机布局同一条搜索路径。
apps/web/e2e/chat.spec.ts:275 旧直接 setInputFiles 新先 click toggle-search，（b），SP-CMP-256，理由：昊辰 11/26 00:30 截图证据。`.drafts` 含 note.txt 的原断言未改。
apps/web/e2e/chat.spec.ts:702 旧直接 setInputFiles 新先 click toggle-search，（b），SP-CMP-256，理由：昊辰 11/26 00:30 截图证据。expires_after 的原断言未改。

apps/web/e2e/file-purpose.spec.ts:166 旧直接 setInputFiles 新先 click toggle-search，（b），SP-CMP-256，理由：昊辰 11/26 00:30 截图证据。purpose 断言未改。
apps/web/e2e/attachment-cards.spec.ts:90 旧直接 setInputFiles 新先 click toggle-search，（b），SP-CMP-256，理由：昊辰 11/26 00:30 截图证据。卡片尺寸与发送复用断言未改。
apps/web/e2e/spec-align-composer.spec.ts:64 旧直接 setInputFiles 新先 click toggle-search，（b），SP-CMP-256，理由：昊辰 11/26 00:30 截图证据。草稿按会话保留、刷新消失的原断言未改。

未改、但和这条基线有关：

- toggles.spec.ts:192 expectChip toggle-thinking true、:196 thinking type enabled 两行文本没动。r9:189 / r9:193 曾把它们从关改成开，因为当时思考写入 localStorage，落地页点开后刷新仍开。现在刷新一律回到打开，结果仍是开，所以没有再改这两行。
- 测试标题未改。改标题不属于 (a)(b)(c)。因此 parity.spec.ts:230 仍叫 `tools default off`（r9 从 on 改名，但 r9-toggles.md 没记这一行），toggles.spec.ts 里「deep thinking stays off … and reload」「smart search stays on … resets off」也保持原标题。断言已按新行为改。
- 搜索开时仍不能挂附件（addFiles → filesNeedNoSearch，已有文件时 toggle-search aria-disabled）。本 PR 不改这条产品规则。官方在智能搜索打开时能否挂文件，没有对照，记为后续。
- packages/archive-v3/src/index.ts 导入 v3 会话时仍把会话行写成 thinking: true、search: false。这是存进会话的值，不是作曲条默认。服务端 schema 和 API 语义未改，服务端仍只收客户端显式布尔。续写在会话行存在时仍用该行的 thinking/search；行缺失时的兜底改为 defaultPrefs()（两个都开）。会话行上的偏好除此之外不变。
- 没有 store 单测。没有新增测试框架。

## r23b 搜索打开时可以上传文件（PR #73 独立复验 BLOCK 后补）

理由：独立复验（deepapi-verify/pr73/REPORT.md）指出搜索默认打开后新用户无法挂附件，比线上差。官方 bundle 只有在远程配置 file_feature.conflict_with_search === true 时才互斥；官方截图 docs/parity/compare/home-light.png 两个开关都打开时，回形针是可用色 rgb(15, 17, 21)。

新增检查（先于修复提交，在 7b30151 上失败）：
- apps/web/e2e/attach-with-search.spec.ts：默认搜索打开时回形针能打开文件选择并挂上文件；挂了文件后搜索开关仍可切换；请求同时带文件和联网搜索工具。
- fixtures/official-defaults.json 新增 composer.attach.enabled-with-search：按 sha256 固定官方截图回形针像素（可用色），我们首次加载时回形针必须可用、颜色一致、真实点击能打开文件选择。
- 每个截图采样同时登记开和关两种颜色，像素两者都不像就失败；composer-defaults.spec.ts 关闭状态也断言官方未选中颜色。

产品：`conflictWithSearch` 默认 false（`apps/web/src/fileSearch.ts`，注释引用 bundle `main.5a15ff2247.js` 的 `file_feature.conflict_with_search`）。关时可以同时挂文件和开搜索，请求两者都带。开时仍是原来的 toast、回形针点击直接返回、有文件时搜索开关 aria-disabled。i18n 字符串保留。没有 localStorage / URL 测试开关：默认就是关。两种取值由 `fileSearch.test.ts` 覆盖。

旧测试里没有断言互斥本身的用例。grep `filesNeedNoSearch` / `searchNeedsNoFiles` / `联网搜索不支持上传文件` / `请先删除文件再开启联网搜索`，命中的只有 i18n、实现，以及新的 attach-with-search.spec.ts（断言这些提示不出现）。`search-switch.spec.ts` 测的是会话搜索框，不是这条互斥。因此没有为打开 conflict 旗而改旧测试。

旧测试改动（只撤回 7b30151 里为了绕过互斥而加的 setup click）：

apps/web/e2e/chat.spec.ts:275 旧 click toggle-search 再 setInputFiles 新直接 setInputFiles，理由：PR #73 复验 BLOCK，官方 file_feature.conflict_with_search 默认关。
apps/web/e2e/chat.spec.ts:701 旧 click toggle-search 再 waitForRequest 新直接 waitForRequest（setInputFiles 在 702），理由：PR #73 复验 BLOCK，官方 file_feature.conflict_with_search 默认关。
apps/web/e2e/parity.spec.ts:620 旧 click toggle-search 再 setInputFiles 新直接 setInputFiles，理由：PR #73 复验 BLOCK，官方 file_feature.conflict_with_search 默认关。
apps/web/e2e/file-purpose.spec.ts:166 旧 click toggle-search 再进入上传循环 新删除该点击（setInputFiles 现于 176），理由：PR #73 复验 BLOCK，官方 file_feature.conflict_with_search 默认关。
apps/web/e2e/attachment-cards.spec.ts:90 旧 click toggle-search 再准备样本 新直接准备样本（setInputFiles 现于 94），理由：PR #73 复验 BLOCK，官方 file_feature.conflict_with_search 默认关。
apps/web/e2e/spec-align-composer.spec.ts:64 旧 click toggle-search 再 setInputFiles 新直接 setInputFiles，理由：PR #73 复验 BLOCK，官方 file_feature.conflict_with_search 默认关。
