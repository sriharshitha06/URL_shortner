const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");

const HOST = "127.0.0.1";
const PORT = String(3100 + Math.floor(Math.random() * 500));
const BASE_URL = `http://${HOST}:${PORT}`;
const API_KEY_A = "test-key-a";
const API_KEY_B = "test-key-b";
const APP_VERSION = "test-sha-123";

let serverProcess;
let stdoutBuffer = "";
let stderrBuffer = "";

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForServer(url, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (serverProcess?.exitCode !== null) {
      throw new Error(`Server exited early with code ${serverProcess.exitCode}`);
    }

    try {
      const response = await fetch(url);

      if (response.ok) {
        return;
      }
    } catch {
      // Retry until the server is ready.
    }

    await sleep(150);
  }

  throw new Error("Server did not become ready in time.");
}

async function request(path, { method = "GET", apiKey, body, redirect, headers: extraHeaders } = {}) {
  const headers = { ...(extraHeaders || {}) };

  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  }

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect,
  });

  const text = await response.text();
  let json = null;

  if (text && response.headers.get("content-type")?.includes("application/json")) {
    json = JSON.parse(text);
  }

  return { response, json, text };
}

test.before(async () => {
  serverProcess = spawn("node", ["src/index.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      APP_ENV: "test",
      PORT,
      SERVICE_NAME: "url-shortener",
      APP_VERSION,
      USE_IN_MEMORY_STORE: "true",
      API_KEYS: JSON.stringify({
        [API_KEY_A]: "A",
        [API_KEY_B]: "B",
      }),
      DATABASE_URL: "postgresql://unused:unused@localhost:5432/unused",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let startupError = "";

  serverProcess.stdout.on("data", (chunk) => {
    stdoutBuffer += chunk.toString();
  });

  serverProcess.stderr.on("data", (chunk) => {
    const text = chunk.toString();
    startupError += text;
    stderrBuffer += text;
  });

  await waitForServer(`${BASE_URL}/health`);

  if (startupError) {
    throw new Error(startupError);
  }
});

test.beforeEach(async () => {
  stdoutBuffer = "";
  stderrBuffer = "";

  const { response } = await request("/__test/reset", {
    method: "POST",
  });

  assert.equal(response.status, 204);
});

test.after(async () => {
  if (!serverProcess || serverProcess.exitCode !== null) {
    return;
  }

  serverProcess.kill("SIGTERM");
  await new Promise((resolve) => {
    serverProcess.once("exit", resolve);
  });
});

test("creates a link", async () => {
  const { response, json } = await request("/links", {
    method: "POST",
    apiKey: API_KEY_A,
    body: {
      long_url: "https://example.com/module-09-create",
      tags: ["module-09", "create"],
    },
  });

  assert.equal(response.status, 201);
  assert.equal(json.long_url, "https://example.com/module-09-create");
  assert.match(json.short_url, /\/r\/[A-Za-z0-9]{6}$/);
  assert.deepEqual(json.tags, ["module-09", "create"]);
});

test("exposes versioned liveness and readiness metadata", async () => {
  const live = await request("/live");
  const ready = await request("/ready");

  assert.equal(live.response.status, 200);
  assert.equal(live.json.status, "ok");
  assert.equal(live.json.service, "url-shortener");
  assert.equal(live.json.version, APP_VERSION);
  assert.equal(live.json.app_env, "test");
  assert.equal(typeof live.json.uptime_seconds, "number");

  assert.equal(ready.response.status, 200);
  assert.equal(ready.json.status, "ready");
  assert.equal(ready.json.store, "in_memory");
  assert.equal(ready.json.version, APP_VERSION);
  assert.equal(ready.json.checks.database, "skipped");
  assert.equal(ready.json.checks.mode, "in_memory");
  assert.equal(typeof ready.json.uptime_seconds, "number");
});

test("redirects to the stored long URL", async () => {
  const createResult = await request("/links", {
    method: "POST",
    apiKey: API_KEY_A,
    body: {
      long_url: "https://example.com/module-09-redirect",
    },
  });

  const { response } = await request(`/r/${createResult.json.code}`, {
    redirect: "manual",
  });

  assert.equal(response.status, 302);
  assert.equal(
    response.headers.get("location"),
    "https://example.com/module-09-redirect"
  );
});

test("returns 401 for protected routes without an API key", async () => {
  const { response, json } = await request("/links");

  assert.equal(response.status, 401);
  assert.equal(json.error.code, "UNAUTHORIZED");
});

test("prevents owner B from reading or deleting owner A's link", async () => {
  const createResult = await request("/links", {
    method: "POST",
    apiKey: API_KEY_A,
    body: {
      long_url: "https://example.com/module-09-idor",
    },
  });

  const { response: getResponse } = await request(
    `/links/${createResult.json.id}`,
    {
      apiKey: API_KEY_B,
    }
  );

  const { response: deleteResponse } = await request(
    `/links/${createResult.json.code}`,
    {
      method: "DELETE",
      apiKey: API_KEY_B,
    }
  );

  assert.equal(getResponse.status, 404);
  assert.equal(deleteResponse.status, 404);
});

test("filters expired links out of reads and redirects", async () => {
  const expiresAt = new Date(Date.now() + 1_000).toISOString();
  const createResult = await request("/links", {
    method: "POST",
    apiKey: API_KEY_A,
    body: {
      long_url: "https://example.com/module-09-expiring",
      expires_at: expiresAt,
    },
  });

  await sleep(1_250);

  const { response: getResponse } = await request(
    `/links/${createResult.json.id}`,
    {
      apiKey: API_KEY_A,
    }
  );
  const { response: redirectResponse } = await request(
    `/r/${createResult.json.code}`,
    {
      redirect: "manual",
    }
  );

  assert.equal(getResponse.status, 404);
  assert.equal(redirectResponse.status, 404);
});

test("rejects encoded URL bypass strings and does not store them", async () => {
  const beforeList = await request("/links?limit=100&offset=0", {
    apiKey: API_KEY_A,
  });

  const invalidUrl = "http%3A%2F%2Fevil.example.com";
  const { response } = await request("/links", {
    method: "POST",
    apiKey: API_KEY_A,
    body: {
      long_url: invalidUrl,
    },
  });

  const afterList = await request("/links?limit=100&offset=0", {
    apiKey: API_KEY_A,
  });

  assert.equal(response.status, 400);
  assert.equal(beforeList.json.items.length, afterList.json.items.length);
  assert.equal(
    afterList.json.items.some((item) => item.long_url === invalidUrl),
    false
  );
});

test("exposes request metrics with counts, latency, and business gauges", async () => {
  await request("/health");
  await request("/ready");
  await request("/__test/error");

  const { response, text } = await request("/metrics");

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type"),
    /text\/plain;.*version=0\.0\.4/
  );
  assert.match(text, /# HELP http_requests_total/);
  assert.match(
    text,
    /http_requests_total\{service="url-shortener",method="GET",path="\/health",status="200"\} [1-9]\d*/
  );
  assert.match(
    text,
    /http_requests_total\{service="url-shortener",method="GET",path="\/__test\/error",status="500"\} [1-9]\d*/
  );
  assert.match(text, /http_request_duration_seconds_bucket/);
  assert.match(
    text,
    /links_total\{service="url-shortener",store="in_memory"\} 0/
  );
});

test("emits structured request and error logs with request IDs", async () => {
  const requestId = "req-observability-test";

  await request("/health", {
    headers: {
      "X-Request-ID": requestId,
    },
  });
  await request("/__test/error", {
    headers: {
      "X-Request-ID": requestId,
    },
  });

  await sleep(200);

  const logLines = `${stdoutBuffer}\n${stderrBuffer}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  const requestReceived = logLines.find(
    (entry) => entry.event === "request_received" && entry.request_id === requestId
  );
  const requestFinished = logLines.find(
    (entry) =>
      entry.event === "request_finished" &&
      entry.request_id === requestId &&
      entry.status === 200
  );
  const requestFailed = logLines.find(
    (entry) => entry.event === "request_failed" && entry.request_id === requestId
  );

  assert.equal(requestReceived.service_name, "url-shortener");
  assert.equal(requestReceived.message, "request received");
  assert.equal(requestReceived.level, "info");

  assert.equal(requestFinished.service_name, "url-shortener");
  assert.equal(requestFinished.message, "request completed");
  assert.equal(requestFinished.level, "info");

  assert.equal(requestFailed.service_name, "url-shortener");
  assert.equal(requestFailed.message, "request failed");
  assert.equal(requestFailed.level, "error");
  assert.equal(requestFailed.status, 500);
  assert.match(requestFailed.stack, /Intentional test error/);
});
