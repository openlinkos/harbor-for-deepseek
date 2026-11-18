# syntax=docker/dockerfile:1

FROM --platform=$BUILDPLATFORM node:22-alpine AS build
WORKDIR /src
RUN corepack enable && corepack prepare pnpm@10.33.4 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY LICENSE NOTICE ./
COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @harbor/web build && pnpm --filter @harbor/server build

FROM node:22-alpine
LABEL org.opencontainers.image.title="Harbor for DeepSeek" \
      org.opencontainers.image.description="Harbor for DeepSeek server" \
      org.opencontainers.image.source="https://github.com/openlinkos/harbor-for-deepseek" \
      org.opencontainers.image.url="https://hfd.linkos.org" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.vendor="OpenLinkOS"
WORKDIR /app
COPY --from=build /src/apps/server/dist/server.js /app/server.js
COPY --from=build /src/apps/web/dist /app/public
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
  && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
ENV PORT=8080 \
    STATIC_DIR=/app/public \
    NODE_ENV=production
EXPOSE 8080
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/healthz').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "/app/server.js"]
