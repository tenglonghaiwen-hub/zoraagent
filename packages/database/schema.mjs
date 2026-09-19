/**
 * Database schema and migrations for Zora authentication and user management
 * Using sql.js (pure JavaScript SQLite implementation)
 */
import initSqlJs from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

// Database location
function getDbPath() {
  if (process.env.DATABASE_PATH) {
    return path.isAbsolute(process.env.DATABASE_PATH)
      ? process.env.DATABASE_PATH
      : path.resolve(ROOT, process.env.DATABASE_PATH);
  }
  return path.join(ROOT, 'data', 'zora.db');
}

let SQL = null;
let dbInstance = null;

/**
 * Initialize sql.js
 */
async function initSql() {
  if (!SQL) {
    SQL = await initSqlJs();
  }
  return SQL;
}

/**
 * Load database from file or create new one
 */
async function loadDatabase() {
  await initSql();

  const dbPath = getDbPath();
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  let db;
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  return db;
}

/**
 * Save database to file
 */
function saveDatabase(db) {
  const dbPath = getDbPath();
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

/**
 * Initialize database with schema
 */
export async function initDatabase() {
  const db = await loadDatabase();

  // Enable foreign keys
  db.run('PRAGMA foreign_keys = ON');

  // Create tables
  db.exec(`
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      username TEXT,
      role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin')),
      quota_balance INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'suspended')),
      is_vip INTEGER DEFAULT 0,
      vip_expires_at INTEGER DEFAULT 0,
      concurrency_limit INTEGER DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

    -- Sessions table
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT UNIQUE NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      last_used_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

    -- Usage logs table
    CREATE TABLE IF NOT EXISTS usage_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      resource_type TEXT NOT NULL,
      model_id TEXT,
      tokens_used INTEGER,
      quota_cost INTEGER NOT NULL,
      request_id TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON usage_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_usage_logs_resource_type ON usage_logs(resource_type);

    -- Server models configuration table
    CREATE TABLE IF NOT EXISTS server_models (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      kind TEXT NOT NULL CHECK(kind IN ('image', 'video', 'agent')),
      enabled INTEGER DEFAULT 1,
      provider TEXT,
      quota_cost_per_unit INTEGER NOT NULL,
      max_concurrency INTEGER,
      config TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_server_models_kind ON server_models(kind);
    CREATE INDEX IF NOT EXISTS idx_server_models_enabled ON server_models(enabled);

    -- API keys configuration (server-side only)
    CREATE TABLE IF NOT EXISTS api_keys (
      provider TEXT PRIMARY KEY,
      key_encrypted TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  try { db.run('ALTER TABLE users ADD COLUMN is_vip INTEGER DEFAULT 0'); } catch {}
  try { db.run('ALTER TABLE users ADD COLUMN vip_expires_at INTEGER DEFAULT 0'); } catch {}
  try { db.run('ALTER TABLE users ADD COLUMN concurrency_limit INTEGER DEFAULT 1'); } catch {}

  saveDatabase(db);
  console.log('✓ Database initialized:', getDbPath());

  return db;
}

/**
 * Get database connection (singleton pattern)
 */
export async function getDatabase() {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = getDbPath();
  if (!fs.existsSync(dbPath)) {
    dbInstance = await initDatabase();
  } else {
    dbInstance = await loadDatabase();
    dbInstance.run('PRAGMA foreign_keys = ON');
  }

  return dbInstance;
}

/**
 * Execute a query and return results
 */
export async function query(sql, params = []) {
  const db = await getDatabase();
  const stmt = db.prepare(sql);
  stmt.bind(params);

  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();

  return results;
}

/**
 * Execute a query and return first result
 */
export async function queryOne(sql, params = []) {
  const results = await query(sql, params);
  return results.length > 0 ? results[0] : null;
}

/**
 * Execute a statement (INSERT, UPDATE, DELETE)
 */
export async function execute(sql, params = []) {
  const db = await getDatabase();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  stmt.step();
  stmt.free();

  saveDatabase(db);
  return { changes: db.getRowsModified() };
}

/**
 * Execute multiple statements in a transaction
 */
export async function transaction(callback) {
  const db = await getDatabase();

  try {
    db.run('BEGIN TRANSACTION');
    await callback({ query, queryOne, execute });
    db.run('COMMIT');
    saveDatabase(db);
  } catch (error) {
    db.run('ROLLBACK');
    throw error;
  }
}

/**
 * Close database connection
 */
export async function closeDatabase() {
  if (dbInstance) {
    saveDatabase(dbInstance);
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Run migrations
 */
export async function runMigrations() {
  const db = await getDatabase();

  // Check if migrations table exists
  const tables = await query(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'"
  );

  if (tables.length === 0) {
    db.exec(`
      CREATE TABLE migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        executed_at INTEGER NOT NULL
      );
    `);
    saveDatabase(db);
  }

  // List of migrations
  const migrations = [
    {
      name: '001_initial_schema',
      up: async () => {
        console.log('✓ Migration 001_initial_schema: already applied');
      }
    }
  ];

  // Execute migrations
  for (const migration of migrations) {
    const existing = await queryOne('SELECT * FROM migrations WHERE name = ?', [migration.name]);

    if (!existing) {
      console.log(`Running migration: ${migration.name}`);
      await migration.up();

      await execute(
        'INSERT INTO migrations (name, executed_at) VALUES (?, ?)',
        [migration.name, Date.now()]
      );

      console.log(`✓ Migration ${migration.name} completed`);
    }
  }

  console.log('✓ All migrations completed');
}

// Run migrations if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}
