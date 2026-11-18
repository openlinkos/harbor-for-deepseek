# Contributing

Harbor for DeepSeek is a chat client for the DeepSeek API. Issues and pull requests are welcome. Please keep the project easy to trust:

- Do not open an issue or pull request that contains an API key, a passphrase, or a private conversation. If a key leaked, revoke it on the DeepSeek platform first, then use the private security flow in [SECURITY.md](SECURITY.md).
- The visible product name is **Harbor for DeepSeek**. Do not claim that it is official, partnered, authorized, or certified, and do not use the word 平替. The short launcher label may stay Harbor.
- Do not add the DeepSeek whale, the DeepSeek logo, or a domain that contains `deepseek`.
- `safety_check` stays on (`high`) by default.
- Tests and CI must keep using mocked API responses. Do not put a real key in a workflow.

## Setup

Node.js 22 and pnpm 10.

```bash
pnpm install
pnpm dev
```

`pnpm dev` serves the web app at <http://127.0.0.1:5173>. The browser calls `https://api.deepseek.com` directly.

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm e2e
```

`pnpm build` writes a static site to `apps/web/dist`, with Subresource Integrity attributes, `LICENSE`, `NOTICE`, and `SHA256SUMS`.

## Layout

- `apps/web` is the M1 app.
- `packages/` holds the API client, SSE reducer, types, storage, archives, pricing, and copy.
- `apps/server` and `apps/mobile` are reserved for later milestones. Do not start those implementations inside an M1 fix unless the issue asks for it.

Pull requests need a short description of what changed and why. A review is not required from a second maintainer yet, but `master` should only move through a pull request whose CI is green.
