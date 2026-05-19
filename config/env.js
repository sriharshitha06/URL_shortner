const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function parseJsonEnv(name) {
  const rawValue = getRequiredEnv(name);

  try {
    const parsedValue = JSON.parse(rawValue);

    if (!parsedValue || typeof parsedValue !== "object" || Array.isArray(parsedValue)) {
      throw new Error("must be a JSON object");
    }

    return parsedValue;
  } catch (error) {
    throw new Error(`Invalid ${name}: ${error.message}`);
  }
}

const portValue = process.env.PORT || "3000";
const port = Number.parseInt(portValue, 10);
const useInMemoryStore = process.env.USE_IN_MEMORY_STORE === "true";
const allowedLogLevels = new Set(["info", "warn", "error"]);
const rawLogLevel = (process.env.LOG_LEVEL || "info").trim().toLowerCase();
const allowedAppEnvironments = new Set([
  "development",
  "test",
  "staging",
  "production",
]);
const rawAppEnv = (process.env.APP_ENV || "development").trim().toLowerCase();
const serviceName = (process.env.SERVICE_NAME || "url-shortener").trim();
const appVersion = (process.env.APP_VERSION || "dev-local").trim();
const databaseQueryTimeoutMsValue = process.env.DATABASE_QUERY_TIMEOUT_MS || "1000";
const databaseCircuitResetTimeoutMsValue =
  process.env.DATABASE_CIRCUIT_RESET_TIMEOUT_MS || "30000";
const databaseCircuitVolumeThresholdValue =
  process.env.DATABASE_CIRCUIT_VOLUME_THRESHOLD || "5";
const databaseCircuitErrorThresholdPercentValue =
  process.env.DATABASE_CIRCUIT_ERROR_THRESHOLD_PERCENT || "50";
const databaseRetryAttemptsValue = process.env.DATABASE_RETRY_ATTEMPTS || "2";
const databaseRetryBaseDelayMsValue = process.env.DATABASE_RETRY_BASE_DELAY_MS || "100";
const databaseRetryMaxDelayMsValue = process.env.DATABASE_RETRY_MAX_DELAY_MS || "500";
const databaseRetryJitterMsValue = process.env.DATABASE_RETRY_JITTER_MS || "50";
const databaseQueryTimeoutMs = Number.parseInt(databaseQueryTimeoutMsValue, 10);
const databaseCircuitResetTimeoutMs = Number.parseInt(databaseCircuitResetTimeoutMsValue, 10);
const databaseCircuitVolumeThreshold = Number.parseInt(databaseCircuitVolumeThresholdValue, 10);
const databaseCircuitErrorThresholdPercent = Number.parseInt(
  databaseCircuitErrorThresholdPercentValue,
  10
);
const databaseRetryAttempts = Number.parseInt(databaseRetryAttemptsValue, 10);
const databaseRetryBaseDelayMs = Number.parseInt(databaseRetryBaseDelayMsValue, 10);
const databaseRetryMaxDelayMs = Number.parseInt(databaseRetryMaxDelayMsValue, 10);
const databaseRetryJitterMs = Number.parseInt(databaseRetryJitterMsValue, 10);

if (Number.isNaN(port) || port <= 0) {
  throw new Error("PORT must be a positive integer");
}

if (!allowedLogLevels.has(rawLogLevel)) {
  throw new Error("LOG_LEVEL must be one of: info, warn, error");
}

if (!allowedAppEnvironments.has(rawAppEnv)) {
  throw new Error("APP_ENV must be one of: development, test, staging, production");
}

if (!serviceName) {
  throw new Error("SERVICE_NAME must not be empty");
}

if (!appVersion) {
  throw new Error("APP_VERSION must not be empty");
}

for (const [name, value] of [
  ["DATABASE_QUERY_TIMEOUT_MS", databaseQueryTimeoutMs],
  ["DATABASE_CIRCUIT_RESET_TIMEOUT_MS", databaseCircuitResetTimeoutMs],
  ["DATABASE_CIRCUIT_VOLUME_THRESHOLD", databaseCircuitVolumeThreshold],
  ["DATABASE_CIRCUIT_ERROR_THRESHOLD_PERCENT", databaseCircuitErrorThresholdPercent],
  ["DATABASE_RETRY_ATTEMPTS", databaseRetryAttempts],
  ["DATABASE_RETRY_BASE_DELAY_MS", databaseRetryBaseDelayMs],
  ["DATABASE_RETRY_MAX_DELAY_MS", databaseRetryMaxDelayMs],
  ["DATABASE_RETRY_JITTER_MS", databaseRetryJitterMs],
]) {
  if (Number.isNaN(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
}

const env = {
  databaseUrl: useInMemoryStore
    ? process.env.DATABASE_URL || ""
    : getRequiredEnv("DATABASE_URL"),
  port,
  appEnv: rawAppEnv,
  serviceName,
  appVersion,
  logLevel: rawLogLevel,
  apiKeys: parseJsonEnv("API_KEYS"),
  rateLimits: {
    createLinkPerMinute: 10,
    deleteLinkPerMinute: 5,
    redirectPerMinute: 100,
  },
  database: {
    queryTimeoutMs: databaseQueryTimeoutMs,
    circuitResetTimeoutMs: databaseCircuitResetTimeoutMs,
    circuitVolumeThreshold: databaseCircuitVolumeThreshold,
    circuitErrorThresholdPercent: databaseCircuitErrorThresholdPercent,
    retryAttempts: databaseRetryAttempts,
    retryBaseDelayMs: databaseRetryBaseDelayMs,
    retryMaxDelayMs: databaseRetryMaxDelayMs,
    retryJitterMs: databaseRetryJitterMs,
  },
  useInMemoryStore,
};

module.exports = env;
