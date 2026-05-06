## Extension Points Summary

- New API routes should be added in `src/index.js` and should follow the existing pattern:
  `optional preprocessing middleware -> requireApiKey where needed -> route-specific rate limit where needed -> input validation -> persistence call -> sendError on failure`.

- New persisted entities should be introduced in `src/db.js` because schema bootstrap currently lives inside `initDatabase()`.

- New persistence and query functions should live in `src/link-store.js`, which is the current boundary between HTTP handlers and storage.

- Authentication should be enforced at the route layer with `requireApiKey` in `src/auth.js`, and authorization should be enforced again in persistence queries through owner scoping.

- Validation currently lives near route handlers in `src/index.js`, and structured error responses should continue using `sendError()` from `src/http-response.js`.

- Any new middleware should be added in `src/index.js`, either globally like request ID and logging middleware or per-route like auth and rate limiting.

- There is no visible background-job or queue pattern. Before introducing one, verify job durability, retries, failure handling, in-memory test compatibility, and fit with the current single-process app model.

- Tests should extend the current end-to-end pattern in `test/module-09.integration.test.js`: spawn the server, run in in-memory mode, call the HTTP API, and verify auth, ownership, validation, happy path, and edge cases.

- Existing patterns that should not be bypassed: `requireApiKey`, owner-scoped queries, request validation before writes, `sendError()`, `src/link-store.js` as the persistence boundary, and `src/db.js` as the schema/bootstrap location.

- Main placement risks: embedding SQL directly in route handlers, enforcing ownership only in handlers instead of in queries, fragmenting schema setup outside `src/db.js`, or inventing an unrelated module structure that breaks the current layering.
