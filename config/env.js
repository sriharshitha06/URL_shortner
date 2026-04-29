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

const portValue = process.env.PORT || "3000";
const port = Number.parseInt(portValue, 10);

if (Number.isNaN(port) || port <= 0) {
  throw new Error("PORT must be a positive integer");
}

const env = {
  databaseUrl: getRequiredEnv("DATABASE_URL"),
  port,
  jwtSecret: getRequiredEnv("JWT_SECRET"),
};

module.exports = env;
