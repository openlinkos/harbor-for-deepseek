# Changelog

## 0.5.4 — 2026-11-18

The sidebar wordmark is one line: Harbor for DeepSeek. The mark is two interlocking rings in the OpenLinkOS geometry. Buttons, links, and chips use the OpenLinkOS blue. A small footer sits under the user row. The chat column does not carry a disclaimer.

## 0.5.3 — 2026-11-18

The sidebar mark is followed by Harbor, with “for DeepSeek” in smaller secondary type on the next line. The document title and the install name match. Launcher labels stay Harbor.

## 0.5.2 — 2026-11-18

The lightweight footer says 本地模式 / Local mode. A nickname replaces that label and leaves 本地模式 as the subtitle. Server accounts show 服务器模式 / Server mode.

## 0.5.1 — 2026-11-18

Phone menu icon is a 24px mark in a 44px target. Search result cards use a letter-circle favicon, a muted site row, and a plain dark title.

## 0.5.0 — 2026-11-18

Phone layout. Below 768px the chat matches the official phone screen: a short top bar, a docked input, a left drawer, and bottom sheets for sources and settings. A nickname in Settings replaces the local-mode label.

## 0.4.0 — 2026-11-18

iOS shell. The same Capacitor app builds an unsigned simulator binary on a macOS runner. TestFlight stays a manual archive from a maintainer’s Apple Developer account. No signing secret is stored in the repo.

## 0.3.0 — 2026-11-18

Android shell. Capacitor wraps the same web app. The key and chats stay on the device, and chat goes to `https://api.deepseek.com` until you type a self-hosted Harbor address and log in with a bearer token. Sync stays opt-in. Pull requests upload a debug APK. A `v*` tag attaches an APK to the GitHub Release, signed only when the keystore secrets are set.

## 0.2.2 — 2026-11-18

The chat screen follows the layout of the official DeepSeek chat: a light sidebar, a centered column, pale-blue user bubbles, pill chips, and light, dark, and system themes. The Harbor mark replaces any other logo. Color tokens and several component styles are adapted from the MIT chat-demo.

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
