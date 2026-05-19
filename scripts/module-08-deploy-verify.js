const baseUrl = process.env.BASE_URL || "http://localhost:3000";
const expectedVersion = process.env.APP_EXPECTED_VERSION;
const expectedStore = process.env.APP_EXPECTED_STORE;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function fetchJson(path) {
  const response = await fetch(`${baseUrl}${path}`);
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;

  return { response, json, text };
}

async function main() {
  const live = await fetchJson("/live");
  assert(live.response.status === 200, `/live returned ${live.response.status}`);
  assert(live.json?.status === "ok", "/live did not report status=ok");
  assert(typeof live.json?.uptime_seconds === "number", "/live did not include uptime_seconds");
  assert(typeof live.json?.version === "string", "/live did not include version");

  if (expectedVersion) {
    assert(
      live.json.version === expectedVersion,
      `/live version mismatch: expected ${expectedVersion}, got ${live.json.version}`
    );
  }

  const ready = await fetchJson("/ready");
  assert(ready.response.status === 200, `/ready returned ${ready.response.status}`);
  assert(ready.json?.status === "ready", "/ready did not report status=ready");
  assert(typeof ready.json?.checks === "object", "/ready did not include checks");

  if (expectedVersion) {
    assert(
      ready.json.version === expectedVersion,
      `/ready version mismatch: expected ${expectedVersion}, got ${ready.json.version}`
    );
  }

  if (expectedStore) {
    assert(
      ready.json.store === expectedStore,
      `/ready store mismatch: expected ${expectedStore}, got ${ready.json.store}`
    );
  }

  const metrics = await fetch(`${baseUrl}/metrics`);
  const metricsText = await metrics.text();

  assert(metrics.status === 200, `/metrics returned ${metrics.status}`);
  assert(
    metricsText.includes("http_requests_total"),
    "/metrics did not include http_requests_total"
  );

  console.log(`live version: ${live.json.version}`);
  console.log(`ready store: ${ready.json.store}`);
  console.log("metrics endpoint: ok");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
