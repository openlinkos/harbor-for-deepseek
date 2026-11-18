# Changelog

## 0.2.1 — 2026-11-18

Fixes from a live test of the self-hosted server.

- A finished chat no longer crashes the process when the run stream’s ping timer fires. One stream error is logged and does not exit the process.
- The system prompt includes the current date and time. The Chinese interface uses a Chinese prompt, and reasoning is asked to follow the user’s language.
- Server mode updates the all-chats total on the device that sent the message. Settings there show the daily quota instead of an on-device key and a missing balance.
- The admin screen can edit the balance alert threshold, shows translated quota fields, and lists per-user, per-key daily usage. Usage days are `YYYY-MM-DD` in Asia/Shanghai.
- The server sends the public site’s security headers. HSTS is sent for HTTPS, or when `HARBOR_HSTS=1`.
- Search results start collapsed. A trailing `。` stays in the sentence.
- `docker compose pull` is the documented way to get the image from ghcr.io.

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
