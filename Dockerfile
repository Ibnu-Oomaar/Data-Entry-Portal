# syntax=docker/dockerfile:1
# One image: the NestJS API also serves the built React app (same origin, so no CORS and the session cookie just works).
# NOTE: this file was written but could not be built in the development sandbox (no Docker there). Build it once before relying on it.

# ---------- 1. Build the React app ----------
FROM node:22-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---------- 2. Build the API ----------
FROM node:22-alpine AS backend
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build && npm prune --omit=dev

# ---------- 3. Runtime ----------
FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    FRONTEND_DIST=/app/frontend/dist
WORKDIR /app/backend
COPY --from=backend --chown=node:node /app/backend/node_modules ./node_modules
COPY --from=backend --chown=node:node /app/backend/dist ./dist
COPY --from=backend --chown=node:node /app/backend/package.json ./package.json
COPY --from=frontend --chown=node:node /app/frontend/dist /app/frontend/dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
# Migrations run automatically on start (RUN_MIGRATIONS=true by default).
CMD ["node", "dist/main.js"]
