const { query } = require("./db");

async function saveLink(shortCode, originalUrl, createdBy = "public") {
  const result = await query(
    `
      INSERT INTO links (code, long_url, created_by)
      VALUES ($1, $2, $3)
      RETURNING id, code, long_url, created_at, created_by
    `,
    [shortCode, originalUrl, createdBy]
  );

  return result.rows[0];
}

async function getLink(shortCode) {
  const result = await query(
    `
      SELECT id, code, long_url, created_at, created_by
      FROM links
      WHERE code = $1
    `,
    [shortCode]
  );

  return result.rows[0] || null;
}

module.exports = {
  getLink,
  saveLink,
};
