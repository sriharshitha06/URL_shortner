const express = require("express");
const crypto = require("crypto");
const env = require("../config/env");
const { requireApiKey } = require("./auth");
const { closeDatabase, initDatabase } = require("./db");
const { createRateLimiter } = require("./rate-limit");
const { sendError } = require("./http-response");
const logger = require("./logger");
const {
  createLink,
  deleteLinkByCodeForOwner,
  getLinkByCode,
  getLinkByIdForOwner,
  listLinksForOwner,
} = require("./link-store");

const app = express();

app.set("trust proxy", true);

function requestIdMiddleware(req, res, next) {
  const incomingId = req.header("X-Request-ID");

  req.requestId =
    incomingId && incomingId.trim()
      ? incomingId
      : crypto.randomUUID();

  res.setHeader("X-Request-ID", req.requestId);

  next();
}

function requestLogMiddleware(req, res, next) {
  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const latencyMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

    logger.info({
      event: "request_finished",
      request_id: req.requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      latency_ms: Math.round(latencyMs),
      principal_id: req.principal_id,
    });
  });

  next();
}

app.use(requestIdMiddleware);
app.use(requestLogMiddleware);
app.use(express.json());

const createLinkRateLimit = createRateLimiter({
  limit: env.rateLimits.createLinkPerMinute,
  key: (req) => `create:${req.api_key}`,
});

const deleteLinkRateLimit = createRateLimiter({
  limit: env.rateLimits.deleteLinkPerMinute,
  key: (req) => `delete:${req.api_key}`,
});

const redirectRateLimit = createRateLimiter({
  limit: env.rateLimits.redirectPerMinute,
  key: (req) => `redirect:${req.ip}`,
});

function generateShortCode(length = 6) {
  const alphabet =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let shortCode = "";

  for (let index = 0; index < length; index += 1) {
    const randomIndex = Math.floor(Math.random() * alphabet.length);
    shortCode += alphabet[randomIndex];
  }

  return shortCode;
}

function createUniqueShortCode() {
  return generateShortCode();
}

function containsControlCharacters(value) {
  return /[\u0000-\u001F\u007F]/.test(value);
}

