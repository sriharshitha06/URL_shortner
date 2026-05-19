# Module 7 Incident Runbooks

These runbooks assume the operator is in the repo root on the host running the service and can reach the local API on `http://localhost:3000`.

## Runbook: Database Connection Failure

### Alert / Detection
- Alert name: `HighErrorRate`
- Symptoms: DB-backed routes return `503`, `/ready` returns `not_ready`, and dependency warnings appear in logs.
- How you know this is happening: `GET /ready` is unhealthy and `http_requests_total` shows `503` responses increasing.

### Diagnosis

**Step 1: Check readiness**

```powershell
curl.exe -s http://localhost:3000/ready
```

- If this IS the problem, you will see:

```json
{"status":"not_ready","store":"postgres"}
```

- If this is NOT the problem, you will see:

```json
{"status":"ready","store":"postgres"}
```

**Step 2: Check for dependency-unavailable responses**

```powershell
curl.exe -s http://localhost:3000/metrics | Select-String 'http_requests_total{service="url-shortener".*status="503"'
```

- If this IS the problem, you will see one or more metric lines containing `status="503"`.
- If this is NOT the problem, you will see no output.

**Step 3: Check PostgreSQL container health**

```powershell
docker inspect --format "{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}" linkops-postgres
```

- If this IS the problem, you will see either `exited`, `created`, or `running unhealthy`.
- If this is NOT the problem, you will see:

```text
running healthy
```

### Fix

**Step 1: Start or recreate PostgreSQL**

```powershell
docker compose -f infra/docker-compose.yml up -d postgres
```

- Expected output:

```text
Container linkops-postgres  Started
```

- If this does NOT produce the expected output, go to Escalation.

**Step 2: Wait for PostgreSQL health**

```powershell
docker inspect --format "{{if .State.Health}}{{.State.Health.Status}}{{end}}" linkops-postgres
```

- Expected output:

```text
healthy
```

**Step 3: Re-check service readiness**

```powershell
curl.exe -s http://localhost:3000/ready
```

- Expected output:

```json
{"status":"ready","store":"postgres"}
```

### Verification

Confirm the fix worked:

```powershell
curl.exe -s http://localhost:3000/ready
curl.exe -s http://localhost:3000/metrics | Select-String 'http_requests_total{service="url-shortener".*status="503"'
```

- Expected output:
  - `/ready` returns `{"status":"ready","store":"postgres"}`
  - the `503` metric line stops growing under normal traffic

Wait 2 minutes and check again:

```powershell
curl.exe -s http://localhost:3000/ready
```

- Expected output should be the same.

### Escalation

If this runbook does not resolve the issue within 10 minutes:
1. Post the commands you ran, the readiness output, and the PostgreSQL container state in the team channel if one exists.
2. Page the current workspace owner / repository maintainer directly.
3. If there is still no response after 10 more minutes, escalate outside the repo because no formal secondary contact is documented yet.

Do NOT spend more than 20 minutes debugging this alone at 3 AM.

## Runbook: High Error Rate / 5xx Spike

### Alert / Detection
- Alert name: `HighErrorRate`
- Symptoms: request errors above 5%, users report failed requests, and logs show `request_failed` or `request_degraded`.
- How you know this is happening: `GET /metrics` shows `http_requests_total` lines for `status="500"` or `status="503"`.

### Diagnosis

**Step 1: Check for 5xx metrics**

```powershell
curl.exe -s http://localhost:3000/metrics | Select-String 'status="500"|status="503"'
```

- If this IS the problem, you will see one or more metric lines containing `status="500"` or `status="503"`.
- If this is NOT the problem, you will see no output.

**Step 2: Separate dependency failure from app failure**

```powershell
curl.exe -s http://localhost:3000/ready
```

- If the errors are coming from a dependency outage, you will see:

```json
{"status":"not_ready","store":"postgres"}
```

- If the service is still ready and the issue is likely application-side, you will see one of:

```json
{"status":"ready","store":"postgres"}
```

or

```json
{"status":"ready","store":"in_memory"}
```

**Step 3: Check recent error logs**

```powershell
Get-Content app.err.log -Tail 50
```

- If this IS the problem, you will see recent `request_failed` or `request_degraded` lines.
- If this is NOT the problem, you will either see no recent errors or stale older timestamps.

### Fix

**Step 1: If `/ready` is unhealthy, follow the Database Connection Failure runbook first**

```powershell
curl.exe -s http://localhost:3000/ready
```

- Expected output after the dependency fix:

```json
{"status":"ready","store":"postgres"}
```

**Step 2: Restart the API process to clear a bad in-process state**

```powershell
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*node src/index.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
npm start
```

- Expected output:

```text
{"event":"server_started","message":"server started",...}
```

- If this does NOT produce the expected output, go to Escalation.

### Verification

Confirm the fix worked:

```powershell
curl.exe -s http://localhost:3000/live
curl.exe -s http://localhost:3000/ready
```

- Expected output:
  - `/live` returns a healthy payload with `status: "ok"` and a serving `version`
  - `/ready` returns `{"status":"ready","store":"postgres"}` or `{"status":"ready","store":"in_memory"}`

Wait 2 minutes and check again:

```powershell
curl.exe -s http://localhost:3000/metrics | Select-String 'status="500"|status="503"'
```

- Expected output:
  - the historical `500` or `503` line may still exist
  - the numeric count on that line should stop increasing once the triggering condition is removed

### Escalation

If this runbook does not resolve the issue within 10 minutes:
1. Post the 5xx metric lines, readiness output, and the latest `app.err.log` lines in the team channel if one exists.
2. Page the current workspace owner / repository maintainer directly.
3. If there is still no response after 10 more minutes, escalate outside the repo because no formal secondary contact is documented yet.

Do NOT spend more than 20 minutes debugging this alone at 3 AM.

## Runbook: High Latency / Slow Responses

### Alert / Detection
- Alert name: `HighLatency`
- Symptoms: requests eventually succeed but are slow, dashboards show p95 above 2 seconds, and users report spinning or slow pages.
- How you know this is happening: `GET /metrics` shows high request duration buckets and `active_http_requests` stays elevated.

### Diagnosis

**Step 1: Check active in-flight requests**

```powershell
curl.exe -s http://localhost:3000/metrics | Select-String 'active_http_requests|http_request_duration_seconds_bucket'
```

- If this IS the problem, you will see `active_http_requests` above zero for sustained periods and latency bucket lines extending into `le="2"` or higher.
- If this is NOT the problem, you will still see metric lines, but `active_http_requests` should return to `0` when the service is idle.

**Step 2: Check readiness**

```powershell
curl.exe -s http://localhost:3000/ready
```

- If the slowdown is caused by database trouble, you may see:

```json
{"status":"not_ready","store":"postgres"}
```

- If the service is still technically ready, you will see one of:

```json
{"status":"ready","store":"postgres"}
```

or

```json
{"status":"ready","store":"in_memory"}
```

**Step 3: Check Node process pressure**

```powershell
Get-Process -Name node | Select-Object Id,CPU,WS,StartTime
```

- If this IS the problem, you will see a node process with rapidly growing CPU or working set (`WS`) values.
- If this is NOT the problem, CPU and memory remain stable while latency stays low.

### Fix

**Step 1: If `/ready` is unhealthy, follow the Database Connection Failure runbook first**

```powershell
curl.exe -s http://localhost:3000/ready
```

- Expected output after the dependency fix:

```json
{"status":"ready","store":"postgres"}
```

**Step 2: Restart the API process if CPU or memory pressure is runaway**

```powershell
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*node src/index.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
npm start
```

- Expected output:

```text
{"event":"server_started","message":"server started",...}
```

### Verification

Confirm the fix worked:

```powershell
curl.exe -s http://localhost:3000/live
curl.exe -s http://localhost:3000/ready
curl.exe -s http://localhost:3000/metrics | Select-String 'active_http_requests'
```

- Expected output:
  - `/live` returns a healthy payload with `status: "ok"` and a serving `version`
  - `/ready` returns a `ready` response
  - `active_http_requests` returns to `0` when the service is idle

Wait 2 minutes and check again:

```powershell
curl.exe -s http://localhost:3000/metrics | Select-String 'active_http_requests'
```

- Expected output should be the same.

### Escalation

If this runbook does not resolve the issue within 10 minutes:
1. Post the latency metric lines, readiness output, and Node CPU/memory snapshot in the team channel if one exists.
2. Page the current workspace owner / repository maintainer directly.
3. If there is still no response after 10 more minutes, escalate outside the repo because no formal secondary contact is documented yet.

Do NOT spend more than 20 minutes debugging this alone at 3 AM.
