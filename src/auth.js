const env = require("../config/env");
const { sendError } = require("./http-response");

function requireApiKey(req, res, next) {
  const providedApiKey = req.header("x-api-key");
  const principalId = providedApiKey
    ? env.apiKeys[providedApiKey]
    : undefined;

  if (!principalId) {
    return sendError(
      req,
      res,
      401,
      "UNAUTHORIZED",
      "Missing or invalid API key"
    );
  }

  req.api_key = providedApiKey;
  req.principal_id = principalId;

  return next();
}

module.exports = { requireApiKey };