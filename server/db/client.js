const fs = require('fs');
const path = require('path');
const config = require('../config');

let dbClient = null;
let isInitialized = false;

/**
 * Initializes database connection:
 * - Uses external PostgreSQL via `pg` if DATABASE_URL is provided
 * - Defaults to `@electric-sql/pglite` (embedded WebAssembly Postgres 16) otherwise
 */
async function getDb() {
  if (dbClient) return dbClient;

  if (config.databaseUrl && config.databaseUrl.startsWith('postgres')) {
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: config.databaseUrl,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    });

    dbClient = {
      type: 'postgres-external',
      query: async (text, params = []) => {
        const res = await pool.query(text, params);
        return { rows: res.rows, rowCount: res.rowCount };
      },
      close: async () => {
        await pool.end();
        dbClient = null;
      },
    };
  } else {
    const { PGlite } = require('@electric-sql/pglite');
    // In-memory or file-backed PGlite instance
    const pglite = new PGlite();

    dbClient = {
      type: 'pglite-embedded',
      query: async (text, params = []) => {
        const res = await pglite.query(text, params);
        return { rows: res.rows, rowCount: res.rows ? res.rows.length : 0 };
      },
      exec: async (sql) => {
        return await pglite.exec(sql);
      },
      close: async () => {
        await pglite.close();
        dbClient = null;
      },
    };
  }

  return dbClient;
}

/**
 * Executes schema migration and demo seed data
 */
async function initializeSchemaAndSeed(forceReseed = false) {
  const db = await getDb();
  const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  const seedSql = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf-8');

  // Split and execute SQL statements
  if (db.exec) {
    await db.exec(schemaSql);
    if (forceReseed || !isInitialized) {
      await db.exec(seedSql);
    }
  } else {
    // External pg requires statement-by-statement or direct execution
    await db.query(schemaSql);
    if (forceReseed || !isInitialized) {
      await db.query(seedSql);
    }
  }

  isInitialized = true;
  return true;
}

module.exports = {
  getDb,
  initializeSchemaAndSeed,
};
