const express = require("express");
const crypto = require("crypto");
const env = require("../config/env");
const { requireApiKey } = require("./auth");
const { closeDatabase, initDatabase, query } = require("./db");
const { createRateLimiter } = require("./rate-limit");
const { sendError } = require("./http-response");
const logger = require("./logger");
const teamInvitationsRouter = require("./routes/teamInvitations.routes");
const {
  createLink,
  deleteLinkByCodeForOwner,
  getLinkByCode,
  getLinkByIdForOwner,
  listLinksForOwner,
  resetInMemoryStore,
  searchLinksForOwner,
} = require("./link-store");

const app = express();
const HOST = "0.0.0.0";

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

  logger.info({
    event: "request_received",
    request_id: req.requestId,
    method: req.method,
    path: req.path,
    principal_id: req.principal_id,
  });

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
app.use(teamInvitationsRouter);

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
  return [...value].some((char) => {
    const code = char.charCodeAt(0);
    return code <= 31 || code === 127;
  });
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
  if (value === null || value === undefined) {
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
  if (value === null || value === undefined) {
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

function normalizeSearchQuery(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  if (typeof value !== "string" || containsControlCharacters(value)) {
    return null;
  }

  const trimmedValue = value.trim();

  if (trimmedValue.length > 100) {
    return null;
  }

  return trimmedValue;
}

function normalizeOptionalTag(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue || trimmedValue.length > 32) {
    return undefined;
  }

  return trimmedValue;
}

function normalizeTimestampQuery(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return undefined;
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

app.get("/ready", async (_req, res) => {
  if (env.useInMemoryStore) {
    return res.status(200).json({
      status: "ready",
      store: "in_memory",
    });
  }

  try {
    await query("SELECT 1");

    return res.status(200).json({
      status: "ready",
      store: "postgres",
    });
  } catch {
    return res.status(503).json({
      status: "not_ready",
      store: "postgres",
    });
  }
});

if (env.useInMemoryStore) {
  app.post("/__test/reset", (_req, res) => {
    resetInMemoryStore();
    res.status(204).send();
  });
}

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

  if (rawExpiresAt !== null && rawExpiresAt !== undefined && !expiresAt) {
    return sendError(
      req,
      res,
      400,
      "BAD_REQUEST",
      "expires_at must be a valid future timestamp."
    );
  }

  if (tags === null) {
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
    const limit = Number.parseInt(req.query.limit ?? "20", 10);
    const requestedAfterId = req.query.after_id;

    if (!Number.isInteger(limit) || limit <= 0) {
      return sendError(req, res, 400, "VALIDATION_ERROR", "limit must be a positive integer.");
    }

    if (req.query.after_id !== undefined && (req.query.page !== undefined || req.query.offset !== undefined)) {
      return sendError(
        req,
        res,
        400,
        "VALIDATION_ERROR",
        "Use after_id by itself, not with page or offset."
      );
    }

    let offset;
    let afterId = null;
    let page;

    if (requestedAfterId !== undefined) {
      afterId = Number.parseInt(requestedAfterId, 10);

      if (!Number.isInteger(afterId) || afterId <= 0) {
        return sendError(req, res, 400, "VALIDATION_ERROR", "after_id must be a positive integer.");
      }

      offset = 0;
    } else if (req.query.page !== undefined) {
      page = Number.parseInt(req.query.page, 10);

      if (!Number.isInteger(page) || page <= 0) {
        return sendError(req, res, 400, "VALIDATION_ERROR", "page must be a positive integer.");
      }

      offset = (page - 1) * limit;
    } else {
      offset = Number.parseInt(req.query.offset ?? "0", 10);

      if (!Number.isInteger(offset) || offset < 0) {
        return sendError(req, res, 400, "VALIDATION_ERROR", "offset must be a non-negative integer.");
      }
    }

    const links = await listLinksForOwner({
      limit,
      offset,
      afterId,
      principalId: req.principal_id,
    });

    return res.json({
      items: links.map((link) => formatLinkResponse(link, req)),
      limit,
      offset,
      after_id: afterId,
      next_after_id: links.length ? String(links[links.length - 1].id) : null,
      ...(page !== undefined ? { page } : {}),
    });
  } catch (error) {
    return next(error);
  }
});

app.get("/links/search", requireApiKey, async (req, res, next) => {
  try {
    const q = normalizeSearchQuery(req.query.q);
    const tag = normalizeOptionalTag(req.query.tag);
    const createdAfter = normalizeTimestampQuery(req.query.created_after);
    const createdBefore = normalizeTimestampQuery(req.query.created_before);
    const requestedPage = Number.parseInt(req.query.page ?? "1", 10);
    const requestedPageSize = Number.parseInt(req.query.page_size ?? "20", 10);
    const sortBy = req.query.sort_by ?? "created_at";
    const allowedSortBy = new Set(["created_at", "click_count"]);

    if (q === null) {
      return sendError(
        req,
        res,
        400,
        "BAD_REQUEST",
        "q must be a short text value without control characters."
      );
    }

    if (tag === undefined || createdAfter === undefined || createdBefore === undefined) {
      return sendError(
        req,
        res,
        400,
        "BAD_REQUEST",
        "tag and date filters must be valid values."
      );
    }

    if (
      Number.isNaN(requestedPage) ||
      Number.isNaN(requestedPageSize) ||
      requestedPage < 1 ||
      requestedPageSize < 1
    ) {
      return sendError(
        req,
        res,
        400,
        "BAD_REQUEST",
        "page and page_size must be positive integers."
      );
    }

    if (!allowedSortBy.has(sortBy)) {
      return sendError(
        req,
        res,
        400,
        "BAD_REQUEST",
        "sort_by must be one of: created_at, click_count."
      );
    }

    const pageSize = Math.min(requestedPageSize, 50);
    const page = requestedPage;
    const { items, total } = await searchLinksForOwner({
      principalId: req.principal_id,
      queryText: q,
      tag,
      createdAfter,
      createdBefore,
      page,
      pageSize,
      sortBy,
    });

    return res.json({
      items: items.map((link) => ({
        ...formatLinkResponse(link, req),
        click_count: link.click_count ?? 0,
      })),
      page,
      page_size: pageSize,
      total,
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

  const server = app.listen(env.port, HOST, () => {
    logger.info({
      event: "server_started",
      host: HOST,
      port: env.port,
    });
  });

  return server;
}

process.on("SIGINT", async () => {
  await closeDatabase();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await closeDatabase();
  process.exit(0);
});

if (require.main === module) {
  startServer().catch((error) => {
    logger.error({
      event: "server_start_failed",
      error_name: error.name,
      error_message: error.message,
      stack: error.stack,
    });

    process.exit(1);
  });
}

module.exports = app;