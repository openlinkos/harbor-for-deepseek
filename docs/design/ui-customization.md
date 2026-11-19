# 可替换的界面

本文只定设计。不改 `apps/web` 的页面代码，也不改官方对齐那一轮正在改的样式。默认界面仍是 [chat.deepseek.com](https://chat.deepseek.com) 的像素级对照，验收仍以 [docs/test-matrix.md](../test-matrix.md) 为准。没有安装界面包时，现有每一行都应保持原样。

相关文档：[分享服务](share-service.md)、[里程碑](roadmap.md)。

## 这是哪一类问题

用户用一句话改自己的界面，同时页面里还放着 DeepSeek 的 Key。这是三件已有问题叠在一起：

1. **用设计变量换肤。** 颜色、字号、圆角、间距、动效时长，用一组有名字的 CSS 变量表达。官方样式只读这些变量。用户改变量的值，不改官方样式表本身。
2. **在持有秘密的页面上使用别人写的样式。** 本站的 Key 在 IndexedDB 数据库 `harbor-secrets` 里。同一来源上的脚本可以读到它（见 [SECURITY.md](../../SECURITY.md)）。所以用户界面不能带脚本。样式也要消毒：CSS 可以用 `url()` 把页面上的文字带出浏览器。
3. **模型写出一份受限的文件，由本地程序决定收不收。** 模型的输出不当成可执行代码。本地用同一套校验器检查，通过后才给用户看差异，用户点应用才生效。

官方页面还会继续改。用户的覆盖要挂在稳定的区域名字上，不能挂在今天的 class 名字上。class 会在对齐官方界面时继续变。

因此采用三层，从弱到强。弱的一层能做的事，就不升到强的一层。

| 层 | 能做的事 | 例子 |
| --- | --- | --- |
| 设计变量 | 改已有变量的值 | 侧栏窄一点、暖色 |
| 区域样式 | 在指定区域内写 CSS | 输入框的圆角、气泡的边框 |
| 布局 | 在少数预置位置里重排 | 输入框放到对话上方、侧栏放到右边 |

三层都写进同一份界面包。包是声明式的：一份 JSON、一段 CSS、可选的几张位图。包里没有脚本。

## 现在的代码，设计要对齐的地方

页面在 `apps/web/src/ui.tsx`。已登录后的主壳是 `Shell`：

- `aside.sidebar`：品牌、新对话、分组列表、底部用户条。桌面宽度写死 `261px`（`apps/web/src/styles.css`）。窄屏（最大宽度 767px）已经改读 `var(--sider-width, 261px)`，并变成抽屉。
- `section.stage`：顶栏、`.transcript`、`.composer-wrap`（输入框最大宽度 840px，1023px 以下为 712px）、免责声明 `.ai-note`。
- 空对话时，问候和输入框在 `.home` 里，输入框不在底部那一条。
- 搜索是 `.search-dialog`。来源面板是 `.search-panel`。设置是 `.settings-shell`，四个页：通用、账号、数据、协议。
- 钥匙页是 `KeyGate`（`.landing`），和 `Shell` 是兄弟，不在主壳里面。页脚商标说明在 `.site-footer`。

颜色和动效已经是变量，在 `apps/web/src/theme.css`：

- 静态色 `--dsw-static-*`，语义色 `--dsw-alias-*`、`--dsw-specific-*`。
- 动效 `--ds-transition-duration`（0.2s）、`fast`（0.1s）、`slow`（0.3s），以及三组缓动。
- 深色靠 `body[data-ds-dark-theme]`。主题选择存在 `localStorage` 键 `harbor-theme`（`themeMode.ts`），取值 `system`、`light`、`dark`。这是现有行为，界面包不接管这个键。

内容安全策略在 `apps/web/src/csp.ts`，并由 `apps/web/public/_headers`、`deploy/web/nginx/security-headers.conf` 重复：

- `script-src 'self'`，没有 `unsafe-inline`，没有 `unsafe-eval`。
- `style-src 'self'`。内联样式属性允许（`style-src-attr 'unsafe-inline'`），内联样式表不允许。
- `connect-src` 只有自身和 `https://api.deepseek.com`。
- `img-src` 含 `https://cdn.deepseek.com`。这是样式外带数据时要特别看住的地址。
- `font-src` 只有自身和 `data:`。

`apps/web/public/sw.js` 只处理同源 GET。其它来源直接放过，因此它不会缓存 DeepSeek，也不会缓存将来的分享域名。它现在对同源 GET 是「有缓存就用缓存」。用户样式如果走一个同源地址，必须在这个 service worker 里单独处理，不能落到这套缓存逻辑里。

存储分两个库（`packages/storage/src/indexeddb.ts`）：

- `harbor`：对话、消息、墓碑、设置。设置在对象库 `kv`，键 `settings`。
- `harbor-secrets`：只有 API Key。口令封装用 PBKDF2-SHA-256（60 万次）和 AES-256-GCM（`packages/storage/src/secret.ts`）。

界面包只进 `harbor`。读取和写入 Key 的代码路径不接受界面包。

Android / iOS 是同一套页面的 Capacitor 壳。公开站的策略不放宽；安装包里的那份副本把 `connect-src` 放宽到 `https:`（见 `docs/decisions.md` 第 16 条）。界面包在壳里走同一套本地规则。

## 区域

区域是稳定名字，写在 DOM 的 `data-slot` 上。样式和布局只认这些名字，不认 class。

实现时给下面这些节点补上 `data-slot`。补属性不改变外观，也不改变测试矩阵。这一步要等当前官方对齐合并之后再做，避免两处同时改 `ui.tsx`。

| 名字 | 现在的节点 | 可否被界面包改 |
| --- | --- | --- |
| `sidebar` | `aside.sidebar` | 可以。宽度只在宽于 767px 时生效 |
| `sidebar.brand` | `.brand-name` | 可以改颜色和间距。文字「Harbor for DeepSeek」保持原样 |
| `sidebar.new-chat` | `.new-chat` | 可以 |
| `sidebar.list` | `.side-scroll` | 可以 |
| `sidebar.user` | `.user-bar` | 可以 |
| `stage` | `section.stage` | 可以 |
| `stage.topbar` | `header.topbar` | 可以 |
| `stage.transcript` | `.transcript` | 可以 |
| `stage.home` | `.home` | 可以 |
| `stage.composer` | `.composer` | 可以 |
| `stage.disclaimer` | `.ai-note` | 不可以隐藏、不可以改文字 |
| `stage.jump` | `.jump-end` | 可以 |
| `message` | `article.turn` | 可以 |
| `message.user` | 用户气泡 | 可以 |
| `message.assistant` | 助手正文 | 可以 |
| `message.thinking` | `.thinking` | 可以 |
| `message.actions` | `.action-row` | 可以改外观。六个操作都还在 |
| `message.sources` | 来源药丸 | 可以 |
| `search.dialog` | `.search-dialog` | 可以 |
| `search.panel` | `.search-panel` | 可以 |
| `settings` | `.settings-shell` | 可以改外观。四个页的结构和数据操作保持原样 |
| `gate` | `.landing` | 不可以。钥匙页在主壳外面 |
| `gate.footer` | `.site-footer` | 不可以。商标和「非 DeepSeek 官方」的说明保持可见 |

锁定的理由：钥匙页上有 Key；免责声明是测试矩阵第 47 行，也是对用户的提示；页脚是项目身份，不能被一份共享来的样式涂掉。

布局只提供下面这些取值。做不到的重排，模型在 `note` 里说明，客户端照常展示这句话，不发明新的 DOM。

| 字段 | 取值 | 默认 |
| --- | --- | --- |
| `sidebar.side` | `left`、`right` | `left` |
| `sidebar.widthPx` | 200 到 360 的整数 | `261` |
| `composer.place` | `bottom`、`top` | 有消息时在底部；空对话时仍在问候下方，这个不改 |
| `composer.maxWidthPx` | 560 到 960 的整数 | `840`（1023px 以下官方是 712，包里的值在该断点按比例缩小，且不超过屏宽） |

767px 以下侧栏仍是抽屉，宽度仍用抽屉规则，不用 `sidebar.widthPx`。440px 的表单规则保持。`prefers-reduced-motion` 仍把动效压到几乎为 0，这一条写在官方样式里，且不放进用户层，所以界面包改不掉。

## 界面包

一份包对应一个文件 `harbor-ui.json`。有图片时改成 zip：`manifest.json` 加 `assets/`。扩展名和 `format` 字段用来认文件，避免和对话归档（`format: "harbor"`，`packages/types` 里的 `NativeArchive`）混在一起。

```json
{
  "format": "harbor-ui",
  "schema": 1,
  "catalog": 1,
  "name": "暖色窄栏",
  "createdAt": "2026-11-19T00:00:00.000Z",
  "tokens": {
    "light": {
      "--dsw-specific-sidebar-fill": "#f6f0e8",
      "--dsw-alias-brand-primary": "#b4532a"
    },
    "dark": {
      "--dsw-specific-sidebar-fill": "#2a2420"
    }
  },
  "layout": {
    "sidebar": { "side": "left", "widthPx": 220 },
    "composer": { "place": "bottom", "maxWidthPx": 760 }
  },
  "css": "[data-slot=\"stage.composer\"] { border-radius: 20px; }",
  "assets": [],
  "scripts": "forbidden"
}
```

字段：

| 字段 | 规则 |
| --- | --- |
| `format` | 必须是 `harbor-ui` |
| `schema` | 包格式版本。本文是 `1`。应用比自己新的 schema 时拒绝，并提示先升级 Harbor |
| `catalog` | 区域名单版本。只增区域时加 1，旧包仍可用 |
| `name` | 1 到 40 个字符，展示用 |
| `tokens.light` / `tokens.dark` | 键必须在白名单里。值必须是颜色、长度或时间，见下文 |
| `layout` | 只接受上表那些字段。缺省字段用默认值 |
| `css` | 可空。上限 100 KB。经消毒和选择器改写之后才保存 |
| `assets` | 最多 4 个。每个最多 64 KB。只允许 png、jpeg、webp、gif |
| `scripts` | 必须是 `forbidden`。其它值一律拒绝 |

整包上限 256 KB。名字和 CSS 里拒绝看起来像 Key 的串（`sk-` 后接长随机串）。界面包本来就不该有 Key；这条是为了防止用户把 Key 写进「发给模型的说明」后再被存进包。

设计变量的白名单就是 `theme.css` 里已经存在、并且官方样式真的在读的那些 `--dsw-*` 和 `--ds-*`。再加两个布局变量，默认值与今天的字面量相同：

- `--sider-width: 261px`，桌面侧栏也改成读它（窄屏已经在读）。
- `--composer-max-width: 840px`，1023px 以下的 712px 改为在该断点使用 `min(712px, var(--composer-max-width))`。

白名单以外的变量名丢掉。值的语法：

- 颜色：`#rgb`、`#rrggbb`、`rgb()`、`rgba()`，以及 `transparent`。不接受 `color()`、`var()`、`url()`。
- 长度：`px`、`rem`、`em`，数值在该变量自己的上下限内。侧栏宽度不从这里走，走 `layout`。
- 时间：只允许白名单里的三个动效变量，范围 0 到 0.6s。

变量写在主壳节点上（`.shell`），用元素的 style 属性。这在现有策略下是允许的。不写到 `body` 上，这样钥匙页读不到用户的颜色。深色、浅色两套随 `data-ds-dark-theme` 切换，切换逻辑仍是现在的 `applyTheme`。

区域 CSS 由程序改写，不按原文插入：

1. 用 CSS 解析器解析。解析失败就拒绝。不用正则拼接。
2. 每条选择器前面加上 `[data-harbor-ui]`，并且必须碰到至少一个白名单里的 `[data-slot="..."]`。碰到 `html`、`body`、`:root`、`.landing`、`.site-footer`、`[data-locked]` 就拒绝整份包。
3. 包进 `@layer harbor-user { ... }`。官方样式表先声明这个层。层里的规则盖不过层外的规则。锁定区域在层外写上 `display`、`visibility`、`opacity`，并带 `!important`。
4. 拒绝这些写法：`url(`（除了下面的图片引用）、`@import`、`@charset`、`@namespace`、`expression(`、`behavior:`、`-moz-binding`、`javascript:`、HTML 片段、反斜杠转义出来的上述字样。
5. 允许的 at-rule 只有 `@media`（宽度、`prefers-color-scheme`、`prefers-reduced-motion`）和 `@supports`。`@font-face`、`@keyframes` 第一期不接受。动效用现有的三个时间变量就够。
6. 锁定区域上再拒绝：`display`、`visibility`、`opacity`、`content`、`font-size` 为 0、宽高为 0。免责声明和页脚因此不能被收成看不见。
7. 图片只允许写成 `url("asset:<文件名>")`。程序把它换成 service worker 提供的同源地址。文件名必须出现在 `assets` 里。

消毒后的 CSS 由页面写入 Cache Storage。service worker 对 `GET /ui/applied.css` 只回这份缓存，`Content-Type: text/css`，并带 `X-Content-Type-Options: nosniff`。这个路径不转发到网络，也不进 `harbor-shell-*` 那套静态缓存。页面用 `<link rel="stylesheet" href="/ui/applied.css">` 引用。地址是同源，`style-src 'self'` 不用放宽，也不需要 `unsafe-inline` 样式表。

没有界面包时，这个地址返回空样式表，`<link>` 可以不插入。

### 脚本

第一期的包没有脚本。`scripts` 不是 `forbidden` 就拒绝。zip 里出现 `.js`、`.mjs`、`.html`、`.svg` 也拒绝。SVG 能带脚本和外链，第一期连图标一起不做，用位图。

若以后真要脚本，另做一次决定。能接受的上限是：脚本跑在 `iframe` 里，`sandbox="allow-scripts"`，不带 `allow-same-origin`，因此拿不到本站的 IndexedDB、Cookie 和 Key；和主页面只通过事先定好的 `postMessage` 通信。默认安装仍不启用。本文不把这件事排进第一期。

共享来的包和自己生成的包走同一套校验。通过校验只说明它没有越出这套规则，不说明它好看，也不说明它没有用布局误导人去点错按钮。所以应用之前始终有预览。

## 保存在本机

`harbor` 库从版本 1 升到版本 2，新增对象库 `ui_packages`，键是包的 id。不改 `harbor-secrets`。设置对象也不塞进 `kv/settings`，避免和现有 `Settings` 类型缠在一起。

每条记录：

| 字段 | 含义 |
| --- | --- |
| `id` | 随机 id |
| `createdAt` | 写入时间 |
| `parentId` | 上一版。第一版为空 |
| `manifest` | 校验之后的包 |
| `source` | `model`、`import` 或 `reset` |
| `applied` | 当前正在用的那一版为 true，同时只有一版 |

最多保留 20 版。更旧的删掉。撤销是把 `applied` 挪回 `parentId`。恢复官方是把 `applied` 全部清掉，历史还在，直到用户在数据页里清空。清空只删 `ui_packages`，不动对话和 Key。

刷新后重新挂上已应用的那一版：先写变量，再让 service worker 准备好 `/ui/applied.css`，再插入 link。顺序放在画出主壳之前，避免先闪一下官方色再跳到用户色。钥匙页不挂这些变量。

## 预览、应用、撤销、导入导出

预览和正式应用用同一段程序。预览时前缀改成 `[data-harbor-preview]`，画在设置里的一块预览区，或盖在主壳上的一块标明「预览」的区域。预览不写 `applied`。

差异展示三块：变量（名字、原来的值、新值）、布局字段、CSS 的行级差异。页面展示消毒之后的 CSS。

按钮：

- **应用。** 写入新版本，标为 `applied`，主壳立刻换上。
- **放弃。** 预览关掉，已应用的版本不动。
- **撤销。** 回到 `parentId`。没有上一版时等于恢复官方。
- **恢复官方。** 清掉 `applied`。确认一次。
- **导出。** 下载 `harbor-ui.json` 或 zip。文件里没有 Key，没有对话。
- **导入。** 走同一套校验。先预览，再决定是否应用。校验失败时整份拒绝，不写一半。

数据页（现有「数据管理」）增加三行：当前界面包的名字、恢复官方、清空界面历史。对话的导出导入保持今天的行为，不把界面包塞进对话归档。

## 用对话改界面

入口放在设置的通用页，单独一项「改界面」。记录留在界面包历史里：不进入侧栏对话列表，不进入会随同步上传的消息表，也不进入下一次聊天的上下文。

用户输入一句自然语言，例如「侧栏窄一点，用暖色」或「输入框放到上面」。客户端把下面这些发给 DeepSeek，走现有的 `createClient().streamMessage`，地址仍是 `https://api.deepseek.com/anthropic/v1/messages`，`credentials: "omit"`，Key 仍只放在 `x-api-key` 头里：

- 区域名单和布局字段的允许值（短表，来自当前 catalog）。
- 变量白名单的名字，不附带整份 `theme.css`。
- 当前已应用的包（校验后的 JSON）。
- 用户这一句说明。
- 要求：只返回一个 JSON 对象，字段为 `note`、`tokens`、`layout`、`css`。做不到的部分在 `note` 里用用户的语言说明，其余字段仍要合法。

请求体里不放：API Key、口令、其它对话的正文、`deviceId`、余额。系统提示用用户界面的语言（现有设置会按中文或英文选择系统提示，这里沿用）。

模型默认用用户当前选的模型。设置里可以改成始终用 `deepseek-flash`，少花额度。这段用量仍走现有的本地 `usage` 累计，因为它本来就是一次普通的消息请求。DeepSeek 会看到这句说明和当前界面包。页面在发送前用一句话写明这一点。

客户端不依赖接口是否提供 JSON 模式，只从回复正文里取出第一个 JSON 对象，交给校验器。失败时把校验错误原文再发一轮，最多两轮。两轮仍失败就停，展示错误，不应用，也不把非法 CSS 存下来。

成功后进入上一节的预览。用户不点应用，主壳不变。

模型不接触分享服务。要分享时，用户对已经应用的那一版另点一次分享（见分享服务文档）。

## 官方界面更新之后

两套版本号分开，就是为了少误伤旧包。

| 变化 | 版本 | 旧包 |
| --- | --- | --- |
| 包的字段含义变了，旧文件不能原样读 | `schema` 加 1 | 本机先跑迁移再应用。没有迁移就拒绝，并保留文件供导出 |
| 只增加区域或变量 | `catalog` 加 1 | 照常应用。新区域用官方外观 |
| 区域改名 | catalog 附一份改名表 | 导入时改写 `data-slot` 和 CSS 里的名字，并在预览里列出改了什么 |
| 区域删除 | catalog 注明删除 | 丢掉只指向该区域的规则，预览里警告。其余照常应用 |
| class 改名、像素微调 | 两个版本都不加 | 包不受影响，因为不依赖 class |

迁移是本机的一张表（旧名字到新名字），随 Harbor 发版，不由模型生成。

默认外观的回归仍是测试矩阵。界面包的测试另加，且只在「没有包」和「一份固定的样例包」上跑：

- 没有包：现有矩阵全部保持，尤其是侧栏 261px、三条动效、免责声明、深浅色。
- 样例包：发送仍可用，免责声明仍可见，钥匙页外观与无包时相同，非法样例被拒绝。

共享来的包不要求像素对齐官方。

## 和分享、自托管的边界

界面包可以导出成文件，也可以经 [分享服务](share-service.md) 发出去。分享是另一次明确操作。改界面的请求不去 `hfd.linkos.io`。

自托管服务器（`apps/server`，Postgres，邀请账号，Key 池）不保存、不同步界面包。服务器模式和本地模式用同一套浏览器存储。换浏览器就重新导入，这和今天「本地模式的对话不自动离开这台设备」一致。

公开站 `hfd.linkos.org` 继续只发静态文件。界面包不经过它。
