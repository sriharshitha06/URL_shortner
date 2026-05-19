const client = require("prom-client");
const env = require("../config/env");
const { countActiveLinks } = require("./link-store");

const registry = new client.Registry();

client.collectDefaultMetrics({ register: registry });

const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests handled by the service",
  labelNames: ["service", "method", "path", "status"],
  registers: [registry],
});

const httpRequestDurationSeconds = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["service", "method", "path", "status"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
  registers: [registry],
});

const activeHttpRequests = new client.Gauge({
  name: "active_http_requests",
  help: "Number of HTTP requests currently being processed",
  labelNames: ["service"],
  registers: [registry],
});

const linksTotal = new client.Gauge({
  name: "links_total",
  help: "Current number of active short links available for redirect",
  labelNames: ["service", "store"],
  registers: [registry],
  async collect() {
    const total = await countActiveLinks();

    this.set(
      {
        service: env.serviceName,
        store: env.useInMemoryStore ? "in_memory" : "postgres",
      },
      total
    );
  },
});

function getRouteLabel(req) {
  if (req.baseUrl && req.route?.path) {
    return `${req.baseUrl}${req.route.path}`;
  }

  if (req.route?.path) {
    return req.route.path;
  }

  return req.path || "unknown";
}

function metricsMiddleware(req, res, next) {
  const startedAt = process.hrtime.bigint();

  activeHttpRequests.inc({ service: env.serviceName });

  res.on("finish", () => {
    const responseLabels = {
      service: env.serviceName,
      method: req.method,
      path: getRouteLabel(req),
      status: String(res.statusCode),
    };
    const durationSeconds =
      Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;

    activeHttpRequests.dec({ service: env.serviceName });
    httpRequestsTotal.inc(responseLabels);
    httpRequestDurationSeconds.observe(responseLabels, durationSeconds);
  });

  next();
}

async function metricsHandler(_req, res, next) {
  try {
    res.set("Content-Type", registry.contentType);
    res.send(await registry.metrics());
  } catch (error) {
    next(error);
  }
}

module.exports = {
  linksTotal,
  metricsHandler,
  metricsMiddleware,
  registry,
};
