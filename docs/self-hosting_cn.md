# 自托管 DeepAPI

服务器模式把 API Key 放在这台机器上。本地模式只留在浏览器里，不访问这台服务器。

## 启动

```bash
cp .env.example .env
openssl rand -hex 24    # POSTGRES_PASSWORD
openssl rand -hex 32    # KEY_ENCRYPTION_SECRET
```

把这两个值写入 `.env`，并填写 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD`。然后：

```bash
docker compose up -d
```

打开 <http://localhost:8080>，用这个管理员账号登录。在管理页添加 DeepSeek API Key，并生成邀请码。对方在同一地址注册。同一账号在两个浏览器登录后可以同步。

第一次启动成功后，从 `.env` 删掉 `ADMIN_PASSWORD`，再执行 `docker compose up -d`。账号还在。

如果密码不想写在 `.env` 里，把 `ADMIN_USERNAME` 留空，设置至少 16 位的 `BOOTSTRAP_TOKEN`：

```bash
curl -sS -c /tmp/harbor.cookies -H 'content-type: application/json' \
  -d '{"username":"ada","password":"correct-horse","token":"你的令牌"}' \
  http://localhost:8080/api/setup/admin
```

用过一次就从 `.env` 删掉 `BOOTSTRAP_TOKEN`。

`/healthz` 表示进程在运行。`/readyz` 同时检查 Postgres。

## 环境变量

全部变量见 [.env.example](../.env.example)。

| 变量 | 作用 |
|---|---|
| `POSTGRES_PASSWORD` | 数据库口令。用十六进制。 |
| `KEY_ENCRYPTION_SECRET` | 32 字节或 64 位十六进制。加密保存的 API Key。 |
| `ADMIN_USERNAME`、`ADMIN_PASSWORD` | 还没有管理员时，启动时创建第一个管理员。 |
| `BOOTSTRAP_TOKEN` | 不使用上面两个变量时的一次性安装令牌。 |
| `HARBOR_PORT` | 主机端口，默认 `8080`。 |
| `DEEPSEEK_API_ORIGIN` | 上游地址，默认 `https://api.deepseek.com`。 |
| `CORS_ORIGINS` | 逗号分隔的来源。不能写 `*`。 |
| `TRUST_PROXY` | 使用下面的反向代理时设为 `1`。 |
| `COOKIE_SECURE` | `auto`、`1` 或 `0`。 |
| `HARBOR_HSTS` | `1` 时每个响应都带 HSTS。 |
| `LOG_LEVEL` | `info`、`warn` 或 `error`。 |
| `INVITE_TTL_HOURS` | 邀请码有效小时数。默认 `168`（7 天），最大 `720`。 |

`ALLOW_OPEN_SETUP=1` 会让第一个访问者成为管理员。不要设置。

## 反向代理

设置 `TRUST_PROXY=1`、`COOKIE_SECURE=auto`，并把 `CORS_ORIGINS` 写成对外地址（`https://harbor.example.com`）。代理需要把 `X-Forwarded-For` 设成客户端地址，把 `X-Forwarded-Proto` 设成 `https`。

Caddy（[deploy/Caddyfile.self-host](../deploy/Caddyfile.self-host)）：

```caddy
harbor.example.com {
	reverse_proxy 127.0.0.1:8080
}
```

Nginx（[deploy/nginx.self-host.conf](../deploy/nginx.self-host.conf)）。`proxy_buffering off` 让对话的流式输出继续往下传：

```nginx
server {
	listen 443 ssl;
	server_name harbor.example.com;
	ssl_certificate /etc/ssl/harbor.example.com.crt;
	ssl_certificate_key /etc/ssl/harbor.example.com.key;

	location / {
		proxy_pass http://127.0.0.1:8080;
		proxy_http_version 1.1;
		proxy_set_header Host $host;
		proxy_set_header X-Forwarded-For $remote_addr;
		proxy_set_header X-Forwarded-Proto $scheme;
		proxy_buffering off;
		proxy_read_timeout 1h;
	}
}
```

机器能被外网访问时，只公开代理端口，不要公开 8080。

## 升级

```bash
docker compose pull
docker compose up -d
```

镜像启动时会执行数据库迁移。再执行一次不会删账号或 API Key。本地构建用 `docker compose up -d --build`。

Compose 项目名是 `harbor`，数据库卷是 `harbor_pgdata`。改名之前创建的卷用 `docker volume ls` 查看。把 `COMPOSE_PROJECT_NAME` 设成旧项目名，或把转储恢复进新卷。

更早的 compose 把 `master.key` 和 `db-password` 写在数据卷里。这一版不读这两个文件。升级前把它们写入 `.env`：`KEY_ENCRYPTION_SECRET` 用那 32 字节的十六进制，`POSTGRES_PASSWORD` 用原来的数据库口令。

镜像发布在 `ghcr.io/openlinkos/deepapi`，包含 `linux/amd64` 和 `linux/arm64`。

## 备份与恢复

把 `.env` 和转储放在一起。`KEY_ENCRYPTION_SECRET` 不在 Postgres 里。没有它，转储中的 API Key 无法解密。

```bash
docker compose exec -T db pg_dump -U harbor -d harbor -Fc > harbor.dump
```

恢复：

```bash
docker compose stop deepapi
docker compose exec -T db pg_restore -U harbor -d harbor --clean --if-exists < harbor.dump
docker compose start deepapi
```

Compose 项目名是 `harbor` 时，数据库卷名是 `harbor_pgdata`。改过项目名就用 `docker volume ls` 核对。

## 常见问题

**curl 能登录，浏览器一会儿就掉线。** 设置 `TRUST_PROXY=1`，并确认代理发送了 `X-Forwarded-Proto: https`。明文 HTTP 时 `COOKIE_SECURE` 保持 `auto`。

**重启后已保存的 API Key 不能用。** `KEY_ENCRYPTION_SECRET` 换过了，或者 `.env` 不是当初加密时用的那一份。

**邀请码被拒绝。** 已过 `expiresAt`、用完或已作废。重新生成。新建邀请码在 `INVITE_TTL_HOURS` 后过期；不设置时是 7 天。

**对话返回 “no API key is configured”。** 在管理页添加 Key。上游返回 401 时这把 Key 标成错误，402 标成余额不足。

**`/readyz` 返回 503。** Postgres 没起来，或 `DATABASE_URL` 不对。这时 `/healthz` 仍可能返回 200。

**日志。** 一行一个 JSON。不记录消息正文、API Key、密码和会话令牌。
