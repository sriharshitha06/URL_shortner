const { Pool } = require("pg");
const env = require("../config/env");

const pool = new Pool({
  connectionString: env.databaseUrl,
});

async function query(text, params = []) {
  return pool.query(text, params);
}

async function initDatabase() {
  if (env.useInMemoryStore) {
    return;
  }

  await query(`
    CREATE TABLE IF NOT EXISTS links (
      id BIGSERIAL PRIMARY KEY,
      code VARCHAR(32) NOT NULL,
      long_url TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_by TEXT NOT NULL DEFAULT 'public',
      expires_at TIMESTAMPTZ NULL,
      tags TEXT[] NOT NULL DEFAULT '{}'
    )
  `);

  await query(`
    ALTER TABLE links
    ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}'
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS links_code_unique_idx
    ON links (code)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS links_created_by_idx
    ON links (created_by)
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS click_events (
      id BIGSERIAL PRIMARY KEY,
      link_id BIGINT NOT NULL REFERENCES links(id) ON DELETE CASCADE,
      clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      user_agent TEXT NULL,
      referrer TEXT NULL,
      ip_hash TEXT NULL
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS click_events_link_id_clicked_at_idx
    ON click_events (link_id, clicked_at)
  `);
}

async function closeDatabase() {
  if (env.useInMemoryStore) {
    return;
  }

  await pool.end();
}

module.exports = {
  closeDatabase,
  initDatabase,
  query,
};
