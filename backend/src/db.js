const fs = require('fs/promises');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('sslmode=require') || process.env.DATABASE_URL?.includes('neon.tech')
    ? { rejectUnauthorized: false }
    : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected DB pool error', err);
});

let schemaInitPromise;

async function initializeSchema() {
  if (!schemaInitPromise) {
    schemaInitPromise = (async () => {
      const schemaPath = path.join(__dirname, '..', 'schema.sql');
      const sql = await fs.readFile(schemaPath, 'utf8');
      await pool.query(sql);
    })().catch((err) => {
      schemaInitPromise = null;
      throw err;
    });
  }

  return schemaInitPromise;
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  connect: () => pool.connect(),
  initializeSchema,
  pool,
};
