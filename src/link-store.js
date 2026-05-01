const env = require("../config/env");
const { query } = require("./db");

let nextInMemoryId = 1;
const inMemoryLinks = [];

function mapLinkRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    code: row.code,
    long_url: row.long_url,
    created_at: row.created_at,
    created_by: row.created_by,
    expires_at: row.expires_at,
    tags: row.tags || [],
  };
}

async function createLink({
  shortCode,
  originalUrl,
  createdBy = "public",
  expiresAt = null,
  tags = [],
}) {
  if (env.useInMemoryStore) {
    const row = {
      id: nextInMemoryId,
      code: shortCode,
      long_url: originalUrl,
      created_at: new Date().toISOString(),
      created_by: createdBy,
      expires_at: expiresAt,
      tags,
    };

    nextInMemoryId += 1;
    inMemoryLinks.unshift(row);
    return mapLinkRow(row);
  }

  const result = await query(
    `
      INSERT INTO links (code, long_url, created_by, expires_at, tags)
      VALUES ($1, $2, $3, $4, $5::text[])
      RETURNING id, code, long_url, created_at, created_by, expires_at, tags
    `,
    [shortCode, originalUrl, createdBy, expiresAt, tags]
  );

  return mapLinkRow(result.rows[0]);
}

async function getLinkByCode(shortCode) {
  if (env.useInMemoryStore) {
    const match = inMemoryLinks.find((link) => link.code === shortCode);
    return mapLinkRow(match);
  }

  const result = await query(
    `
      SELECT id, code, long_url, created_at, created_by, expires_at, tags
      FROM links
      WHERE code = $1
    `,
    [shortCode]
  );

  return mapLinkRow(result.rows[0]);
}

async function deleteLinkByCodeForOwner(shortCode, principalId) {
  if (env.useInMemoryStore) {
    const index = inMemoryLinks.findIndex(
      (link) => link.code === shortCode && link.created_by === principalId
    );

    if (index === -1) {
      return null;
    }

    const [deletedLink] = inMemoryLinks.splice(index, 1);
    return mapLinkRow(deletedLink);
  }

  const result = await query(
    `
      DELETE FROM links
      WHERE code = $1 AND created_by = $2
      RETURNING id, code, long_url, created_at, created_by, expires_at, tags
    `,
    [shortCode, principalId]
  );

  return mapLinkRow(result.rows[0]);
}

async function getLinkById(id) {
  if (env.useInMemoryStore) {
    const match = inMemoryLinks.find((link) => link.id === id);
    return mapLinkRow(match);
  }

  const result = await query(
    `
      SELECT id, code, long_url, created_at, created_by, expires_at, tags
      FROM links
      WHERE id = $1
    `,
    [id]
  );

  return mapLinkRow(result.rows[0]);
}

async function getLinkByIdForOwner(id, principalId) {
  if (env.useInMemoryStore) {
    const match = inMemoryLinks.find(
      (link) => link.id === id && link.created_by === principalId
    );
    return mapLinkRow(match);
  }

  const result = await query(
    `
      SELECT id, code, long_url, created_at, created_by, expires_at, tags
      FROM links
      WHERE id = $1 AND created_by = $2
    `,
    [id, principalId]
  );

  return mapLinkRow(result.rows[0]);
}

async function listLinks({ limit, offset }) {
  if (env.useInMemoryStore) {
    return inMemoryLinks.slice(offset, offset + limit).map(mapLinkRow);
  }

  const result = await query(
    `
      SELECT id, code, long_url, created_at, created_by, expires_at, tags
      FROM links
      ORDER BY id DESC
      LIMIT $1
      OFFSET $2
    `,
    [limit, offset]
  );

  return result.rows.map(mapLinkRow);
}

async function listLinksForOwner({ limit, offset, principalId }) {
  if (env.useInMemoryStore) {
    return inMemoryLinks
      .filter((link) => link.created_by === principalId)
      .slice(offset, offset + limit)
      .map(mapLinkRow);
  }

  const result = await query(
    `
      SELECT id, code, long_url, created_at, created_by, expires_at, tags
      FROM links
      WHERE created_by = $1
      ORDER BY id DESC
      LIMIT $2
      OFFSET $3
    `,
    [principalId, limit, offset]
  );

  return result.rows.map(mapLinkRow);
}

module.exports = {
  createLink,
  deleteLinkByCodeForOwner,
  getLinkByCode,
  getLinkById,
  getLinkByIdForOwner,
  listLinks,
  listLinksForOwner,
};
