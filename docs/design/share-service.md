# 分享服务（hfd.linkos.io）

本文只定设计。服务还不存在，本仓库的页面和 `apps/server` 都不改。部署清单将来放在 `best/flux-k8s`，不放进 `deploy/web/k8s` 的静态站。

Harbor 的公开站 [hfd.linkos.org](https://hfd.linkos.org) 只发静态文件。Key 和对话留在浏览器里，浏览器直接请求 `https://api.deepseek.com`（见 [README.zh-CN.md](../../README.zh-CN.md)、[docs/decisions.md](../decisions.md)、[SECURITY.md](../../SECURITY.md)）。分享用另一个域名，避免这个静态站开始接收对话正文。

相关文档：[可替换的界面](ui-customization.md)、[里程碑](roadmap.md)。

## 已决定

1. 私密分享没有账号。创建时发一次性删除令牌。
2. 第一期只有私密链接。公开列表以后再做。
3. 对话和界面包默认不加密。隐私靠猜不到的链接：128 位随机 id、页面 `noindex`、可选过期、可选口令。取舍见下一节。
4. 服务跑在现有的 prod-us 集群上，由 Flux（`best/flux-k8s`）发布，入口是 GoEdge，域名 `hfd.linkos.io`。Cloudflare 只做 DNS，记录不走代理，CNAME 到 GoEdge 的 `70c9d096.quic.ing`。证书在 GoEdge 上，由 GoEdge 自动续期。源站是 prod-us 的 Ingress。不用 Workers、R2、D1、KV。
5. 聊天页只有在用户确认分享之后才连接 `hfd.linkos.io`。

## 这是哪一类问题

本地优先的应用要多一个「我明确点了才上传」的发布动作。第一期只做私密链接：id 是 128 位随机数，没有链接就找不到这份内容。链接会过期（若用户设了过期），也可以再加一道口令。

公开列表是以后的事。到那时内容要能被审核，那一批会单独做，不进第一期的接口。

Harbor 的约束不变：不上传是默认；上传的那一次不带 Key；静态站的对话请求仍然不经过这个服务。

自托管服务器（`apps/server`）用 Postgres、邀请码和管理员放入的 Key 池，给一小群人同步自己的对话。分享服务面向任意访客的上传，使用单独的库和单独的进程。

## 取舍

默认分享的正文以明文存在 prod-us 的磁盘上。

- 拿到 `https://hfd.linkos.io/s/<id>` 的人可以阅读全文，也可以再复制走。
- 能登录这台机器、能读这份备份的人，也可以阅读全文。运营者看得到用户主动分享出去的内容。
- id 有 128 位，不递增，不使用短地址。猜中一条现有链接在计算上不成立。页面和接口都带 `X-Robots-Tag: noindex, nofollow`，`robots.txt` 禁止抓取，没有站点地图。这挡的是搜索引擎，不是拿到链接的人。
- 可选过期：到期后接口返回 404，定时清理会删掉正文。用户可以不设过期，链接就一直留到被删除。默认给 30 天，避免一份分享在无人过问时永远留在磁盘上。
- 可选口令：接收方除了链接还要再输入口令，服务器用慢哈希核对。没有口令的人即使有链接也拿不到正文。口令本身不入库，入库的是哈希。正文仍然是明文，所以口令挡不住持有磁盘的人。
- 端到端加密能让磁盘上只剩密文。这一期不这么做。上面几条就是这一期的隐私边界。

客户端仍拒绝把 Key 形状的字符串传上去。对话正文是单条对话的可见分支：角色、正文、用户勾选时的思考过程、搜索来源的标题和链接。不含文件字节（与 v3 归档不重新上传图片字节一致）、不含计费明细、不含 `deviceId`。思考过程默认不包含，由勾选打开。

界面包的正文是校验后的 `harbor-ui.json`（或 zip）。接收方下载后仍走本地校验，先预览再应用。

## 本地优先怎么保住

已决定：聊天页的内容安全策略写上 `connect-src` 中的 `https://hfd.linkos.io`，但程序只有在用户确认分享之后才向该域名发请求。未确认时，网络记录里不出现这个域名。

步骤：

1. 用户在某一条对话或某一份界面包上点分享。
2. 页面说明将要上传的范围、链接到期时间、是否设置口令，并写明：正文会明文存在分享服务上，拿到链接的人可以阅读。
3. 用户确认后，浏览器才向 `https://hfd.linkos.io` 发送这一份正文。
4. 取消之后不再上传。没有后台同步。

请求从内存里的那一条对话或那一份界面包组出来。不读 `harbor-secrets`。导出现有 JSON 归档时已经会去掉 Key（`SECURITY.md`）；分享走同一条过滤。

服务端模式不会把对话自动镜像到这个服务。第一期只做网页，不为 Android / iOS 壳加分享入口。

`apps/web/public/sw.js` 对其它来源的请求直接放过，所以它不会缓存分享服务上的正文。

## 账号

已决定：第一期没有账号。创建响应里给一次删除令牌。令牌是 128 位随机数，库里只存它的 SHA-256（与 `apps/server` 保存会话令牌的方式相同）。页面把令牌写进 `harbor` 库的 `shares` 记录，不写进 `harbor-secrets`。换掉浏览器又没留下令牌时，只能等过期，或由所有者用管理密钥删除。

## 接口

基址 `https://hfd.linkos.io`。没有 Cookie。第一期 CORS 只允许：

- `https://hfd.linkos.org`
- `http://localhost` 与 `https://localhost`（开发）

不反射任意 `Origin`。自托管的 Harbor 若域名不在这张表里，用户导出文件后，在分享网站自己上传。那个页面和接口同源，不需要把每个自托管域名写进 CORS。

每个响应都带：

- `X-Robots-Tag: noindex, nofollow`
- `Referrer-Policy: no-referrer`
- `X-Content-Type-Options: nosniff`
- `Cache-Control: no-store`

`GET /robots.txt` 的正文是 `Disallow: /`。给人打开的页面 `/s/<id>` 另有 `<meta name="robots" content="noindex, nofollow">`。

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| `POST` | `/v1/shares` | 创建。返回 `id`、`deleteToken`、路径 `/s/<id>` |
| `GET` | `/v1/shares/:id` | 元数据。没有口令时连正文一起返回。过期和已删除都是 404 |
| `POST` | `/v1/shares/:id/open` | 正文是 `{ "password": "..." }`。口令对才返回正文。口令不进查询字符串 |
| `DELETE` | `/v1/shares/:id` | 头 `Authorization: Bearer <删除令牌>`。令牌不对是 404 |
| `POST` | `/v1/admin/shares/:id/delete` | 所有者下架。头是部署时配置的管理密钥 |

第一期没有列表接口。`visibility` 不是 `unlisted` 时返回 400。

创建正文：

```json
{
  "kind": "conversation",
  "visibility": "unlisted",
  "expiresAt": "2026-12-19T00:00:00.000Z",
  "password": "",
  "title": "",
  "sha256": "正文的哈希",
  "bytes": 12034,
  "payload": "base64"
}
```

`kind` 是 `conversation` 或 `ui`。`expiresAt` 可以省略，省略表示不过期。`password` 为空表示不设口令。口令只在这一次请求里出现，服务端算出 scrypt 哈希后丢掉原文。哈希算法与 `apps/server/src/crypto.ts` 的 `hashPassword` 相同，比较用 `timingSafeEqual`。

上限：对话 1 MB，界面包 256 KB（与界面包文档一致）。超过就 413。同一 id 口令错误累计 5 次后，这一小时内不再接受该 id 的口令尝试。

给人看的页面只向接口要数据，不把正文写进对方的对话库。对方若要留下，另选导入。

管理接口不放在 `hfd.linkos.org`，也不进 `apps/server` 的管理员页面。

## 存储

已决定放在集群里，不用 Cloudflare 的对象存储。

元数据和正文分开：

| 数据 | 放在 | 原因 |
| --- | --- | --- |
| id、kind、过期时间、删除令牌哈希、口令哈希、sha256、字节数、对象路径 | Postgres 数据库 `harbor_share`，表 `shares` | 要按过期时间删除，也要记限流计数。与 Harbor 自托管服务器一样只用 Postgres，不引入 SQLite |
| 正文 | 数据盘上的一个文件，路径按 id | 二进制，按文件删。不把最大 1 MB 的正文放进数据库行 |
| 限流计数、口令失败次数 | 同一 Postgres 里的小表 | 第一期只有一个副本，不必再加 Redis |

不使用 `apps/server` 的库，也不使用它的 `users` / `api_keys` 表。

Postgres 由这份服务自己带一个单副本。数据目录在 worker-us 的数据盘：`/data/storage/harbor-share/pg`。正文目录是 `/data/storage/harbor-share/objects`。这和「服务数据放数据盘、不放系统盘上的 compose 目录」一致。磁盘是 `hostPath`，所以 Pod 固定在持有这块盘的节点上，应用只有一个副本。卷是 ReadWriteOnce，清理过期记录的循环写在应用进程里，不另起一个要挂同一块卷的 CronJob。

id 用 128 位随机数的 base64url。不用自增数字。

## 滥用和限额

上传地址在公网上，会被扫。限额做两层，数字可以在上线时改，两层都要有。

GoEdge（这台主机的站点配置，和 Ingress 同一次变更）：

- 单个来源地址每分钟最多 30 次请求。Cloudflare 不代理这条流量，限流按 GoEdge 站点上看到的客户端地址计算。
- 请求体最大 2 MB。这比应用里的 1 MB 宽一点，给 JSON 和 base64 留余量。应用仍按上一节的字节数拒绝。

应用：

- 同一来源地址每小时最多创建 10 次，每天最多 30 次。
- 同一来源地址每分钟最多读取 60 次。
- 同一个 id 每分钟最多读取 30 次。
- 创建体只接受 JSON。应用只在连接来自集群入口时信任 `X-Forwarded-For` 里的客户端地址。直连 Pod 时用套接字上的地址。不读取 `CF-Connecting-IP`。

日志记方法、状态码、id 的前 4 个字符、字节数。不记正文、口令、删除令牌和 `Authorization` 头。来源地址只进入限流表，计数几小时后删掉。

## 删除

能删掉一份分享的途径：

1. 持有删除令牌的人调用 `DELETE`。
2. 到达 `expiresAt`。应用每小时扫一次到期行，删掉数据库行和对象文件。
3. 所有者用管理密钥删除。正文是明文，所有者可以在收到投诉或法律要求时直接删文件。

删除是去掉数据库行和对象文件。备份保留 7 天，见部署一节。备份里仍是明文。

设置的数据页已经有一行「我共享的链接」（`ui.tsx` 里 `t('sharedLinks')`）。现在点「管理」只会显示「没有共享链接」。实现时让这一行列出本机还存着删除令牌的分享。

## 隐私说明里要写清的点

上线前用一页普通中文放在 `hfd.linkos.io` 上，至少包括：

- 分享发生在 `hfd.linkos.io`。聊天页只有在你确认之后才上传。
- 我们不接收 DeepSeek 的 API Key。客户端会拒绝明显像 Key 的内容。
- 你分享的正文以明文存在我们的服务器和最多 7 天的备份里。拿到链接的人可以阅读。我们也能阅读。
- 口令是可选项。它挡住没有口令的访问者。它不会把正文变成我们读不到的密文。
- 过期和删除会从线上磁盘去掉。备份不超过 7 天。
- 不出售这些数据，不用它做广告。没有第三方统计脚本。
- 联系方式和管辖：所有者的邮箱，以及机器在 prod-us。

Harbor 仓库的 [SECURITY.md](../../SECURITY.md) 在实现时加一小节，指向这页，并写明 Key 不会发到 `hfd.linkos.io`。

## 部署

已决定：prod-us，Flux 仓库 `best/flux-k8s`，入口 GoEdge，域名 `hfd.linkos.io`。Cloudflare 账号与 `linkos.org` 相同，但只做 DNS，不代理、不缓存、不终结 TLS。

现有公开站的记录是：

```text
hfd.linkos.org.  CNAME  70c9d096.quic.ing.
```

这是 GoEdge CDN（`cdn-uspre.quic.ing`）。记录在 Cloudflare 上是「仅 DNS」。访客的 TLS 停在 GoEdge，证书由 GoEdge 管理并自动续期。集群里的 Ingress 是源站，不持有这张公网证书。

`hfd.linkos.io` 用同一套：

1. Cloudflare 上加一条仅 DNS 的 CNAME：`hfd.linkos.io` → `70c9d096.quic.ing`。不要打开代理。
2. 在 GoEdge 上新建一个站点，主机名 `hfd.linkos.io`，单独一张由 GoEdge 管理、自动续期的证书。
3. 该站点的源站是 prod-us 上这份服务的 Ingress。源站协议按现有 `hfd.linkos.org` 站点的源站写法，公网证书不放到 Ingress 上。

Cloudflare 不运行这份服务，也不存放正文。

GoEdge 是前面的 CDN 站点，不是集群里的 Ingress 类。分享服务单独一个 Deployment，不并进 `harbor-web`。它的 Kubernetes Ingress 用 prod-us 上 `harbor-web` 源站已经在用的那一个类（本仓库的 kustomization 写成 `nginx`），主机名是 `hfd.linkos.io`。GoEdge 站点把这个 Ingress 当作源站。

镜像沿用静态站的标签习惯：`ghcr.io/openlinkos/harbor-share`，主分支推送时打 `<YYYYMMDDHHmmss>-<sha7>`，供 Flux ImagePolicy 排序（见 `docs/deploy-web.md`）。实现时再加工具流；本文不添加工作流。

现金成本是这块数据盘上的空间。进程加在已经在跑的集群上。一个安静的分享服务，数据库和正文加起来远小于 1 GB。

### 对象

命名空间 `harbor-share`。

| 对象 | 作用 |
| --- | --- |
| Deployment `harbor-share` | 一个副本。听 8080。`/healthz` 只表示进程在。`/readyz` 同时检查 Postgres |
| Service `harbor-share` | 把 8080 交给 Ingress |
| Ingress `harbor-share` | 源站。类名与现有 `harbor-web` 源站相同。不写公网 `tls` |
| PersistentVolume + PVC `harbor-share-objects` | `hostPath`：`/data/storage/harbor-share/objects`。应用挂到 `/var/lib/harbor-share/objects` |
| StatefulSet `harbor-share-postgres` | 一个副本。数据在 `/data/storage/harbor-share/pg` |
| Secret | 数据库口令、管理密钥。不进 Git |
| 应用内的每日备份 | 写到 `/data/storage/harbor-share/backups`，保留 7 天 |

应用的资源请求大约 100m CPU、256Mi 内存，上限 500m、512Mi。静态站那档 32Mi 装不下 Postgres 客户端和正文缓冲。Postgres 大约 100m CPU、256Mi 内存。根文件系统对应用容器保持只读，可写的只有对象目录和 `/tmp`。镜像不以 root 运行。

Pod 用节点亲和性固定到持有 `/data/storage` 的那台 worker。

### Ingress 示意

这是源站对象。公网证书在 GoEdge 站点上，不写在这里。`ingressClassName` 与 prod-us 上 `harbor-web` 的源站一致。

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: harbor-share
  namespace: harbor-share
spec:
  ingressClassName: nginx # 与现有 harbor-web 源站相同；以 prod-us 上的实际值为准
  rules:
    - host: hfd.linkos.io
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: harbor-share
                port:
                  name: http
```

请求体大小和每分钟次数写在新建的 GoEdge 站点上，和这条 DNS 记录、这张证书一起提交。数值见「滥用和限额」。

### 备份

应用每天做两件事，写到数据盘的 `backups/YYYYMMDD/`：

1. `pg_dump` 数据库 `harbor_share`。
2. 把对象目录打成一个归档。

超过 7 天的目录删掉。恢复时先恢复数据库，再把对象归档解回 `/data/storage/harbor-share/objects`，然后核对每一行的 `object_path` 是否还有文件。备份含明文，目录权限与对象目录相同，不对集群里的其它命名空间开放。

## 和界面包的衔接

界面包能在本地导入导出之后，才从设置里生成私密链接。接收方打开链接，取到明文，用同一套校验器检查，预览，再应用。校验失败的包不进入 `ui_packages`。

## 以后

公开列表、举报后的公开展示、以及「谁都能翻到的画廊」不在第一期。第一期的下架只走删除令牌和管理密钥。那一批要做时再加表和接口，不改私密链接的 id 和删除方式。
