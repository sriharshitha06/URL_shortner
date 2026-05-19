# Service Overview

## Purpose

URL shortener API that accepts long URLs and returns shortened aliases for later redirect resolution. The service also supports link listing, search, deletion, API-key-protected team invitations, and operational endpoints for health and metrics.

## Dependencies

| Dependency | Type | What happens without it |
|---|---|---|
| PostgreSQL | Primary datastore | If `USE_IN_MEMORY_STORE=false`, `/ready` returns `503`, DB-backed reads and writes degrade to `503`, and the Module 06 timeout/retry/circuit-breaker path becomes the active protection chain. |
| DNS / hostname resolution for `DATABASE_URL` | Network dependency | The service cannot resolve the database host, DB-backed requests degrade to `503`, and logs emit dependency-unavailable signals even if PostgreSQL itself is healthy. |
| Node.js process resources (CPU, memory, event loop) | Runtime dependency | Requests slow down, time out, or the process exits; there is no graceful fallback beyond restart and the runbooks in [module-07-incident-response.md](./runbooks/module-07-incident-response.md). |
| stdout / stderr log collection | Observability dependency | The API can still serve traffic, but operators lose the fastest way to correlate `request_id`, dependency failures, and breaker state changes. |

Notes:
- `USE_IN_MEMORY_STORE=true` is a local fallback for development and controlled incident drills. It is not a hot production failover path because state becomes non-persistent.
- `infra/docker-compose.yml` also defines Redis, but the current service code does not connect to Redis.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/` | Basic process status response. |
| `GET` | `/live` | Liveness check: confirms the process can answer HTTP. |
| `GET` | `/health` | Docker health check endpoint used by the image health probe. |
| `GET` | `/ready` | Readiness check: confirms the service is safe to receive traffic and can reach PostgreSQL when not in memory mode. |
| `GET` | `/metrics` | Prometheus metrics endpoint. |
| `POST` | `/shorten` | Create a short link from a long URL. Requires API key. |
| `POST` | `/links` | Alias of `/shorten`. Requires API key. |
| `GET` | `/links` | Paginated list of links for the authenticated principal. Requires API key. |
| `GET` | `/links/search` | Search links by text, tag, and date filters. Requires API key. |
| `GET` | `/links/:id` | Fetch a single link by numeric ID for the authenticated principal. Requires API key. |
| `DELETE` | `/links/:short_code` | Delete a short link by code for the authenticated principal. Requires API key. |
| `GET` | `/r/:short_code` | Resolve and redirect a short URL. |
| `POST` | `/team-invitations` | Create a team invitation. Requires API key. |
| `POST` | `/__test/reset` | Test-only in-memory reset route. Available only when `USE_IN_MEMORY_STORE=true`. |
| `GET` | `/__test/error` | Test-only route that forces an error for observability and runbook drills. Available only when `USE_IN_MEMORY_STORE=true`. |

## Configuration

Reference file: [.env.example](../.env.example)

Important operational settings:
- `DATABASE_URL`: PostgreSQL connection string. Requires process restart.
- `USE_IN_MEMORY_STORE`: Switches the service between persistent and in-memory modes. Requires process restart.
- `PORT`: Listen port. Requires process restart.
- `APP_ENV`, `SERVICE_NAME`, `APP_VERSION`, `LOG_LEVEL`: Logging, release, and environment labels. Require process restart.
- `DATABASE_QUERY_TIMEOUT_MS`: Per-query fail-fast timeout. Requires process restart.
- `DATABASE_RETRY_ATTEMPTS`, `DATABASE_RETRY_BASE_DELAY_MS`, `DATABASE_RETRY_MAX_DELAY_MS`, `DATABASE_RETRY_JITTER_MS`: Retry behavior controls. Require process restart.
- `DATABASE_CIRCUIT_RESET_TIMEOUT_MS`, `DATABASE_CIRCUIT_VOLUME_THRESHOLD`, `DATABASE_CIRCUIT_ERROR_THRESHOLD_PERCENT`: Circuit-breaker controls. Require process restart.
- `API_KEYS`: Authentication map for protected endpoints. Requires process restart.

Runtime-change rule:
- None of the current environment variables are hot-reload safe.
- The service reads configuration at startup through `config/env.js`, so every operational config change requires a restart.

## Deploy

Current state:
- This repo still does not contain a hosted production target, so the supported capstone path is the Module 8 local fallback deploy.
- The local deploy path uses the same Docker image and runtime env contract the app would use on a real platform.

Local deploy (version-tagged image):

```powershell
$version = (git rev-parse --short HEAD).Trim()
$env:APP_IMAGE = "caw-express-app:$version"
$env:APP_VERSION = $version
docker compose -f infra/docker-compose.yml up -d postgres
docker compose -f infra/docker-compose.yml up -d --build app
```

Post-deploy verification:

```powershell
curl.exe -s http://localhost:3000/live
curl.exe -s http://localhost:3000/ready
$env:APP_EXPECTED_VERSION = $version
$env:APP_EXPECTED_STORE = "postgres"
npm run module-08:deploy-verify
```

Expected healthy responses:
- `/live` includes `status: "ok"` and the deployed `version`
- `/ready` with PostgreSQL returns `status: "ready"`, `store: "postgres"`, and `checks.database: "connected"`
- `npm run module-08:deploy-verify` prints the live version, ready store, and confirms metrics are reachable

Kill switch:

```powershell
docker compose -f infra/docker-compose.yml stop app
```

Use this when the service is up but actively causing harm and you need to stop traffic before full diagnosis.

## Rollback

Current state:
- There is still no hosted rollback target in-repo, but the local fallback path now supports image-tagged rollback drills.

Manual local rollback to a known-good image:

```powershell
$previousVersion = "<previous_sha>"
$env:APP_IMAGE = "caw-express-app:$previousVersion"
$env:APP_VERSION = $previousVersion
docker compose -f infra/docker-compose.yml up -d app --no-build
```

Rollback verification:

```powershell
curl.exe -s http://localhost:3000/live
curl.exe -s http://localhost:3000/ready
$env:APP_EXPECTED_VERSION = $previousVersion
$env:APP_EXPECTED_STORE = "postgres"
npm run module-08:deploy-verify
```

Expected healthy responses:
- `/live` reports the rollback `version`
- `/ready` reports `status: "ready"` and `store: "postgres"`
- `npm run module-08:deploy-verify` confirms the old version is the one actually serving

Operational note:
- This is still a local fallback drill, not a multi-instance production rollout.
- The important production-readiness gain is that deploy, verify, kill switch, and rollback now all use the same container artifact instead of mixed host and container paths.

## Ownership

- Primary owner: current repository maintainer / on-call engineer for this workspace
- Secondary owner: not defined in-repo yet
- Engineering manager / final escalation: not defined in-repo yet
- Team channel: not defined in-repo yet
- If no response in 10 minutes: escalate outside the repo’s documented process to the human currently responsible for the workspace

Operational gap:
- Ownership and escalation contacts are not yet encoded in the repo. This document should be updated with real names and channels before a real on-call handoff.
