function createRateLimiter({ limit, key, windowMs = 60_000 }) {
  const requestsByActor = new Map();

  return function rateLimit(req, res, next) {
    const actorKey = key(req);
    const now = Date.now();
    const currentEntry = requestsByActor.get(actorKey);

    if (!currentEntry || currentEntry.resetAt <= now) {
      requestsByActor.set(actorKey, {
        count: 1,
        resetAt: now + windowMs,
      });
      return next();
    }

    if (currentEntry.count >= limit) {
      return res.status(429).json({
        error: "Too Many Requests",
      });
    }

    currentEntry.count += 1;
    return next();
  };
}

module.exports = {
  createRateLimiter,
};
