Lab 8 Docker image size fix

Replace the Dockerfile in the repository root with the Dockerfile in this
folder. Do not replace or delete .git, source folders, package files, or other
project files.

This keeps a two-stage build:
- node:24-alpine builder installs full dependencies and builds client/server/shared.
- gcr.io/distroless/nodejs24-debian13:nonroot runtime contains Node 24 and only
  the pruned production node_modules plus compiled app output.

The runtime uses UID/GID 65532, no shell/npm wrapper, a direct Node entrypoint,
and an exec-form Docker HEALTHCHECK. It also avoids a separate recursive chown
layer by using COPY --chown.

Rebuild from the repository root:
  docker build --no-cache --build-arg BUILD_SHA=local -t space-arena:local .

Inspect the uncompressed image size in bytes:
  docker image inspect --format="{{.Size}}" space-arena:local

Convert to MiB in PowerShell:
  $size = docker image inspect --format="{{.Size}}" space-arena:local
  [math]::Round(([double]$size / 1MB), 2)

Then run the existing full shutdown/size test:
  npm run docker:test:shutdown

Notes:
- Do not weaken the 200 MB assertion in scripts/docker-shutdown-check.mjs.
- Distroless images intentionally have no shell. docker exec sh will not work;
  use docker logs, docker inspect, and HTTP health endpoints for diagnostics.
- The official Distroless Node 24 image sets Node as its entrypoint. The
  explicit ENTRYPOINT/CMD pair still executes `node server/dist/index.js`
  directly, allowing Docker SIGTERM to reach the Node process.
