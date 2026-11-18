# Harbor

非官方社区项目，与深度求索无隶属或合作关系。

Harbor 是面向 [DeepSeek 官方 API](https://platform.deepseek.com/) 的开源（MIT）对话客户端。你使用自己的 Key。Key 和对话都留在这台浏览器里。页面是静态的：它们不会发给 Harbor，`https://hfd.linkos.org` 也不运行对话后端。

Harbor 是 openlinkos 社区开发的非官方开源项目，与杭州深度求索人工智能基础技术研究有限公司（DeepSeek）无隶属、合作或授权关系。DeepSeek 是其所有者的商标，本项目仅用以说明所兼容的 API。

![Harbor，思考过程展开](docs/screenshots/03-reasoning.png)

## 功能

- 流式对话，模型为 `deepseek-flash` 与 `deepseek-v4-pro`，可显示思考过程。
- Flash 上可用：联网搜索、读链接、文件上传（官方侧默认 7 天后过期）、自动标题。
- 多个对话，重命名、删除、停止、重新生成（保留为分支）。
- Markdown、代码高亮、KaTeX 公式、Mermaid。
- 中文和英文界面，手机上可用，可安装为 PWA。
- 按流式响应里的 `usage` 估算每个对话和全部对话的用量，并用 `GET /user/balance` 显示官方余额。官方没有用量历史接口。
- `safety_check` 默认 `high`。
- 导出自有 JSON（带版本号）。导入按对话 id 合并，不覆盖已有对话。v3 ZIP 按官方归档的形状交换它能表达的字段。

自部署服务器（Docker、PostgreSQL、Key 池、邀请账号、同步）以及 Android、iOS 是后面的里程碑，这一版没有。说明见 [docs/decisions.md](docs/decisions.md)。

## 隐私

| | |
|---|---|
| Key | 存在这台设备的 IndexedDB。可以设口令（PBKDF2-SHA-256 + AES-256-GCM）。不进 `localStorage`，也不进网址。 |
| 对话 | 存在这台设备的 IndexedDB。 |
| 请求 | 浏览器直连 `https://api.deepseek.com`，`credentials: "omit"`。 |
| 这个网站 | 只有静态文件。没有账号，没有统计。 |

浏览器里的 Key 可能被恶意扩展或脚本注入读到。开放平台协议要求不要把 Key 放进客户端。使用公开页面时，建议用设了额度的专用 Key。细节见 [SECURITY.md](SECURITY.md)。

对话会发给 DeepSeek，并由对方生成回复。Harbor 不代替你做备案或内容标识。

## 快速开始

需要 Node.js 22 和 pnpm 10。

```bash
pnpm install
pnpm dev
```

打开 <http://127.0.0.1:5173>，填入 <https://platform.deepseek.com/api_keys> 的 Key，然后发送消息。

```bash
pnpm build   # 静态文件在 apps/web/dist
pnpm preview
```

静态站的部署，包括 Cloudflare Pages，见 [docs/deploy.md](docs/deploy.md)。

## 自托管

`docker compose up` 会启动 Postgres 和同一个应用容器，不需要先写环境变量。第一页创建管理员，然后添加 API Key、邀请码和每人每天的额度。朋友在这个地址登录。可选变量、备份和升级见 [docs/self-host.zh-CN.md](docs/self-host.zh-CN.md)。镜像发布到 `ghcr.io/openlinkos/harbor-for-deepseek`。

如果官方 API 以后不再返回 CORS 头，静态页面会无法直连。这一版没有代理。不要在公开站点上悄悄加一个。

## 开发

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm e2e
```

测试使用模拟的 API 响应，结构来自设计说明里脱敏后的样例。不要把 Key 提交进仓库。

界面是重新做的。协议行为和 v3 归档参照公开 API，以及 [deepseek-ai/chat-demo](https://github.com/deepseek-ai/chat-demo)（MIT，`Copyright (c) 2026 DeepSeek`）文档中的归档结构。该许可证在 [NOTICE](NOTICE)。MIT 不授予商标权。

## 许可证

[MIT](LICENSE) © 2026 OpenLinkOS
