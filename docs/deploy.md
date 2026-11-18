# Deploy the static site

Harbor M1 is a static site. The browser talks to `https://api.deepseek.com`. Do not put an API reverse proxy on the same host, and do not add a form that submits the key to your server.

The intended public URL is <https://hfd.linkos.org>. DNS and the machine that serves the files are left to the maintainers.

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

`deploy/Caddyfile` is an example. Repeat the same Content-Security-Policy as the meta tag in `apps/web/src/csp.ts`. Also send:

- `Strict-Transport-Security`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer`
- `X-Frame-Options: DENY`

Serve only the files in `dist`. Access logs on the host will see page loads, not keys and not chat bodies.

## Check a deploy

1. Open the site. The footer must say: 非官方社区项目，与深度求索无隶属或合作关系 / Unofficial community project, not affiliated with DeepSeek.
2. Save a key. In the network panel, the chat request goes to `https://api.deepseek.com/anthropic/v1/messages` and not to the site host.
3. Confirm the request JSON contains `"safety_check":{"level":"high"}`.
4. Export JSON and confirm the file has no key.

## If the API stops sending CORS headers

The app will fail in the browser. A stateless proxy is not part of M1. Document the failure and point people at a future native build or at their own server. Do not quietly add a proxy on `hfd.linkos.org`.
