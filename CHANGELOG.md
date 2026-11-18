# Changelog

## 0.2.0 — 2026-11-18

Optional self-hosted server. `docker compose up` needs no environment variables and opens a setup wizard. Admins keep an encrypted key pool, official balances, a 50 CNY in-app alert, invite codes, and daily quotas. Logged-in browsers chat through the pool and can sync. On-device mode remains the default on the public static site.

## 0.1.0 — 2026-11-18

First release of the M1 static web app.

- On-device API key, optional passphrase, and conversations in IndexedDB.
- Streaming chat against the official Messages API, with reasoning, search, link reading, file upload (default 7-day expiry), and automatic titles.
- Models: `deepseek-flash` and text-only `deepseek-v4-pro`.
- `safety_check` level `high` by default.
- Per-chat and total usage estimated from `message_delta.usage`, plus official balance from `GET /user/balance`.
- JSON export/import (lossless, merge by id) and a v3 ZIP for the official archive shape.
- Chinese and English interface, installable as a PWA, static build with CSP, SRI, and `SHA256SUMS`.

Not in this release: the self-hosted server, sync, Android, and iOS.
