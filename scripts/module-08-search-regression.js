const crypto = require("crypto");

const baseUrl = process.env.BASE_URL || "http://localhost:3000";
const ownerAKey = process.env.API_KEY_A || "dev-key-a";
const ownerBKey = process.env.API_KEY_B || "dev-key-b";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function requestJson(path, { method = "GET", apiKey, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const json = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(
      `Request failed ${method} ${path}: ${response.status} ${text}`
    );
  }

  return json;
}

async function createLink(apiKey, longUrl, tags) {
  return requestJson("/links", {
    method: "POST",
    apiKey,
    body: {
      long_url: longUrl,
      tags,
    },
  });
}

async function main() {
  const health = await fetch(`${baseUrl}/health`);

  assert(health.ok, "App must be running before the regression script can verify search.");

  const suffix = crypto.randomBytes(3).toString("hex");
  const ownerASearchTerm = `search-${suffix}`;
  const ownerBSearchTerm = `search-${suffix}-other-owner`;

  await createLink(ownerAKey, `https://example.com/alpha-${ownerASearchTerm}`, [
    "docs",
    "alpha",
  ]);
  await createLink(ownerAKey, `https://example.com/beta-${ownerASearchTerm}`, [
    "docs",
    "beta",
  ]);
  await createLink(ownerBKey, `https://example.com/${ownerBSearchTerm}`, [
    "docs",
    "alpha",
  ]);

  const missingResult = await requestJson(
    `/links/search?q=missing-${suffix}&page=1&page_size=10`,
    { apiKey: ownerAKey }
  );
  assert(
    missingResult.total === 0,
    "Minimal failing example should return zero results for a non-matching query."
  );

  const ownerAResult = await requestJson(
    `/links/search?q=${ownerASearchTerm}&page=1&page_size=10&sort_by=created_at`,
    { apiKey: ownerAKey }
  );
  assert(ownerAResult.total === 2, "Owner A should see both matching links.");

  const ownerBResult = await requestJson(
    `/links/search?q=${suffix}&page=1&page_size=10&sort_by=created_at`,
    { apiKey: ownerBKey }
  );
  assert(
    ownerBResult.total === 1,
    "Owner B should only see their own matching link."
  );

  const pageOne = await requestJson(
    `/links/search?q=${ownerASearchTerm}&page=1&page_size=1&sort_by=created_at`,
    { apiKey: ownerAKey }
  );
  const pageTwo = await requestJson(
    `/links/search?q=${ownerASearchTerm}&page=2&page_size=1&sort_by=created_at`,
    { apiKey: ownerAKey }
  );

  assert(pageOne.items.length === 1, "Page 1 should contain one item.");
  assert(pageTwo.items.length === 1, "Page 2 should contain one item.");
  assert(
    pageOne.items[0].id !== pageTwo.items[0].id,
    "Pagination boundary check failed: page 1 and page 2 returned the same item."
  );

  const cappedPageSize = await requestJson(
    `/links/search?q=${ownerASearchTerm}&page=1&page_size=999&sort_by=created_at`,
    { apiKey: ownerAKey }
  );
  assert(
    cappedPageSize.page_size === 50,
    "page_size should be capped to 50 for oversized requests."
  );

  console.log(`missing query total: ${missingResult.total}`);
  console.log(`owner A matching total: ${ownerAResult.total}`);
  console.log(`owner B matching total: ${ownerBResult.total}`);
  console.log(`page 1 id: ${pageOne.items[0].id}`);
  console.log(`page 2 id: ${pageTwo.items[0].id}`);
  console.log(`capped page_size: ${cappedPageSize.page_size}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
