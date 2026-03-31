FROM node:20-slim AS base
RUN npm install -g pnpm@9

WORKDIR /app

# Copy workspace manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/core/package.json ./packages/core/
COPY packages/store-sqlite/package.json ./packages/store-sqlite/
COPY packages/store-supabase/package.json ./packages/store-supabase/
COPY packages/server/package.json ./packages/server/

# Install all workspace deps
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/core ./packages/core
COPY packages/store-sqlite ./packages/store-sqlite
COPY packages/store-supabase ./packages/store-supabase
COPY packages/server ./packages/server
COPY tsconfig.json ./

# Build
RUN pnpm --filter @shadowctx/core build && \
    pnpm --filter @shadowctx/store-sqlite build && \
    pnpm --filter @shadowctx/store-supabase build && \
    pnpm --filter @shadowctx/server build

# ---- runtime ----
FROM node:20-slim AS runtime
RUN npm install -g pnpm@9

WORKDIR /app

COPY --from=base /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=base /app/packages/core/package.json ./packages/core/
COPY --from=base /app/packages/store-sqlite/package.json ./packages/store-sqlite/
COPY --from=base /app/packages/store-supabase/package.json ./packages/store-supabase/
COPY --from=base /app/packages/server/package.json ./packages/server/

RUN pnpm install --frozen-lockfile --prod

COPY --from=base /app/packages/core/dist ./packages/core/dist
COPY --from=base /app/packages/store-sqlite/dist ./packages/store-sqlite/dist
COPY --from=base /app/packages/store-supabase/dist ./packages/store-supabase/dist
COPY --from=base /app/packages/server/dist ./packages/server/dist

ENV STORE=sqlite
ENV DB_PATH=/data/shadowctx.db
ENV PORT=3000
ENV HOST=0.0.0.0

VOLUME ["/data"]
EXPOSE 3000

CMD ["node", "packages/server/dist/index.js"]
