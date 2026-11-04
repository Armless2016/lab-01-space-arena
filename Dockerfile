# syntax=docker/dockerfile:1.7

# Stage 1: install dependencies and build the application.
# Keep the builder separate so npm, TypeScript, Vite and other dev tools
# never enter the final runtime image.
FROM node:24-alpine AS build
WORKDIR /app
ARG BUILD_SHA=dev

COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/
COPY shared/package*.json ./shared/
RUN if [ -f package-lock.json ]; then \
      npm ci --no-audit --no-fund; \
    else \
      npm install --no-audit --no-fund; \
    fi

COPY . .
RUN npm run typecheck \
  && npm run build \
  && npm prune --omit=dev --no-audit --no-fund \
  && npm cache clean --force \
  && mkdir -p /app/server/logs

# Stage 2: minimal Node 24 runtime. Distroless includes Node directly,
# has no shell/package manager, and its :nonroot variant runs as UID 65532.
FROM gcr.io/distroless/nodejs24-debian13:nonroot AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    LOG_DIR=./server/logs \
    CLIENT_DIST_DIR=./client/dist
ARG BUILD_SHA=dev
ENV BUILD_SHA=${BUILD_SHA}
WORKDIR /app

# Copy only runtime dependencies, compiled output and runtime data.
# --chown sets file ownership at copy time and avoids a full extra chown layer.
COPY --from=build --chown=65532:65532 /app/node_modules ./node_modules
COPY --from=build --chown=65532:65532 /app/server/package.json ./server/package.json
COPY --from=build --chown=65532:65532 /app/server/dist ./server/dist
COPY --from=build --chown=65532:65532 /app/server/examples/commonjs-demo.cjs ./server/examples/commonjs-demo.cjs
COPY --from=build --chown=65532:65532 /app/server/data ./server/data
COPY --from=build --chown=65532:65532 /app/server/logs ./server/logs
COPY --from=build --chown=65532:65532 /app/shared/package.json ./shared/package.json
COPY --from=build --chown=65532:65532 /app/shared/dist ./shared/dist
COPY --from=build --chown=65532:65532 /app/client/dist ./client/dist

USER 65532:65532
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

# Direct Node process (no npm wrapper) so SIGTERM reaches Node immediately.
# Distroless Node image provides the `node` entrypoint.
ENTRYPOINT ["node"]
CMD ["server/dist/index.js"]
