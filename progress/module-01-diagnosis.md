# Module 01 Diagnosis Notes

## Bug 1
- Symptom: App startup fails immediately with `Missing required environment variable: DATABASE_URL`.
- Hypothesis A:
  - Command: `Get-Content .env | Select-String "USE_IN_MEMORY_STORE"`
  - Observation: Earlier in the session this explained why the lab bug did not reproduce, but after switching to DB-backed mode it was no longer the active cause.
- Hypothesis B:
  - Command: `Get-Content .env | Select-String "DATABASE_URL|DB_URL"`
  - Observation: `.env` contains `DB_URL`, not `DATABASE_URL`, which matches the startup failure.
- Fix: Rename `DB_URL` to `DATABASE_URL` in `.env` while keeping `USE_IN_MEMORY_STORE=false`.
- Verification proof: `curl -sS http://localhost:3000/health` returned `{"status":"ok"}` after the config fix. A later `node src/index.js` run failed with `EADDRINUSE` on port `3000`, which confirms another healthy app instance was already running rather than the original startup bug persisting.

## Bug 2
- Symptom:
- Hypothesis A:
  - Command:
  - Observation:
- Hypothesis B:
  - Command:
  - Observation:
- Fix:
- Verification proof:
