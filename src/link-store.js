const env = require("../config/env");
const { query } = require("./db");

let nextInMemoryId = 1;
const inMemoryLinks = [];

function resetInMemoryStore() {
  inMemoryLinks.length = 0;
  nextInMemoryId = 1;
}

function isExpired(expiresAt, now = Date.now()) {
  if (!expiresAt) {
    return false;
  }

  return new Date(expiresAt).getTime() <= now;
}

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
    click_count: row.click_count === null ? undefined : Number(row.click_count),
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
    const now = Date.now();
    const match = inMemoryLinks.find(
      (link) => link.code === shortCode && !isExpired(link.expires_at, now)
    );
    return mapLinkRow(match);
  }

  const result = await query(
    `
      SELECT id, code, long_url, created_at, created_by, expires_at, tags
      FROM links
      WHERE code = $1
        AND (expires_at IS NULL OR expires_at > NOW())
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
    const now = Date.now();
    const match = inMemoryLinks.find(
      (link) => link.id === id && !isExpired(link.expires_at, now)
    );
    return mapLinkRow(match);
  }

  const result = await query(
    `
      SELECT id, code, long_url, created_at, created_by, expires_at, tags
      FROM links
      WHERE id = $1
        AND (expires_at IS NULL OR expires_at > NOW())
    `,
    [id]
  );

  return mapLinkRow(result.rows[0]);
}

async function getLinkByIdForOwner(id, principalId) {
  if (env.useInMemoryStore) {
    const now = Date.now();
    const match = inMemoryLinks.find(
      (link) =>
        link.id === id &&
        link.created_by === principalId &&
        !isExpired(link.expires_at, now)
    );
    return mapLinkRow(match);
  }

  const result = await query(
    `
      SELECT id, code, long_url, created_at, created_by, expires_at, tags
      FROM links
      WHERE id = $1
        AND created_by = $2
        AND (expires_at IS NULL OR expires_at > NOW())
    `,
    [id, principalId]
  );

  return mapLinkRow(result.rows[0]);
}

async function listLinks({ limit, offset }) {
  if (env.useInMemoryStore) {
    const now = Date.now();
    return inMemoryLinks
      .filter((link) => !isExpired(link.expires_at, now))
      .slice(offset, offset + limit)
      .map(mapLinkRow);
  }

  const result = await query(
    `
      SELECT id, code, long_url, created_at, created_by, expires_at, tags
      FROM links
      WHERE expires_at IS NULL OR expires_at > NOW()
      ORDER BY id DESC
      LIMIT $1
      OFFSET $2
    `,
    [limit, offset]
  );

  return result.rows.map(mapLinkRow);
}

async function listLinksForOwner({ limit, offset, afterId = null, principalId }) {
  if (env.useInMemoryStore) {
    const now = Date.now();
    const matches = inMemoryLinks.filter((link) => {
      return (
        link.created_by === principalId &&
        !isExpired(link.expires_at, now) &&
        (afterId === null || link.id < afterId)
      );
    });

    const windowed = afterId === null ? matches.slice(offset, offset + limit) : matches.slice(0, limit);

    return windowed.map(mapLinkRow);
  }

  let result;

  if (afterId === null) {
    result = await query(
      `
        SELECT id, code, long_url, created_at, created_by, expires_at, tags
        FROM links
        WHERE created_by = $1
          AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY id DESC
        LIMIT $2
        OFFSET $3
      `,
      [principalId, limit, offset]
    );
  } else {
    result = await query(
      `
        SELECT id, code, long_url, created_at, created_by, expires_at, tags
        FROM links
        WHERE created_by = $1
          AND id < $2
          AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY id DESC
        LIMIT $3
      `,
      [principalId, afterId, limit]
    );
  }

  return result.rows.map(mapLinkRow);
}

async function searchLinksForOwner({
  principalId,
  queryText = "",
  tag = null,
  createdAfter = null,
  createdBefore = null,
  page = 1,
  pageSize = 20,
  sortBy = "created_at",
}) {
  const offset = (page - 1) * pageSize;

  if (env.useInMemoryStore) {
    const now = Date.now();
    let matches = inMemoryLinks.filter(
      (link) => link.created_by === principalId && !isExpired(link.expires_at, now)
    );

    if (queryText) {
      const loweredQuery = queryText.toLowerCase();
      matches = matches.filter(
        (link) =>
          link.code.toLowerCase().includes(loweredQuery) ||
          link.long_url.toLowerCase().includes(loweredQuery)
      );
    }

    if (tag) {
      matches = matches.filter((link) => (link.tags || []).includes(tag));
    }

    if (createdAfter) {
      matches = matches.filter(
        (link) => new Date(link.created_at).getTime() >= new Date(createdAfter).getTime()
      );
    }

    if (createdBefore) {
      matches = matches.filter(
        (link) => new Date(link.created_at).getTime() <= new Date(createdBefore).getTime()
      );
    }

    matches.sort((left, right) => {
      if (sortBy === "click_count") {
        return 0;
      }

      return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
    });

    const total = matches.length;
    const items = matches.slice(offset, offset + pageSize).map(mapLinkRow);

    return { items, total };
  }

  const sortColumn = sortBy === "click_count" ? "click_count" : "created_at";
  const filters = ["l.created_by = $1", "(l.expires_at IS NULL OR l.expires_at > NOW())"];
  const params = [principalId];
  let paramIndex = params.length + 1;

  if (queryText) {
    filters.push(
      `to_tsvector('simple', coalesce(l.code, '') || ' ' || coalesce(l.long_url, '')) @@ plainto_tsquery('simple', $${paramIndex})`
    );
    params.push(queryText);
    paramIndex += 1;
  }

  if (tag) {
    filters.push(`l.tags @> ARRAY[$${paramIndex}]::text[]`);
    params.push(tag);
    paramIndex += 1;
  }

  if (createdAfter) {
    filters.push(`l.created_at >= $${paramIndex}`);
    params.push(createdAfter);
    paramIndex += 1;
  }

  if (createdBefore) {
    filters.push(`l.created_at <= $${paramIndex}`);
    params.push(createdBefore);
    paramIndex += 1;
  }

  const whereClause = filters.join(" AND ");
  const countResult = await query(
    `
      SELECT COUNT(*)::int AS total
      FROM links l
      WHERE ${whereClause}
    `,
    params
  );

  const total = countResult.rows[0]?.total ?? 0;

  const listParams = [...params, pageSize, offset];
  const limitParam = listParams.length - 1;
  const offsetParam = listParams.length;
  const result = await query(
    `
      SELECT
        l.id,
        l.code,
        l.long_url,
        l.created_at,
        l.created_by,
        l.expires_at,
        l.tags,
        COALESCE(COUNT(ce.id), 0)::int AS click_count
      FROM links l
      LEFT JOIN click_events ce ON ce.link_id = l.id
      WHERE ${whereClause}
      GROUP BY l.id
      ORDER BY ${sortColumn} DESC, l.id DESC
      LIMIT $${limitParam}
      OFFSET $${offsetParam}
    `,
    listParams
  );

  return {
    items: result.rows.map(mapLinkRow),
    total,
  };
}

module.exports = {
  createLink,
  deleteLinkByCodeForOwner,
  getLinkByCode,
  getLinkById,
  getLinkByIdForOwner,
  listLinks,
  listLinksForOwner,
  resetInMemoryStore,
  searchLinksForOwner,
  isExpired,
};
