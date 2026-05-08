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

if (Number.isNaN(port) || port <= 0) {
  throw new Error("PORT must be a positive integer");
}

if (!allowedLogLevels.has(rawLogLevel)) {
  throw new Error("LOG_LEVEL must be one of: info, warn, error");
}

const env = {
  databaseUrl: useInMemoryStore
    ? process.env.DATABASE_URL || ""
    : getRequiredEnv("DATABASE_URL"),
  port,
  logLevel: rawLogLevel,
  apiKeys: parseJsonEnv("API_KEYS"),
  rateLimits: {
    createLinkPerMinute: 10,
    deleteLinkPerMinute: 5,
    redirectPerMinute: 100,
  },
  useInMemoryStore,
};

module.exports = env;
