# Self-hosting Harbor

Harbor for DeepSeek’s public site is only the static on-device app. This server is optional. Run it for yourself and people you invite. It is not a public proxy.

## Start

From the repository:

```bash
docker compose pull
docker compose up -d
```

Compose pulls `ghcr.io/openlinkos/harbor-for-deepseek` (and Postgres). It does not build the image unless you pass `--build`. No environment variable is required. The first start writes a database password and a 32-byte encryption key into the `harbor_data` volume. Open <http://localhost:8080>. The first page creates the admin account. Then add one or more DeepSeek API keys in the admin screen. Keys are encrypted at rest and are never sent back to the browser.

Create an invite code and give it to a friend. They register on the same address. Chat from a logged-in browser uses the key pool. The on-device mode is still available from “Use a key on this device” and does not call the server.

Two browsers logged in as the same user can use “Sync from the server”. Copying chats that already live on a device is a separate button and does not run by itself.

The Android app can type this server’s address and log in with the bearer token returned by login. The server sends CORS headers only for an admin-edited origin list (default `capacitor://localhost`, `https://localhost`, `http://localhost`). The public static site never calls an arbitrary server. See [android.md](android.md).

Uploaded files expire on the official side after 7 days.

## Optional environment variables

| Variable | Purpose |
|---|---|
| `PORT` | Listen port. Default `8080`. |
| `DATA_DIR` | Volume for the encryption key and, when Compose generates it, the database password. Default `/data`. |
| `DATABASE_URL` | Use an existing Postgres database instead of the generated password. |
| `POSTGRES_PASSWORD` | Set the Compose database password instead of generating one. |
| `DB_HOST` | Database hostname. Default `db` on the Compose network. |
| `KEY_ENCRYPTION_SECRET` | 32 bytes, or 64 hex characters, instead of `DATA_DIR/master.key`. Changing it makes stored keys unreadable. |
| `DEEPSEEK_API_ORIGIN` | Upstream API origin. Default `https://api.deepseek.com`. |
| `STATIC_DIR` | Built web files. The image sets `/app/public`. |
| `PUBLIC_URL` | The address you tell people to open. Not required for cookies on the same host. |
| `TRUST_PROXY` | Set to `1` behind a TLS proxy so the session cookie is marked Secure, and so HSTS is sent when `X-Forwarded-Proto` is `https`. |
| `HARBOR_HSTS` | Set to `1` to send HSTS on every response, including plain HTTP. Otherwise HSTS is sent only for HTTPS requests. |
| `LOG_LEVEL` | Accepted for operators. Logs never include keys, passwords, or session tokens. |

## Quotas, balance, and failover

Each person defaults to 2,000,000 tokens, 100 billed searches (`tool_search` plus `tool_image_search`), and 80 file pages per Shanghai calendar day. The admin can change those numbers. There is no official usage API. The ledger uses `message_delta.usage` only.

The pool prefers active keys with a lower priority number, then the one least recently used. A 401 marks that key as an error. A 402 or an unavailable balance marks it exhausted. A 429 tries a key in a different account group. Keys from the same DeepSeek account share a balance, so give them the same account group or failover will not help. A balance under 50 CNY raises an in-app alert. The admin can change that threshold.

`safety_check` is `high` on every proxied chat. The system prompt includes the current date and time (Asia/Shanghai unless the browser sends another zone) so questions about today are not a guess.

The server sends the same security headers as the public site: `nosniff`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`, and the Content-Security-Policy as a real header (`frame-ancestors` is not left only in a meta tag). HSTS is included when the request is HTTPS, when `TRUST_PROXY=1` and `X-Forwarded-Proto` is `https`, or when `HARBOR_HSTS=1`.

## Backup and upgrade

Back up both volumes. `harbor_data` contains the encryption key. Without it, the database’s API keys cannot be decrypted. `pgdata` is the database.

```bash
docker compose stop
docker run --rm -v harbor_harbor_data:/data -v "$PWD":/backup alpine tar czf /backup/harbor-data.tgz -C /data .
docker run --rm -v harbor_pgdata:/data -v "$PWD":/backup alpine tar czf /backup/harbor-pg.tgz -C /data .
docker compose start
```

Volume names depend on the Compose project directory. `docker volume ls` shows the exact names.

To upgrade, pull the new image and start again. The schema uses `CREATE TABLE IF NOT EXISTS` and keeps existing rows.

```bash
docker compose pull
docker compose up -d
```

Build the image yourself with `docker compose build` if you are not using `ghcr.io/openlinkos/harbor-for-deepseek`.

## What this process stores

Account passwords are hashed with scrypt. API keys are AES-256-GCM. Session tokens are stored as SHA-256 hashes. Cookie writes need the CSRF header returned at login. Login and registration are rate limited. The browser on this origin does not receive the upstream key.
