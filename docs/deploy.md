# Deploy the static site

DeepAPI is a static site. The browser talks to `https://api.deepseek.com`. Do not put an API reverse proxy on the same host, and do not add a form that submits the key to your server.

The intended public URL is <https://deepapi.linkos.org>. DNS and the machine that serves the files are left to the maintainers.

## Build

```bash
pnpm install --frozen-lockfile
pnpm build
```

The site is `apps/web/dist`.

- `index.html` script and stylesheet tags carry Subresource Integrity hashes.
- `LICENSE` and `NOTICE` are copied in, including the chat-demo copyright notice.
- `SHA256SUMS` lists every file. Compare it when you update the host.
- `404.html` is a copy of `index.html`. The app does not use path routing, so a static file server does not need a SPA fallback for normal use.

Publish the checksums next to the files, or attach `apps/web/dist` from the **Static site** GitHub Actions workflow (manual run, or a `v*` tag).

## Headers

`deploy/Caddyfile` is an example for a host you run yourself. Repeat the same Content-Security-Policy as the meta tag in `apps/web/src/csp.ts`. Also send:

- `Strict-Transport-Security`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer`
- `X-Frame-Options: DENY`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

Serve only the files in `dist`. Access logs on the host will see page loads, not keys and not chat bodies.

## Cloudflare Pages

The public site is hosted on Cloudflare Pages. Pages does not read `deploy/Caddyfile`. The same headers are in `apps/web/public/_headers`, and Vite copies that file to `apps/web/dist/_headers`.

Project settings:

| Setting | Value |
|---|---|
| Root directory | repository root |
| Build command | `pnpm install --frozen-lockfile && pnpm build` |
| Build output directory | `apps/web/dist` |
| Functions | none. Do not add a Pages Function, and do not proxy `api.deepseek.com`. |

Node.js 22. No environment variables. After a deploy, the response for `/` should include `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, the Permissions-Policy above, and the Content-Security-Policy from `apps/web/src/csp.ts`. Pages cannot strip the `Server` header the way the Caddy example does.

## Check a deploy

1. Open the site. The chat column has no disclaimer under the composer. The small print is at the bottom of the sidebar: OpenLinkOS attribution, links, and “DeepSeek is a trademark of its owner. This project is not affiliated with DeepSeek.”
2. Save a key. In the network panel, the chat request goes to `https://api.deepseek.com/anthropic/v1/messages` and not to the site host.
3. Confirm the request JSON contains `"safety_check":{"level":"high"}`.
4. Export JSON and confirm the file has no key.

## If the API stops sending CORS headers

The app will fail in the browser. A stateless proxy is not part of M1. Document the failure and point people at a future native build or at their own server. Do not quietly add a proxy on `deepapi.linkos.org`.
