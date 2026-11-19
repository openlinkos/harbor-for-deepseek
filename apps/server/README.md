# DeepAPI server

Server mode. Postgres is the database.

```bash
cp .env.example .env
docker compose up -d
```

[English](../../docs/self-hosting.md) · [中文](../../docs/self-hosting_cn.md)

The process listens on port 8080 and serves the web app plus `/api`. API keys stay on the server.
