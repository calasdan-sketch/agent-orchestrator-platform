import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { loadConfig } from '../config/index.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('db');

let dbInstance: Database.Database | null = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  input TEXT NOT NULL,
  result TEXT,
  error TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_jobs_agent ON jobs (agent_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs (status);
`;

/**
 * Create a new database connection at the given path and apply the schema.
 *
 * Exposed so tests can build isolated in-memory databases (`:memory:`).
 */
export function createDatabase(path: string): Database.Database {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}

/**
 * Open (or return the already-open) SQLite database, applying the schema.
 *
 * A path of `:memory:` may be used by tests for an ephemeral database.
 */
export function getDb(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  const { databasePath } = loadConfig();

  if (databasePath !== ':memory:') {
    const dir = dirname(databasePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  const db = createDatabase(databasePath);

  log.info({ databasePath }, 'Database initialised');
  dbInstance = db;
  return db;
}

/**
 * Close the database connection. Intended for graceful shutdown and tests.
 */
export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
