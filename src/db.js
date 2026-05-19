const CircuitBreaker = require("opossum");
const { Pool } = require("pg");
const env = require("../config/env");
const logger = require("./logger");

const pool = new Pool({
  connectionString: env.databaseUrl,
});

class DependencyUnavailableError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "DependencyUnavailableError";
    this.statusCode = 503;
    this.errorCode = "DEPENDENCY_UNAVAILABLE";
    this.details = details;
  }
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function inferOperation(text) {
  const normalizedText = String(text || "").trim().toUpperCase();

  if (!normalizedText) {
    return "unknown_query";
  }

  return normalizedText.split(/\s+/, 1)[0].toLowerCase();
}

function isRetryableDependencyError(error) {
  const code = error?.code;
  const message = String(error?.message || "").toLowerCase();

  if (
    [
      "ECONNRESET",
      "ETIMEDOUT",
      "ECONNREFUSED",
      "ENOTFOUND",
      "EAI_AGAIN",
      "57P01",
      "57P02",
      "57P03",
      "53300",
    ].includes(code)
  ) {
    return true;
  }

  return (
    message.includes("timeout") ||
    message.includes("getaddrinfo") ||
    message.includes("name or service not known") ||
    message.includes("connection terminated unexpectedly")
  );
}

function isTimeoutError(error) {
  const message = String(error?.message || "").toLowerCase();

  return error?.code === "ETIMEDOUT" || message.includes("timeout");
}

function isNameResolutionError(error) {
  const message = String(error?.message || "").toLowerCase();

  return (
    ["ENOTFOUND", "EAI_AGAIN"].includes(error?.code) ||
    message.includes("getaddrinfo") ||
    message.includes("name or service not known")
  );
}

function toDependencyUnavailableError(error, operation, attemptCount) {
  if (error instanceof DependencyUnavailableError) {
    return error;
  }

  const reason = isNameResolutionError(error)
    ? "database hostname resolution failed"
    : isTimeoutError(error)
      ? "database query timed out"
      : "database is unavailable";

  return new DependencyUnavailableError(reason, {
    dependency: "database",
    operation,
    originalCode: error?.code || null,
    attemptCount,
  });
}

async function executeQuery({ text, params }) {
  return pool.query({
    text,
    values: params,
    query_timeout: env.database.queryTimeoutMs,
  });
}

async function retryWithBackoff(fn, { operation }) {
  const {
    retryAttempts,
    retryBaseDelayMs,
    retryMaxDelayMs,
    retryJitterMs,
  } = env.database;

  let lastError;

  for (let attempt = 0; attempt <= retryAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!isRetryableDependencyError(error) || attempt === retryAttempts) {
        break;
      }

      const exponentialDelay = Math.min(
        retryBaseDelayMs * (2 ** attempt),
        retryMaxDelayMs
      );
      const jitterOffset =
        Math.floor(Math.random() * (retryJitterMs * 2 + 1)) - retryJitterMs;
      const delayMs = Math.max(0, exponentialDelay + jitterOffset);

      logger.warn({
        event: "retry_attempt",
        message: "retrying dependency call",
        dependency: "database",
        operation,
        attempt: attempt + 1,
        max_retries: retryAttempts,
        delay_ms: delayMs,
        error_code: error?.code || null,
        error_message: error?.message,
      });

      await sleep(delayMs);
    }
  }

  throw lastError;
}

function createDatabaseBreaker(action, options = {}) {
  const breaker = new CircuitBreaker(action, {
    timeout: options.timeout ?? env.database.queryTimeoutMs,
    errorThresholdPercentage:
      options.errorThresholdPercentage ?? env.database.circuitErrorThresholdPercent,
    resetTimeout: options.resetTimeout ?? env.database.circuitResetTimeoutMs,
    volumeThreshold: options.volumeThreshold ?? env.database.circuitVolumeThreshold,
  });

  breaker.fallback(({ operation }) => {
    logger.warn({
      event: "circuit_open_fallback",
      message: "circuit breaker returned fallback response",
      dependency: "database",
      operation,
    });

    throw new DependencyUnavailableError("database circuit is open", {
      dependency: "database",
      operation,
      circuitState: "open",
    });
  });

  breaker.on("open", () => {
    logger.error({
      event: "circuit_opened",
      message: "database circuit opened",
      dependency: "database",
    });
  });

  breaker.on("halfOpen", () => {
    logger.info({
      event: "circuit_half_open",
      message: "database circuit half-open",
      dependency: "database",
    });
  });

  breaker.on("close", () => {
    logger.info({
      event: "circuit_closed",
      message: "database circuit closed",
      dependency: "database",
    });
  });

  breaker.on("timeout", () => {
    logger.warn({
      event: "dependency_timeout",
      message: "dependency timed out",
      dependency: "database",
      timeout_ms: options.timeout ?? env.database.queryTimeoutMs,
    });
  });

  return breaker;
}

const databaseBreaker = createDatabaseBreaker(
  async ({ text, params, operation }) =>
    retryWithBackoff(
      () => executeQuery({ text, params, operation }),
      { operation }
    )
);

async function query(text, params = []) {
  if (env.useInMemoryStore) {
    throw new Error("Database query called while USE_IN_MEMORY_STORE=true");
  }

  const operation = inferOperation(text);

  try {
    return await databaseBreaker.fire({ text, params, operation });
  } catch (error) {
    const normalizedError = toDependencyUnavailableError(
      error,
      operation,
      env.database.retryAttempts + 1
    );

    logger.warn({
      event: "dependency_failure",
      message: normalizedError.message,
      dependency: "database",
      operation,
      timeout_ms: env.database.queryTimeoutMs,
      error_code: error?.code || normalizedError.errorCode,
      error_message: error?.message || normalizedError.message,
    });

    throw normalizedError;
  }
}

async function initDatabase() {
  if (env.useInMemoryStore) {
    return;
  }

  await query(`
    CREATE TABLE IF NOT EXISTS links (
      id BIGSERIAL PRIMARY KEY,
      code VARCHAR(32) NOT NULL,
      long_url TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_by TEXT NOT NULL DEFAULT 'public',
      expires_at TIMESTAMPTZ NULL,
      tags TEXT[] NOT NULL DEFAULT '{}'
    )
  `);

  await query(`
    ALTER TABLE links
    ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}'
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS links_code_unique_idx
    ON links (code)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS links_created_by_idx
    ON links (created_by)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS links_search_document_gin_idx
    ON links
    USING GIN (to_tsvector('simple', coalesce(code, '') || ' ' || coalesce(long_url, '')))
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS links_tags_gin_idx
    ON links
    USING GIN (tags)
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS click_events (
      id BIGSERIAL PRIMARY KEY,
      link_id BIGINT NOT NULL REFERENCES links(id) ON DELETE CASCADE,
      clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      user_agent TEXT NULL,
      referrer TEXT NULL,
      ip_hash TEXT NULL
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS click_events_link_id_clicked_at_idx
    ON click_events (link_id, clicked_at)
  `);
}

async function closeDatabase() {
  if (env.useInMemoryStore) {
    return;
  }

  await pool.end();
}

module.exports = {
  DependencyUnavailableError,
  closeDatabase,
  createDatabaseBreaker,
  databaseBreaker,
  initDatabase,
  inferOperation,
  isNameResolutionError,
  isRetryableDependencyError,
  isTimeoutError,
  query,
  retryWithBackoff,
};
