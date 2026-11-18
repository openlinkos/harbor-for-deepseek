FROM node:22-alpine AS build
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
RUN apk add --no-cache su-exec
WORKDIR /app
COPY --from=build /src/apps/server/dist/server.js /app/server.js
COPY --from=build /src/apps/web/dist /app/public
COPY deploy/entrypoint.sh /entrypoint.sh
RUN chmod 755 /entrypoint.sh
ENV PORT=8080 \
    DATA_DIR=/data \
    STATIC_DIR=/app/public \
    NODE_ENV=production
EXPOSE 8080
VOLUME ["/data"]
ENTRYPOINT ["/entrypoint.sh"]
