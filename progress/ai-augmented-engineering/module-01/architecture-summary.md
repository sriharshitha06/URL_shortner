## Architecture Summary

### Main entry point and startup flow

- `src/index.js` is the application entry point.
- It creates the Express app, loads environment config from `config/env.js`, installs request ID, request logging, and JSON middleware, registers route-specific rate limiters, mounts routes, initializes the database with `initDatabase()`, and starts listening on `0.0.0.0:$PORT`.
- On `SIGINT` and `SIGTERM`, it closes the database pool before exit.

### Top-level directories

- `.bin`: local helper binaries or generated tooling artifacts.
- `.github`: GitHub-related automation/config.
- `artifacts`: saved outputs or evidence from previous module work.
- `config`: runtime configuration code.
- `node_modules`: installed dependencies.
- `progress`: module evidence and progress artifacts.
- `scripts`: one-off verification or helper scripts.
- `src`: application runtime code.
- `test`: integration tests.

### Major modules and request/data flow

- `config/env.js`: loads `.env`, validates env vars, parses API key mapping, and sets rate-limit config.
- `src/index.js`: app composition, validation helpers, route handlers, startup/shutdown.
- `src/auth.js`: API-key auth middleware.
- `src/db.js`: PostgreSQL pool, schema bootstrap, query function.
- `src/link-store.js`: persistence layer for PostgreSQL and in-memory mode.
- `src/http-response.js`: shared error response formatter.
- `src/logger.js`: JSON logger with secret redaction.
- `src/rate-limit.js`: in-memory rate limiter factory.

Request flow:

`client -> request ID middleware -> request logging middleware -> JSON parser -> optional auth middleware -> optional rate limiter -> route handler in src/index.js -> src/link-store.js -> src/db.js or in-memory store -> response`

### API routes

- `GET /`: liveness response.
- `GET /health`: health check.
- `GET /ready`: readiness check; probes PostgreSQL unless in-memory mode is enabled.
- `POST /__test/reset`: resets in-memory store; only mounted when `USE_IN_MEMORY_STORE=true`.
- `POST /shorten`: create short link; protected by `requireApiKey` and create-link rate limit.
- `POST /links`: create short link; protected by `requireApiKey` and create-link rate limit.
- `GET /links`: list current user's links; protected by `requireApiKey`.
- `GET /links/search`: search current user's links; protected by `requireApiKey`.
- `GET /links/:id`: fetch one link by ID for current owner; protected by `requireApiKey`.
- `GET /r/:short_code`: public redirect route; protected by redirect rate limit only.
- `DELETE /links/:short_code`: delete one link owned by current user; protected by `requireApiKey` and delete rate limit.

### Data models

#### links

- Fields: `id`, `code`, `long_url`, `created_at`, `created_by`, `expires_at`, `tags`
- Constraints: primary key on `id`, unique index on `code`, index on `created_by`, GIN search index over `code` and `long_url`, GIN index on `tags`
- Relationship: parent table for `click_events`

#### click_events

- Fields: `id`, `link_id`, `clicked_at`, `user_agent`, `referrer`, `ip_hash`
- Constraints: primary key on `id`, index on `(link_id, clicked_at)`
- Relationship: `link_id` references `links(id)` with `ON DELETE CASCADE`

### Authentication and authorization

- Authentication is API-key based through `src/auth.js`.
- It reads `X-API-Key`, looks up the key in `env.apiKeys`, and populates `req.api_key` and `req.principal_id`.
- Protected routes: `POST /shorten`, `POST /links`, `GET /links`, `GET /links/search`, `GET /links/:id`, `DELETE /links/:short_code`
- Public routes: `GET /`, `GET /health`, `GET /ready`, `GET /r/:short_code`, and test reset in in-memory mode.
- Authorization is owner-scoped in persistence queries through `created_by = principalId`.

### Database details

- Database type: PostgreSQL via `pg`
- Connection method: `Pool` created from `env.databaseUrl`
- Required env vars: `API_KEYS`; `DATABASE_URL` unless `USE_IN_MEMORY_STORE=true`
- Optional env vars: `PORT`, `USE_IN_MEMORY_STORE`
- No separate migration system is visible; schema bootstrap happens in `initDatabase()` in `src/db.js`

### External dependencies

- `express`: HTTP server and routing
- `dotenv`: loads `.env`
- `pg`: PostgreSQL access
- Node built-ins: `crypto`, `path`, `node:test`, `node:assert`, `node:child_process`

### Test setup

- Test command: `npm test`
- Test runner: `node --test test/*.test.js`
- Visible test file: `test/module-09.integration.test.js`
- Tests spawn the server in in-memory mode, inject API keys, call HTTP endpoints, and assert end-to-end behavior.

### Safest integration seams

- Add new routes in `src/index.js`
- Add schema/bootstrap changes in `src/db.js`
- Add persistence/query logic in `src/link-store.js`
- Reuse `requireApiKey`, request validation helpers, `sendError()`, and route-level rate limiting patterns

### Assumptions and risks to verify

- `click_events` exists, but no visible redirect write path records click analytics.
- The app's HTTP layer is concentrated in `src/index.js`, so larger features may increase coupling if they do not preserve the existing layering.
- Rate limiting is in-memory only.
- There is no visible migration framework.