function normalizeUrlInput(value) {
  if (typeof value !== "string") {
    return null;
  }

  if (containsControlCharacters(value)) {
    return null;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  return trimmedValue;
}

function isAllowedRedirectUrl(value) {
  if (!value || value.includes("\\")) {
    return false;
  }

  try {
    const parsedUrl = new URL(value);

    if (
      (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") ||
      !parsedUrl.hostname ||
      parsedUrl.username ||
      parsedUrl.password
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function normalizeTags(value) {
  if (value == null) {
    return [];
  }

  if (!Array.isArray(value)) {
    return null;
  }

  if (value.length > 10) {
    return null;
  }

  const normalizedTags = [];

  for (const tag of value) {
    if (typeof tag !== "string") {
      return null;
    }

    const trimmedTag = tag.trim();

    if (!trimmedTag || trimmedTag.length > 32) {
      return null;
    }

    normalizedTags.push(trimmedTag);
  }

  return normalizedTags;
}

function normalizeExpiresAt(value) {
  if (value == null) {
    return null;
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  if (parsedDate.getTime() <= Date.now()) {
    return null;
  }

  return parsedDate.toISOString();
}

async function persistLink({ longUrl, expiresAt, tags, principalId }) {
  let shortCode = createUniqueShortCode();
  let link;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      link = await createLink({
        shortCode,
        originalUrl: longUrl,
        createdBy: principalId,
        expiresAt,
        tags,
      });
      break;
    } catch (error) {
      if (error.code !== "23505") {
        throw error;
      }

      shortCode = createUniqueShortCode();
    }
  }

  if (!link) {
    throw new Error("Could not generate a unique short code.");
  }

  return link;
}

function formatLinkResponse(link, req) {
  return {
    id: String(link.id),
    code: link.code,
    short_url: `${req.protocol}://${req.get("host")}/r/${link.code}`,
    long_url: link.long_url,
    created_at: link.created_at,
    expires_at: link.expires_at,
    tags: link.tags,
  };
}

app.get("/", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

async function handleCreateLink(req, res, next) {
  const {
    long_url: rawLongUrl,
    expires_at: rawExpiresAt,
    tags: rawTags,
  } = req.body || {};

  const longUrl = normalizeUrlInput(rawLongUrl);
  const expiresAt = normalizeExpiresAt(rawExpiresAt);
  const tags = normalizeTags(rawTags);

  if (!longUrl || !isAllowedRedirectUrl(longUrl)) {
    return sendError(
      req,
      res,
      400,
      "BAD_REQUEST",
      "A valid http/https URL is required."
    );
  }

  if (rawExpiresAt != null && !expiresAt) {
    return sendError(
      req,
      res,
      400,
      "BAD_REQUEST",
      "expires_at must be a valid future timestamp."
    );
  }

  if (tags == null) {
    return sendError(
      req,
      res,
      400,
      "BAD_REQUEST",
      "tags must be an array of up to 10 short strings."
    );
  }

  try {
    const link = await persistLink({
      longUrl,
      expiresAt,
      tags,
      principalId: req.principal_id,
    });

    return res.status(201).json(formatLinkResponse(link, req));
  } catch (error) {
    return next(error);
  }
}

app.post("/shorten", requireApiKey, createLinkRateLimit, handleCreateLink);
app.post("/links", requireApiKey, createLinkRateLimit, handleCreateLink);

app.get("/links", requireApiKey, async (req, res, next) => {
  try {
    const requestedLimit = Number.parseInt(req.query.limit ?? "20", 10);
    const requestedOffset = Number.parseInt(req.query.offset ?? "0", 10);

    if (
      Number.isNaN(requestedLimit) ||
      Number.isNaN(requestedOffset) ||
      requestedLimit <= 0 ||
      requestedLimit > 100 ||
      requestedOffset < 0
    ) {
      return sendError(
        req,
        res,
        400,
        "BAD_REQUEST",
        "limit must be 1-100 and offset must be 0 or greater."
      );
    }

    const links = await listLinksForOwner({
      limit: requestedLimit,
      offset: requestedOffset,
      principalId: req.principal_id,
    });

    return res.json({
      items: links.map((link) => formatLinkResponse(link, req)),
      limit: requestedLimit,
      offset: requestedOffset,
    });
  } catch (error) {
    return next(error);
  }
});

app.get("/links/:id", requireApiKey, async (req, res, next) => {
  try {
    const id = Number.parseInt(req.params.id, 10);

    if (Number.isNaN(id) || id <= 0) {
      return sendError(
        req,
        res,
        400,
        "BAD_REQUEST",
        "Link id must be a positive integer."
      );
    }

    const link = await getLinkByIdForOwner(id, req.principal_id);

    if (!link) {
      return sendError(req, res, 404, "NOT_FOUND", "Link not found.");
    }

    return res.json(formatLinkResponse(link, req));
  } catch (error) {
    return next(error);
  }
});

app.get("/r/:short_code", redirectRateLimit, async (req, res, next) => {
  try {
    const link = await getLinkByCode(req.params.short_code);

    if (!link) {
      return sendError(req, res, 404, "NOT_FOUND", "Short URL not found.");
    }

    return res.redirect(302, link.long_url);
  } catch (error) {
    return next(error);
  }
});

app.delete(
  "/links/:short_code",
  requireApiKey,
  deleteLinkRateLimit,
  async (req, res, next) => {
    try {
      const shortCode = normalizeUrlInput(req.params.short_code);

      if (!shortCode) {
        return sendError(
          req,
          res,
          400,
          "BAD_REQUEST",
          "short_code is required."
        );
      }

      const deletedLink = await deleteLinkByCodeForOwner(
        shortCode,
        req.principal_id
      );

      if (!deletedLink) {
        return sendError(req, res, 404, "NOT_FOUND", "Link not found.");
      }

      return res.json({
        message: "Link deleted.",
        id: String(deletedLink.id),
        code: deletedLink.code,
      });
    } catch (error) {
      return next(error);
    }
  }
);

app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return sendError(req, res, 400, "BAD_REQUEST", "Invalid JSON body");
  }

  logger.error({
    event: "request_failed",
    request_id: req.requestId,
    method: req.method,
    path: req.path,
    status: 500,
    error_name: err.name,
    error_message: err.message,
    stack: err.stack,
    principal_id: req.principal_id,
  });

  return sendError(
    req,
    res,
    500,
    "INTERNAL_ERROR",
    "Something went wrong"
  );
});

async function startServer() {
  await initDatabase();

  app.listen(env.port, () => {
    logger.info({
      event: "server_started",
      port: env.port,
    });
  });
}

process.on("SIGINT", async () => {
  await closeDatabase();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await closeDatabase();
  process.exit(0);
});

startServer().catch((error) => {
  logger.error({
    event: "server_start_failed",
    error_name: error.name,
    error_message: error.message,
    stack: error.stack,
  });

  process.exit(1);
});