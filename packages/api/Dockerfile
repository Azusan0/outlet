FROM node:22-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
WORKDIR /app

FROM base AS build
COPY .npmrc package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig*.json blocks.json ./
COPY apps/admin/package.json ./apps/admin/package.json
COPY apps/storefront/package.json ./apps/storefront/package.json
COPY apps/vendor/package.json ./apps/vendor/package.json
COPY packages/api/package.json ./packages/api/package.json
RUN pnpm install --frozen-lockfile
COPY apps ./apps
COPY packages ./packages
ARG MERCUR_BACKEND_URL=http://localhost:9000
ENV MERCUR_BACKEND_URL=$MERCUR_BACKEND_URL
RUN pnpm --filter @outlet/api codegen && pnpm --filter @outlet/admin build && pnpm --filter @outlet/vendor build && pnpm --filter @outlet/api build

FROM node:22-bookworm-slim
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
WORKDIR /app/packages/api
COPY --from=build /app/packages/api/.medusa/server /app/packages/api
RUN pnpm install --prod --frozen-lockfile=false
ENV NODE_ENV=production
EXPOSE 9000
CMD ["pnpm", "start"]
