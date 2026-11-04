# Public deployment (Docker + Caddy + GHCR)

The repository builds and publishes a production image on a Git tag matching `v*`. A real public HTTPS/WSS URL also needs a Linux VPS (or another Docker host), a domain name that points to that host, and the GitHub Actions secrets below. The repository intentionally contains no personal server credentials or invented live URL.

## 1. VPS and DNS prerequisites

- A Linux VPS with Docker Engine and the Docker Compose plugin installed.
- Inbound TCP ports **80 and 443** open; UDP 443 is optional (HTTP/3).
- A DNS `A` record for the chosen hostname pointing to the VPS; add `AAAA` only if IPv6 is configured and reachable.
- A non-root SSH user that can run Docker Compose (for this educational deployment, membership in the `docker` group is used).
- Either make the GHCR package **Public** for anonymous pulls, or configure the optional read-only GHCR token secrets below.

Caddy obtains and renews the TLS certificate automatically. This requires the hostname to resolve publicly to the VPS and ports 80/443 to be reachable. Caddy's `reverse_proxy` supports WebSocket upgrades, so the browser uses `wss://<hostname>/ws` behind HTTPS.

## 2. Configure GitHub Actions

In repository **Settings → Secrets and variables → Actions**, create this repository variable:

| Variable | Value |
|---|---|
| `DEPLOY_ENABLED` | `true` |

Add these repository secrets:

| Secret | Value |
|---|---|
| `DEPLOY_HOST` | VPS IP address or SSH hostname |
| `DEPLOY_USER` | SSH user with permission to run Docker Compose |
| `DEPLOY_SSH_KEY` | Private SSH key for that user |
| `DEPLOY_KNOWN_HOSTS` | Verified SSH host-key line(s) for the VPS |
| `DEPLOY_APP_DOMAIN` | Public DNS hostname, e.g. `arena.example.com` (no scheme/path) |
| `DEPLOY_SSH_PORT` | Optional; defaults to `22` |
| `DEPLOY_GHCR_USERNAME` | Optional; GitHub username that owns the read-only package token |
| `DEPLOY_GHCR_TOKEN` | Optional; classic PAT with `read:packages`, required only when the GHCR image is private |

To prepare `DEPLOY_KNOWN_HOSTS`, obtain the host key with `ssh-keyscan -p 22 -H <VPS_HOST>`, then verify its fingerprint against the VPS provider console or another trusted channel **before** saving it. Do not trust an unverified key-scan result.

Never commit the private key, a production `.env`, registry tokens or other secrets. If the package is public, leave the optional GHCR token secrets empty; if it is private, use a classic PAT with only `read:packages` on the VPS pull step. Origin allowlisting is not user authentication; the current game uses display names and is an educational demo.

## 3. Release and deploy

The `v*` release workflow first reruns typecheck, lint, unit/property tests, build, the two-browser Playwright test, the WebSocket abuse test, and the Docker shutdown/image-size test. Only after that gate succeeds does it publish `ghcr.io/<owner>/<repository>:<tag>`. If `DEPLOY_ENABLED=true`, it deploys a single app container behind Caddy and verifies that the public `/health` endpoint reports the exact release commit SHA.

After the Lab 8 commit is pushed to `main`, create the academic and release tags:

```powershell
git tag lab-08
git push origin lab-08
git tag v1.0.0
git push origin v1.0.0
```

`lab-08` is the academic checkpoint. `v1.0.0` triggers image publication and, when the deployment variable/secrets are configured, the VPS deployment.

## 4. Verify the public deployment

```bash
curl https://YOUR_DOMAIN/health
curl -i https://YOUR_DOMAIN/ready
curl https://YOUR_DOMAIN/metrics
```

`/health` returns process liveness and `gitSha`; compare `gitSha` with the commit referenced by the tag:

```bash
git rev-list -n 1 v1.0.0
```

`/ready` returns 503 during startup/shutdown or when the single process cannot accept another player. The game page is `https://YOUR_DOMAIN`, and its WebSocket endpoint is `wss://YOUR_DOMAIN/ws`; the client chooses `wss:` from the HTTPS page URL. Do not publish a placeholder URL as the live address.

## 5. Single-process room ownership

The Compose file deliberately defines exactly **one app container/process** for this lab. Room membership, simulation state and socket ownership live in that Node process. Multiple app replicas behind a load balancer could put members of one room into separate worlds. Caddy is a TLS/WebSocket reverse proxy; it does not coordinate authoritative room state across replicas.

Persistent match logs are mounted in the `arena-logs` Docker volume. Room/player state is intentionally in memory and is not restored after a crash. For a long-running public service, add backups/log rotation, authentication, abuse monitoring and a shared room-ownership design before horizontal scaling.
