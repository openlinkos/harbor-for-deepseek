# Self-hosting DeepAPI

Server mode keeps the API keys on this machine. Local mode stays in the browser and does not call this server.

## Quick start

```bash
cp .env.example .env
openssl rand -hex 24    # POSTGRES_PASSWORD
openssl rand -hex 32    # KEY_ENCRYPTION_SECRET
```

Set those two values in `.env`, plus `ADMIN_USERNAME` and `ADMIN_PASSWORD`. Then:

```bash
docker compose up -d
```

Open <http://localhost:8080> and log in with that admin account. In the admin screen, add a DeepSeek API key and create an invite. The invited person registers on the same address. Two browsers logged in as the same user can sync.

After the first start, delete `ADMIN_PASSWORD` from `.env` and run `docker compose up -d` again. The account remains.

To choose the admin password in the request instead of `.env`, leave `ADMIN_USERNAME` empty and set `BOOTSTRAP_TOKEN` (at least 16 characters):

```bash
curl -sS -c /tmp/harbor.cookies -H 'content-type: application/json' \
  -d '{"username":"ada","password":"correct-horse","token":"YOUR_TOKEN"}' \
  http://localhost:8080/api/setup/admin
```

Remove `BOOTSTRAP_TOKEN` afterwards. The token works once.

`/healthz` answers while the process is up. `/readyz` also checks Postgres.

## Environment

Every variable is listed in [.env.example](../.env.example).

| Variable | Role |
|---|---|
| `POSTGRES_PASSWORD` | Database password. Use hex. |
| `KEY_ENCRYPTION_SECRET` | 32 bytes or 64 hex characters. Encrypts API keys at rest. |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | First admin, created once when no admin exists. |
| `BOOTSTRAP_TOKEN` | One-time setup token, if you do not set the admin variables. |
| `HARBOR_PORT` | Host port. Default `8080`. |
| `DEEPSEEK_API_ORIGIN` | Upstream origin. Default `https://api.deepseek.com`. |
| `CORS_ORIGINS` | Comma-separated origins. No `*`. |
| `TRUST_PROXY` | `1` behind the proxies below. |
| `COOKIE_SECURE` | `auto`, `1`, or `0`. |
| `HARBOR_HSTS` | `1` sends HSTS on every response. |
| `LOG_LEVEL` | `info`, `warn`, or `error`. |
| `INVITE_TTL_HOURS` | Invite lifetime. Default `168` (7 days), maximum `720`. |

`ALLOW_OPEN_SETUP=1` lets the first visitor become admin. Leave it unset.

## Reverse proxy

Set `TRUST_PROXY=1`, `COOKIE_SECURE=auto`, and `CORS_ORIGINS` to the public origin (`https://harbor.example.com`). The proxy must set `X-Forwarded-For` to the client address and `X-Forwarded-Proto` to `https`.

Caddy ([deploy/Caddyfile.self-host](../deploy/Caddyfile.self-host)):

```caddy
harbor.example.com {
	reverse_proxy 127.0.0.1:8080
}
```

Nginx ([deploy/nginx.self-host.conf](../deploy/nginx.self-host.conf)). `proxy_buffering off` keeps the chat stream moving:

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

Publish only the proxy, not port 8080, on a reachable host.

## Upgrade

```bash
docker compose pull
docker compose up -d
```

The image runs database migrations on start. Running them again does not remove accounts or keys. A local build is `docker compose up -d --build`.

The Compose project name is `harbor`, so the database volume is `harbor_pgdata`. A volume created before that name was set is listed by `docker volume ls`. Point `COMPOSE_PROJECT_NAME` at the old project, or restore a dump into the new volume.

An older compose file wrote `master.key` and `db-password` onto a data volume. This version reads neither file. Before upgrading, copy those values into `.env` as `KEY_ENCRYPTION_SECRET` (the 32 bytes in hex) and `POSTGRES_PASSWORD`.

Images are published to `ghcr.io/openlinkos/deepapi` for `linux/amd64` and `linux/arm64`.

## Backup and restore

Back up `.env` with the dump. `KEY_ENCRYPTION_SECRET` is not inside Postgres. Without it, the API keys in the dump cannot be decrypted.

```bash
docker compose exec -T db pg_dump -U harbor -d harbor -Fc > harbor.dump
```

Restore:

```bash
docker compose stop deepapi
docker compose exec -T db pg_restore -U harbor -d harbor --clean --if-exists < harbor.dump
docker compose start deepapi
```

The database volume is `harbor_pgdata` when the Compose project name is `harbor`. `docker volume ls` shows the name if you changed it.

## FAQ

**Login succeeds in `curl` but the browser does not stay logged in.** Set `TRUST_PROXY=1` and make sure the proxy sends `X-Forwarded-Proto: https`. On plain HTTP, leave `COOKIE_SECURE` as `auto`.

**Stored API keys fail after a restart.** `KEY_ENCRYPTION_SECRET` changed, or `.env` was not the one used to encrypt them.

**An invite is rejected.** It is past `expiresAt`, already used, or revoked. Create another. New invites expire after `INVITE_TTL_HOURS` (7 days if unset).

**Chat returns "no API key is configured".** Add a key in the admin screen. A 401 from upstream marks that key as an error; a 402 marks it exhausted.

**`/readyz` returns 503.** Postgres is down or `DATABASE_URL` is wrong. `/healthz` can still return 200.

**Logs.** One JSON object per line. They omit message text, API keys, passwords, and session tokens.
