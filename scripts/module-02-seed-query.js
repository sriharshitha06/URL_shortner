const crypto = require("crypto");
const { closeDatabase, initDatabase, query } = require("../src/db");

async function main() {
  const code = crypto.randomBytes(4).toString("hex");
  const longUrl = `https://example.com/${code}`;

  await initDatabase();

  const inserted = await query(
    `
      INSERT INTO links (code, long_url, created_by)
      VALUES ($1, $2, $3)
      RETURNING code, long_url
    `,
    [code, longUrl, "public"]
  );

  const selected = await query(
    `
      SELECT code, long_url
      FROM links
      WHERE code = $1
    `,
    [code]
  );

  console.log(`inserted code: ${inserted.rows[0].code}`);
  console.log(`selected code: ${selected.rows[0].code}`);
  console.log(`matched long_url: ${selected.rows[0].long_url}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
