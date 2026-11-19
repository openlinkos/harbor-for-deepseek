# Public static site (deepapi.linkos.org). Not the self-hosted server image.
FROM node:22-alpine AS build
WORKDIR /src
RUN corepack enable && corepack prepare pnpm@10.33.4 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json .npmrc ./
COPY LICENSE NOTICE ./
COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts
RUN pnpm install --frozen-lockfile && pnpm build
RUN cp LICENSE NOTICE apps/web/dist/

FROM nginxinc/nginx-unprivileged:1.27-alpine
LABEL org.opencontainers.image.title="Harbor web" \
      org.opencontainers.image.description="Harbor for DeepSeek static web client" \
      org.opencontainers.image.source="https://github.com/openlinkos/deepapi" \
      org.opencontainers.image.url="https://deepapi.linkos.org" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.vendor="OpenLinkOS"
COPY deploy/web/nginx/nginx.conf /etc/nginx/nginx.conf
COPY deploy/web/nginx/security-headers.conf /etc/nginx/security-headers.conf
COPY deploy/web/docker-entrypoint.sh /docker-entrypoint-web.sh
COPY --from=build /src/apps/web/dist /usr/share/nginx/html
USER root
RUN chmod 755 /docker-entrypoint-web.sh \
  && chown -R nginx:nginx /usr/share/nginx/html
USER nginx
EXPOSE 8080
ENTRYPOINT ["/docker-entrypoint-web.sh"]
