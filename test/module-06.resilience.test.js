const test = require("node:test");
const assert = require("node:assert/strict");

process.env.APP_ENV = "test";
process.env.LOG_LEVEL = "error";
process.env.SERVICE_NAME = "url-shortener";
process.env.USE_IN_MEMORY_STORE = "false";
process.env.API_KEYS = JSON.stringify({ "test-key-a": "A" });
process.env.DATABASE_URL = "postgresql://unused:unused@localhost:5432/unused";
process.env.DATABASE_RETRY_ATTEMPTS = "2";
process.env.DATABASE_RETRY_BASE_DELAY_MS = "0";
process.env.DATABASE_RETRY_MAX_DELAY_MS = "0";
process.env.DATABASE_RETRY_JITTER_MS = "0";
process.env.DATABASE_QUERY_TIMEOUT_MS = "25";
process.env.DATABASE_CIRCUIT_RESET_TIMEOUT_MS = "25";
process.env.DATABASE_CIRCUIT_VOLUME_THRESHOLD = "1";
process.env.DATABASE_CIRCUIT_ERROR_THRESHOLD_PERCENT = "1";

const {
  DependencyUnavailableError,
  createDatabaseBreaker,
  isRetryableDependencyError,
  retryWithBackoff,
} = require("../src/db");

test("marks transient dependency errors as retryable", () => {
  assert.equal(
    isRetryableDependencyError({ code: "ETIMEDOUT", message: "query timeout" }),
    true
  );
  assert.equal(
    isRetryableDependencyError({ code: "ENOTFOUND", message: "getaddrinfo ENOTFOUND db" }),
    true
  );
  assert.equal(
    isRetryableDependencyError({ code: "23505", message: "duplicate key value" }),
    false
  );
});

test("retries transient failures and eventually succeeds", async () => {
  let attemptCount = 0;

  const result = await retryWithBackoff(async () => {
    attemptCount += 1;

    if (attemptCount < 3) {
      const error = new Error("temporary timeout");
      error.code = "ETIMEDOUT";
      throw error;
    }

    return "ok";
  }, { operation: "test_query" });

  assert.equal(result, "ok");
  assert.equal(attemptCount, 3);
});

test("opens the circuit and returns a dependency-unavailable fallback", async (t) => {
  const breaker = createDatabaseBreaker(
    async () => {
      const error = new Error("getaddrinfo ENOTFOUND postgres");
      error.code = "ENOTFOUND";
      throw error;
    },
    {
      timeout: 25,
      errorThresholdPercentage: 1,
      resetTimeout: 25,
      volumeThreshold: 1,
    }
  );

  t.after(async () => {
    if (typeof breaker.shutdown === "function") {
      await breaker.shutdown();
    }
  });

  await assert.rejects(breaker.fire({ operation: "dns_failure_probe" }));
  assert.equal(breaker.opened, true);

  await assert.rejects(
    breaker.fire({ operation: "dns_failure_probe" }),
    (error) => {
      assert.equal(error instanceof DependencyUnavailableError, true);
      assert.equal(error.statusCode, 503);
      assert.equal(error.details.circuitState, "open");
      return true;
    }
  );
});
