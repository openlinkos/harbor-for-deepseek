# Deploy the public static site

This image is only the lightweight web app for `https://deepapi.linkos.org`. It does not include the self-hosted server. That image stays in `deploy/Dockerfile`. `https://hfd.linkos.org` answers 301 to `https://deepapi.linkos.org` and keeps the path and query.

The package is `ghcr.io/openlinkos/deepapi-web`. The same build is also pushed as `ghcr.io/openlinkos/harbor-web` for one release. GitHub creates a package as private on the first push. An owner should make **deepapi-web** public so clusters can pull it without a token. A token with `packages: write` can also do:

```bash
gh api --method PATCH /orgs/openlinkos/packages/container/deepapi-web -f visibility=public
```

## Build

```bash
docker build -f deploy/web/Dockerfile -t harbor-web:local .
```

The build runs `pnpm install --frozen-lockfile && pnpm build`, then copies `apps/web/dist` plus `LICENSE` and `NOTICE` into an unprivileged nginx image. The process listens on port 8080 and does not run as root.

## Run locally

```bash
docker run --rm -p 8080:8080 harbor-web:local
```

Open `http://127.0.0.1:8080/`. A path such as `/some/deep/route` returns the same `index.html`. `GET /healthz` returns `ok`.

## Kubernetes

```bash
kubectl apply -k deploy/web/k8s
kubectl -n harbor rollout status deployment/harbor-web
```

The default image tag is `latest`. Change it in `deploy/web/k8s/kustomization.yaml` (`images.newTag`). The ingress class defaults to `nginx` in that same file. TLS on the Ingress is commented out because GoEdge terminates HTTPS. The Ingress is the origin.

`deploy/web/k8s/rbac.yaml` is an example ServiceAccount, Role, and RoleBinding for a deployer. It is not applied by the kustomization. The Role can only touch deployments, services, and ingresses in the `harbor` namespace.

```bash
kubectl apply -f deploy/web/k8s/rbac.yaml
```

## GitHub Actions

`.github/workflows/web-image.yml` builds `linux/amd64` and `linux/arm64` on pushes to `master` that touch the web app, and on `v*` tags. It pushes:

- `latest` on `master`
- `sha-<short>`
- `<YYYYMMDDHHmmss>-<sha7>` on pushes to `master` (UTC clock, 7-character commit sha), the tag Flux ImagePolicy sorts on prod-us
- semver tags (`1.2.3`, `1.2`, `1`) when the git tag is a version

It uses `GITHUB_TOKEN` with `packages: write`.

If the repository secret `HARBOR_KUBECONFIG` is set (raw kubeconfig text, or base64 of that text), the workflow sets the deployment image to `sha-<short>`, applies the kustomization, and waits for the rollout. If the secret is absent, that step exits successfully and does not deploy.

## DNS and TLS

`deepapi.linkos.org` is a Cloudflare DNS-only CNAME. The record is not proxied:

```text
deepapi.linkos.org.  CNAME  70c9d096.quic.ing.
```

`70c9d096.quic.ing` is the GoEdge CDN (`cdn-uspre.quic.ing`). TLS terminates at GoEdge. GoEdge manages the certificate and renews it. Cloudflare does not cache this host and does not see the HTTP requests.

The cluster Ingress is the origin behind that GoEdge site. Cache behavior belongs on GoEdge, and it should still respect the origin `Cache-Control`: `index.html` and the manifest are `no-cache`, and files under `/assets/` are `public, max-age=31536000, immutable`. Do not cache HTML at the edge longer than the origin allows, or a new release will keep serving the previous `index.html`.
