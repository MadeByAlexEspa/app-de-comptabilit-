/**
 * Master DB — stores workspaces and users (multi-tenant registry).
 * Each workspace has its own workspace DB in data/{workspaceId}.db.
 * This file only handles the master registry.
 */
const { Database } = require('node-sqlite3-wasm');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');

// ── Helpers (same as database.js) ─────────────────────────────────────────────

function normaliseParams(params) {
  if (params === null || params === undefined) return params;
  if (Array.isArray(params)) return params;
  if (typeof params === 'object') {
    return Object.fromEntries(
      Object.entries(params).map(([k, v]) => [`@${k}`, v])
    );
  }
  return [params];
}

function wrapStmt(stmt) {
  function norm(...args) {
    if (args.length > 1) return args;
    return normaliseParams(args[0]);
  }
  return {
    run(...args) { return stmt.run(norm(...args)); },
    get(...args) { return stmt.get(norm(...args)); },
    all(...args) { return stmt.all(norm(...args)); },
  };
}

// ── Open master.db ─────────────────────────────────────────────────────────────

const MASTER_PATH = path.join(__dirname, '../../data/master.db');
const dataDir = path.dirname(MASTER_PATH);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const LOCK_PATH = MASTER_PATH + '.lock';
if (fs.existsSync(LOCK_PATH)) {
  try {
    fs.rmSync(LOCK_PATH, { recursive: true, force: true });
    console.log('[masterDb] Stale lock file removed:', LOCK_PATH);
  } catch (e) {
    console.warn('[masterDb] Could not remove lock file:', e.message);
  }
}

const _db = new Database(MASTER_PATH);

_db.run('PRAGMA journal_mode = WAL');
_db.run('PRAGMA foreign_keys = ON');

const masterDb = new Proxy(_db, {
  get(target, prop) {
    if (prop === 'prepare') {
      return (sql) => wrapStmt(target.prepare(sql));
    }
    const val = target[prop];
    return typeof val === 'function' ? val.bind(target) : val;
  },
});

// ── Schema ─────────────────────────────────────────────────────────────────────

masterDb.exec(`
  CREATE TABLE IF NOT EXISTS workspaces (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    slug       TEXT UNIQUE NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id   INTEGER NOT NULL REFERENCES workspaces(id),
    email          TEXT NOT NULL,
    password_hash  TEXT NOT NULL,
    role           TEXT DEFAULT 'owner',
    created_at     TEXT DEFAULT (datetime('now')),
    UNIQUE(email, workspace_id)
  );
`);

// ── Seed: workspace 1 + demo user (dev/test only) ─────────────────────────────

if (process.env.NODE_ENV !== 'production') {
  const wsCount = masterDb.get('SELECT COUNT(*) AS cnt FROM workspaces');
  if (wsCount.cnt === 0) {
    masterDb.run(
      'INSERT INTO workspaces (id, name, slug) VALUES (?, ?, ?)',
      [1, 'Démo', 'demo']
    );
    const passwordHash = bcrypt.hashSync('demo1234', 10);
    masterDb.run(
      'INSERT INTO users (workspace_id, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [1, 'demo@compta.app', passwordHash, 'owner']
    );
    console.log('[masterDb] Seed: workspace "Démo" + user demo@compta.app créés');
  }
}

module.exports = masterDb;
