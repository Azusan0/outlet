FROM node:22-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
WORKDIR /app

FROM base AS build
COPY .npmrc package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/api/package.json ./packages/api/package.json
COPY packages/api/scripts ./packages/api/scripts
COPY apps/admin/package.json ./apps/admin/package.json
COPY apps/vendor/package.json ./apps/vendor/package.json
COPY apps/storefront ./apps/storefront
RUN pnpm install --frozen-lockfile
ARG MEDUSA_BACKEND_URL=http://api:9000
ARG NEXT_PUBLIC_BASE_PATH=
ARG NEXT_PUBLIC_BASE_URL=http://localhost:3000
ARG NEXT_PUBLIC_VENDOR_URL=
ENV MEDUSA_BACKEND_URL=$MEDUSA_BACKEND_URL
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH
ENV NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL
ENV NEXT_PUBLIC_VENDOR_URL=$NEXT_PUBLIC_VENDOR_URL
RUN pnpm --filter @outlet/api codegen && pnpm --filter @outlet/storefront build

FROM node:22-bookworm-slim
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build /app/apps/storefront/.next/standalone ./
COPY --from=build /app/apps/storefront/.next/static ./apps/storefront/.next/static
COPY --from=build /app/apps/storefront/public ./apps/storefront/public
EXPOSE 3000
CMD ["node", "apps/storefront/server.js"]
