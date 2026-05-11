# syntax=docker/dockerfile:1.7

# ---- builder ----
FROM node:22-alpine AS builder
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json tsconfig.base.json ./
COPY apps/server/package.json apps/server/
COPY packages/shared/package.json packages/shared/
COPY packages/game-core/package.json packages/game-core/

RUN pnpm install --frozen-lockfile --filter @bitrunners/server...

COPY apps/server apps/server
COPY packages/shared packages/shared
COPY packages/game-core packages/game-core

RUN pnpm --filter @bitrunners/server build

# Strip dev dependencies; keep production-only node_modules
RUN pnpm --filter @bitrunners/server deploy --prod --legacy /out

# ---- runtime ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
COPY --from=builder /out/node_modules ./node_modules
COPY --from=builder /repo/apps/server/dist ./dist
EXPOSE 8080
HEALTHCHECK --interval=20s --timeout=3s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:8080/health || exit 1
CMD ["node", "dist/index.js"]
