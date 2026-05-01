const { Client } = require('pg');

async function testConnection() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres', // change if needed
    database: 'postgres',
  });

  try {
    // Step 1: Connect
    await client.connect();
    console.log('✅ Connected to PostgreSQL');

    // Step 2: Run test query
    const res = await client.query('SELECT current_database();');
    console.log('📦 Query result:', res.rows[0]);

  } catch (err) {
    // Step 3: Handle errors
    console.error('❌ Error during connection or query');
    console.error(err);

  } finally {
    // Step 4: Always close connection safely
    try {
      await client.end();
      console.log('🔌 Connection closed');
    } catch (closeErr) {
      console.error('⚠️ Error while closing connection');
      console.error(closeErr.message);
    }
  }
}

testConnection();