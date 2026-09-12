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

  const isTest = process.env.NODE_ENV === 'test';
  if (!isTest && config.databaseUrl && config.databaseUrl.startsWith('postgres')) {
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
 * Executes schema migration (non-destructive CREATE TABLE IF NOT EXISTS)
 * and skips seed data when connecting an external database.
 */
async function initializeSchemaAndSeed(forceReseed = false) {
  const db = await getDb();

  // Check if tables already exist in connected database
  try {
    const existing = await db.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users'"
    );
    if (existing.rows && existing.rows.length > 0) {
      console.log('[SafePay AI] Connected to existing schema in database.');
      isInitialized = true;
      return true;
    }
  } catch (err) {
    // If information_schema query fails, fallback to standard schema creation
  }

  const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');

  // Execute schema tables creation
  if (db.exec) {
    await db.exec(schemaSql);
  } else {
    await db.query(schemaSql);
  }

  // Seed data is completely removed for external database connections.
  // Only runs if explicitly opted in via SEED_DATABASE=true or during test suites.
  const isTest = process.env.NODE_ENV === 'test';
  const shouldSeed = process.env.SEED_DATABASE === 'true' || (isTest && forceReseed);

  if (shouldSeed) {
    const seedFile = isTest ? 'fixtures.sql' : 'seed.sql';
    const seedPath = path.join(__dirname, seedFile);
    if (fs.existsSync(seedPath)) {
      const seedSql = fs.readFileSync(seedPath, 'utf-8');
      if (seedSql.trim()) {
        if (db.exec) {
          await db.exec(seedSql);
        } else {
          await db.query(seedSql);
        }
      }
    }
  }

  isInitialized = true;
  return true;
}

module.exports = {
  getDb,
  initializeSchemaAndSeed,
};
