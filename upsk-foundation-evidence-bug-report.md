# upsk Foundation Evidence Gating Bug

## Summary

`AI-Augmented Engineering` cannot be started because `upsk` reports:

```text
System Design Launchpad is complete, but the app foundation evidence is missing.
```

However, the public `upsk` profile for this account shows that `System Design Fundamentals` is fully completed with published proof cards, proof ledger entries, and a verified badge.

## Account / Environment

- Username: `sriharshitha06`
- Public profile: `https://www.upsk.to/sriharshitha06`
- Workspace: `D:\CAW`
- CLI: `upsk.exe 0.1.16`
- Date observed: `2026-05-03`

## Reproduction

1. Start or resume `System Design Fundamentals`.
2. Complete the skill and confirm public profile evidence exists.
3. Run:

```powershell
.\.bin\upsk.exe start --skill ai-augmented-engineering --json
```

## Actual Result

The command returns:

```json
{
  "content": "Your current progress is saved. System Design Launchpad is complete, but the app foundation evidence is missing.",
  "data": {
    "status": "workspace_required",
    "requested_skill": "ai-augmented-engineering"
  }
}
```

## Expected Result

`AI-Augmented Engineering` should start, because the public profile already shows completed app-foundation evidence from `System Design Fundamentals`.

## Evidence That Completion Exists

### Public Profile Facts

Fetched from `https://www.upsk.to/sriharshitha06`:

- `System Design Fundamentals` status: `completed`
- `progress_percent`: `100`
- `evaluated_modules`: `10`
- `completed_required_modules`: `10`
- `app_foundation_proof_required`: `false`
- `gated_skill_count`: `0`

### Public Proof Examples Present On Profile

- Module 10: `Deployment-safe API startup and readiness contract`
- Module 9: `Integration test harness and in-memory reset path`
- Module 8: `GET /links/search endpoint and module-08 regression script`
- Module 6: `Redirect caching flow for GET /r/:short_code and delete-path invalidation`
- Module 1: `Express URL shortener routes and env validation`

### Public Proof Cards Present

- `Made sound technical tradeoffs`
- `Demonstrated strong debugging judgment`
- `Improved production readiness`
- `Communicated technical decisions clearly`
- `Caught meaningful security risks`

## Additional Contradiction

Running:

```powershell
.\.bin\upsk.exe sync --json
```

returns:

```json
{
  "content": "Synced progress at 4%",
  "achievements": ["session_synced"]
}
```

The local recovery session is still stuck in:

- Skill: `System Design Fundamentals`
- Pack: `Launchpad`
- Module: `01`
- Step: `DECIDE`

That recovery state conflicts with the public profile, which already shows the full skill as completed.

## Likely Cause

This appears to be a platform state mismatch between:

- public profile / proof-card completion state
- skill-start gating logic for `AI-Augmented Engineering`
- local workspace evidence lane / recovery session state

## Suggested Investigation

Check whether the unlock gate for `AI-Augmented Engineering` is reading:

- stale workspace-route evidence state
- an incomplete launchpad-specific artifact lane
- or a different completion source than the one used to render the public profile

## Commands Run

```powershell
.\.bin\upsk.exe profile --json
.\.bin\upsk.exe start --skill ai-augmented-engineering --json
.\.bin\upsk.exe status --all
.\.bin\upsk.exe sync --json
curl.exe -L https://www.upsk.to/sriharshitha06
```
