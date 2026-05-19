# Module 4 Observability Runbook

## HighErrorRate

1. Check `GET /metrics` and confirm `http_requests_total` is increasing for 5xx responses.
2. Filter logs by `request_id` and `status=500` to identify the failing route.
3. Inspect recent application errors and the readiness endpoint to see whether the failure is app logic or a dependency outage.

## HighLatency

1. Check `http_request_duration_seconds` to confirm the p95 spike is sustained.
2. Compare slow paths in `http_requests_total` with request logs to identify the affected route.
3. Confirm whether `/ready` is still healthy to separate app slowdown from dependency unavailability.

## ServiceDown

1. Confirm the process or container is running.
2. Check `/live` and `/ready` locally if the process exists.
3. Review startup and crash logs for `server_started` or `server_start_failed`.
