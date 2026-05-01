const { Client } = require('pg');

(async () => {
  const client = new Client({
    connectionString: 'postgresql://postgres:postgres@localhost:5432/postgres'
  });

  await client.connect();

  const result = await client.query(
    "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'links';"
  );

  console.log(result.rows);

  await client.end();
})();