# Module 8 Deploy Verification Runbook

This runbook documents the supported local fallback deployment path for this repo. Use it when you need to deploy a new container image, verify the running version, stop a harmful release, or roll back to a known-good image.

## Preconditions

- Run from the repo root.
- Docker Desktop or equivalent local Docker runtime is available.
- PostgreSQL is started from `infra/docker-compose.yml`.
- The deploy target in this repo is the `app` service in `infra/docker-compose.yml`.

## Deploy

### Step 1: Choose the release identifier

```powershell
$version = (git rev-parse --short HEAD).Trim()
$env:APP_IMAGE = "caw-express-app:$version"
$env:APP_VERSION = $version
```

Expected result:
- `$version` is a short git SHA.
- `APP_IMAGE` and `APP_VERSION` point at the same release identifier.

### Step 2: Start the database

```powershell
docker compose -f infra/docker-compose.yml up -d postgres
```

Expected result:
- `linkops-postgres` is running and healthy.

### Step 3: Deploy the app container

```powershell
docker compose -f infra/docker-compose.yml up -d --build app
```

Expected result:
- `linkops-app` is created or recreated.
- The app container starts without crash-looping.

## Verify

### Step 1: Check liveness

```powershell
curl.exe -s http://localhost:3000/live
```

Expected result:

```json
{"status":"ok","service":"url-shortener","version":"<sha>","app_env":"production","uptime_seconds":<n>}
```

### Step 2: Check readiness

```powershell
curl.exe -s http://localhost:3000/ready
```

Expected result:

```json
{"status":"ready","service":"url-shortener","version":"<sha>","app_env":"production","uptime_seconds":<n>,"store":"postgres","checks":{"database":"connected"}}
```

### Step 3: Run the deployment smoke test

```powershell
$env:APP_EXPECTED_VERSION = $version
$env:APP_EXPECTED_STORE = "postgres"
npm run module-08:deploy-verify
```

Expected result:

```text
live version: <sha>
ready store: postgres
metrics endpoint: ok
```

## Kill Switch

Use this when the service is live but harmful and you need to stop it before a full diagnosis.

```powershell
docker compose -f infra/docker-compose.yml stop app
```

Expected result:
- `linkops-app` stops.
- `curl.exe -s http://localhost:3000/live` no longer returns a healthy response.

## Roll Back

### Step 1: Select the last known-good version

```powershell
$previousVersion = "<previous_sha>"
$env:APP_IMAGE = "caw-express-app:$previousVersion"
$env:APP_VERSION = $previousVersion
```

### Step 2: Redeploy the known-good image without rebuilding

```powershell
docker compose -f infra/docker-compose.yml up -d app --no-build
```

### Step 3: Re-verify the rollback

```powershell
curl.exe -s http://localhost:3000/live
curl.exe -s http://localhost:3000/ready
$env:APP_EXPECTED_VERSION = $previousVersion
$env:APP_EXPECTED_STORE = "postgres"
npm run module-08:deploy-verify
```

Expected result:
- `/live` reports the rollback version.
- `/ready` is healthy.
- `npm run module-08:deploy-verify` confirms the rollback version is the one actually serving.

## Failure Interpretation

- If `/live` is healthy but `/ready` is `503`, the process is running but the release is not safe for traffic.
- If `/ready` is healthy but the reported `version` is wrong, the wrong artifact is serving.
- If `npm run module-08:deploy-verify` fails on the version check, do not continue traffic assumptions until the serving artifact is corrected.
