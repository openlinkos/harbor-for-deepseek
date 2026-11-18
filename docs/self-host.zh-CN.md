# 自托管 Harbor

公开站点只提供本机模式。这台服务器是可选的，给自己和受邀请的人用。它不是公共中转，也与深度求索没有隶属或合作关系。

## 启动

在仓库目录：

```bash
docker compose up -d
```

不需要任何环境变量。第一次启动会在 `harbor_data` 卷里写入数据库口令和 32 字节加密主密钥。打开 <http://localhost:8080>，首页创建管理员，然后在管理页添加一把或多把 DeepSeek API Key。Key 加密后落库，不会再发给浏览器。

生成邀请码给朋友。他们在同一个地址注册。登录后的对话使用 Key 池。仍然可以选「改用本机 Key」，那条路径不访问这台服务器。

同一个账号在两台浏览器上登录后，用「从服务器同步」。把已经在本机的对话复制上去是另一个按钮，不会自动发生。

上传的文件默认 7 天后在官方侧过期。

## 可选环境变量

| 变量 | 作用 |
|---|---|
| `PORT` | 监听端口，默认 `8080`。 |
| `DATA_DIR` | 存放加密主密钥；Compose 自动生成的数据库口令也在这里。默认 `/data`。 |
| `DATABASE_URL` | 改用已有的 Postgres，而不是自动生成的口令。 |
| `POSTGRES_PASSWORD` | 指定 Compose 的数据库口令，而不是自动生成。 |
| `DB_HOST` | 数据库主机名。Compose 网络里默认 `db`。 |
| `KEY_ENCRYPTION_SECRET` | 32 字节，或 64 位十六进制，用来代替 `DATA_DIR/master.key`。换掉之后，已保存的 Key 无法解密。 |
| `DEEPSEEK_API_ORIGIN` | 上游 API 地址，默认 `https://api.deepseek.com`。 |
| `STATIC_DIR` | 网页构建目录。镜像里是 `/app/public`。 |
| `PUBLIC_URL` | 你告诉别人打开的地址。同一台主机上的 Cookie 不依赖它。 |
| `TRUST_PROXY` | 设为 `1` 时，在 TLS 反向代理后面把会话 Cookie 标成 Secure。 |
| `LOG_LEVEL` | 供运维使用。日志不记录 Key、密码或会话令牌。 |

## 额度、余额和切换

每人默认每个北京时间自然日 200 万 token、100 次计费搜索（`tool_search` 加 `tool_image_search`）、80 页文件。管理员可以改。官方没有用量接口。账本只认 `message_delta.usage`。

Key 池先取优先级数字更小、且状态正常的，再取最久没用的。401 标成错误。402 或余额不可用标成耗尽。429 会换一个不同账户分组的 Key。同一个 DeepSeek 账户下的多把 Key 共用余额，所以它们应该填同一个账户分组，否则切换没有意义。余额低于 50 元会在管理页提醒。这个阈值可以改。

经服务器转发的对话一律带 `safety_check: high`。

## 备份和升级

两个卷都要备份。`harbor_data` 里有加密主密钥，没有它就解不开库里的 API Key。`pgdata` 是数据库。

```bash
docker compose stop
docker run --rm -v harbor_harbor_data:/data -v "$PWD":/backup alpine tar czf /backup/harbor-data.tgz -C /data .
docker run --rm -v harbor_pgdata:/data -v "$PWD":/backup alpine tar czf /backup/harbor-pg.tgz -C /data .
docker compose start
```

卷名跟 Compose 项目目录有关，用 `docker volume ls` 核对。

升级时拉新镜像再启动。表结构用 `CREATE TABLE IF NOT EXISTS`，不会清掉已有数据。

```bash
docker compose pull
docker compose up -d
```

不用 `ghcr.io/openlinkos/harbor-for-deepseek` 时，可以 `docker compose build` 自己构建。

## 这台进程保存什么

密码用 scrypt。API Key 用 AES-256-GCM。会话令牌只存 SHA-256。带 Cookie 的写操作要带登录时返回的 CSRF 头。登录和注册有速率限制。浏览器拿不到上游 Key。
