# syntax=docker/dockerfile:1.7

# ─── deps ────────────────────────────────────────────────────
FROM node:20-slim AS deps
WORKDIR /app

# OpenSSL is required by Prisma at runtime + build
RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund


# ─── builder ─────────────────────────────────────────────────
FROM node:20-slim AS builder
WORKDIR /app

RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

# Build needs an AUTH_SECRET at module-eval time (proxy.ts imports it).
# This is BUILD-time only; runtime uses the real env var.
ENV AUTH_SECRET=build_time_placeholder_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build


# ─── runtime ─────────────────────────────────────────────────
FROM node:20-slim AS runner
WORKDIR /app

RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl ca-certificates tini \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

# Standalone output: minimal server.js + only required node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Prisma artefacts needed for `prisma db push` at startup
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma

USER nextjs

EXPOSE 3000

ENTRYPOINT ["tini", "--"]
# Apply schema (idempotent), then start the standalone Node server
CMD ["sh", "-c", "node ./node_modules/prisma/build/index.js db push --skip-generate --accept-data-loss=false && node server.js"]
