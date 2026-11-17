# syntax=docker/dockerfile:1.7

# Stage 1: install dependencies and build the application.
# npm, TypeScript, Vite and every other dev tool stay in this stage only.
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

# Stage 2: minimal runtime. Plain Alpine (~8 MB) + the single `node` binary from stage 1.
# The official node image also ships npm, yarn and corepack; none of that is needed to run the
# server, and the distroless Node image alone is ~200 MB, which is over the 200 MB limit.
FROM alpine:3 AS runtime
# libstdc++ is the only runtime library the musl Node binary needs (the official node image does the same).
RUN apk add --no-cache libstdc++ \
  && addgroup -g 10001 -S app \
  && adduser -S -u 10001 -G app -H -h /app app
COPY --from=build /usr/local/bin/node /usr/local/bin/node

ENV NODE_ENV=production \
    PORT=3000 \
    LOG_DIR=./server/logs \
    CLIENT_DIST_DIR=./client/dist
ARG BUILD_SHA=dev
ENV BUILD_SHA=${BUILD_SHA}
WORKDIR /app

# Only runtime dependencies, compiled output and runtime data. --chown sets ownership at copy time.
COPY --from=build --chown=10001:10001 /app/node_modules ./node_modules
COPY --from=build --chown=10001:10001 /app/server/package.json ./server/package.json
COPY --from=build --chown=10001:10001 /app/server/dist ./server/dist
COPY --from=build --chown=10001:10001 /app/server/examples/commonjs-demo.cjs ./server/examples/commonjs-demo.cjs
COPY --from=build --chown=10001:10001 /app/server/data ./server/data
COPY --from=build --chown=10001:10001 /app/server/logs ./server/logs
COPY --from=build --chown=10001:10001 /app/shared/package.json ./shared/package.json
COPY --from=build --chown=10001:10001 /app/shared/dist ./shared/dist
COPY --from=build --chown=10001:10001 /app/client/dist ./client/dist

USER 10001:10001
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

# Direct Node process (no npm, no shell wrapper): SIGTERM from `docker stop` reaches Node itself.
ENTRYPOINT ["node"]
CMD ["server/dist/index.js"]
