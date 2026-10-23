# ── Stage 1: Dependencies ──────────────────────────────────────────────
FROM oven/bun:1.4.4@sha256:1d22548f177f4ff38e0c15baa3c2c46c6c2060ba2d1bc573bb4720b407548f1d AS deps
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ── Stage 2: Build ────────────────────────────────────────────────────
FROM oven/bun:1.4.4@sha256:1d22548f177f4ff38e0c15baa3c2c46c6c2060ba2d1bc573bb4720b407548f1d AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Dummy secret to allow NextAuth module to load during Next.js build
# (real secret is injected at runtime via environment variables)
ENV AUTH_SECRET=build-placeholder

RUN bun run build

# ── Stage 3: Runner ───────────────────────────────────────────────────
FROM oven/bun:1.4.4@sha256:1d22548f177f4ff38e0c15baa3c2c46c6c2060ba2d1bc573bb4720b407548f1d AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=7026
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 7026

CMD ["bun", "server.js"]
