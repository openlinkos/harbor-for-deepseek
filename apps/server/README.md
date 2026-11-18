# Harbor server

Optional self-hosted backend. Postgres is the only database.

```bash
docker compose up
```

No environment variable is required. The wizard, key pool, invites, quotas, and sync are described in [docs/self-host.md](../../docs/self-host.md) and [docs/self-host.zh-CN.md](../../docs/self-host.zh-CN.md).

The image listens on port 8080 and serves the web app plus `/api`. Upstream keys stay on the server.
