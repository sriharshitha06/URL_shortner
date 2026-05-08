const env = require("../config/env");

const SECRET_KEYS = [
  "authorization",
  "x-api-key",
  "cookie",
  "set-cookie",
  "password",
  "token",
  "secret",
];

function redact(value) {
  if (!value || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(redact);
  }

  const output = {};

  for (const [key, val] of Object.entries(value)) {
    const lowerKey = key.toLowerCase();

    output[key] = SECRET_KEYS.some((secret) => lowerKey.includes(secret))
      ? "[REDACTED]"
      : redact(val);
  }

  return output;
}

const LOG_PRIORITIES = {
  info: 20,
  warn: 30,
  error: 40,
};

function shouldLog(level) {
  return LOG_PRIORITIES[level] >= LOG_PRIORITIES[env.logLevel];
}

function write(level, fields) {
  if (!shouldLog(level)) {
    return;
  }

  const safeFields = redact({
    level,
    timestamp: new Date().toISOString(),
    ...fields,
  });

  const line = JSON.stringify(safeFields);

  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

module.exports = {
  info: (fields) => write("info", fields),
  warn: (fields) => write("warn", fields),
  error: (fields) => write("error", fields),
};
