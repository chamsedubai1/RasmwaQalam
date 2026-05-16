# syntax=docker/dockerfile:1.6
#
# Production image for the Art Challenge Platform.
#
# Multi-stage build:
#   1. builder — installs all deps (including dev) and produces dist/
#   2. runtime — small image that only carries production deps + dist/
#
# Used by: Render (Docker mode), Fly.io, AWS App Runner, plain `docker run`.
# Render injects PORT and other env vars at runtime — do NOT bake them in.

# ---- Stage 1: build ----------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Install build deps required by some native modules (e.g. bcrypt fallback)
RUN apk add --no-cache python3 make g++ libc6-compat

# Install deps first (layer cached unless package*.json changes)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Prune dev deps so the next stage can copy a smaller node_modules
RUN npm prune --omit=dev

# ---- Stage 2: runtime --------------------------------------------------------
FROM node:20-alpine AS runtime

WORKDIR /app

# Run as a non-root user. The official node image already creates `node`.
ENV NODE_ENV=production
ENV PORT=10000

# Copy only what the runtime needs
COPY --from=builder --chown=node:node /app/dist                ./dist
COPY --from=builder --chown=node:node /app/node_modules        ./node_modules
COPY --from=builder --chown=node:node /app/package.json        ./package.json
COPY --from=builder --chown=node:node /app/package-lock.json   ./package-lock.json
COPY --from=builder --chown=node:node /app/shared              ./shared
COPY --from=builder --chown=node:node /app/drizzle.config.ts   ./drizzle.config.ts

# Uploads directory must exist and be writable. On Render, attach a Disk
# mounted at /app/uploads so user-uploaded images survive redeploys.
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads

# Drop root
USER node

EXPOSE 10000

# Lightweight healthcheck. Renders' health checker also calls /api/auth/captcha
# but this gives plain `docker run` users feedback too.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/auth/captcha" >/dev/null || exit 1

CMD ["node", "dist/index.js"]
