const { Database } = require('node-sqlite3-wasm');
const path = require('path');
const fs = require('fs');

// Normalise params so the routes can use the same calling convention as
// better-sqlite3:
//   - plain object { key: val }  → { '@key': val }  (named @param SQL)
//   - scalar string / number     → [value]           (positional ? SQL)
//   - array / null / undefined   → passed as-is
function normaliseParams(params) {
  if (params === null || params === undefined) return params;
  if (Array.isArray(params)) return params;
  if (typeof params === 'object') {
    return Object.fromEntries(
      Object.entries(params).map(([k, v]) => [`@${k}`, v])
    );
  }
  // scalar (string, number, …)
  return [params];
}

// Wrap a raw Statement so callers don't need to care about the prefix rule.
// Accepts either a single value/object/array, or multiple positional arguments
// which are forwarded as a flat array.
function wrapStmt(stmt) {
  function norm(...args) {
    // Multiple spread args → positional array
    if (args.length > 1) return args;
    return normaliseParams(args[0]);
  }
  return {
    run(...args) { return stmt.run(norm(...args)); },
    get(...args) { return stmt.get(norm(...args)); },
    all(...args) { return stmt.all(norm(...args)); },
  };
}

const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.cwd(), process.env.DB_PATH)
  : path.join(__dirname, '../../data/compta.db');

// Ensure the data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Remove stale WAL lock file left by a previous crashed process.
// node-sqlite3-wasm creates a lock directory; if the process crashes it is
// never cleaned up, causing "database is locked" on the next startup.
const LOCK_PATH = DB_PATH + '.lock';
if (fs.existsSync(LOCK_PATH)) {
  try {
    fs.rmSync(LOCK_PATH, { recursive: true, force: true });
    console.log('[db] Stale lock file removed:', LOCK_PATH);
  } catch (e) {
    console.warn('[db] Could not remove lock file:', e.message);
  }
}

const _db = new Database(DB_PATH);

// Enable WAL mode for better concurrent performance
_db.run('PRAGMA journal_mode = WAL');
_db.run('PRAGMA foreign_keys = ON');

// Proxy that wraps prepare() so all statements get the normalised params shim.
// All other methods (run, get, all, exec, close) are forwarded directly.
const db = new Proxy(_db, {
  get(target, prop) {
    if (prop === 'prepare') {
      return (sql) => wrapStmt(target.prepare(sql));
    }
    const val = target[prop];
    return typeof val === 'function' ? val.bind(target) : val;
  },
});

// Helper: wrap a function in a BEGIN/COMMIT transaction
function transaction(fn) {
  return function (...args) {
    db.run('BEGIN');
    try {
      fn(...args);
      db.run('COMMIT');
    } catch (e) {
      db.run('ROLLBACK');
      throw e;
    }
  };
}

// ── Schema ────────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS factures (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    numero       TEXT    NOT NULL,
    date         TEXT    NOT NULL,
    client       TEXT    NOT NULL,
    description  TEXT,
    montant_ht   REAL    NOT NULL,
    taux_tva     REAL    NOT NULL,
    montant_tva  REAL    NOT NULL,
    montant_ttc  REAL    NOT NULL,
    categorie    TEXT    NOT NULL,
    statut       TEXT    NOT NULL DEFAULT 'en_attente',
    created_at   TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS depenses (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    date         TEXT    NOT NULL,
    fournisseur  TEXT    NOT NULL,
    description  TEXT,
    montant_ht   REAL    NOT NULL,
    taux_tva     REAL    NOT NULL,
    montant_tva  REAL    NOT NULL,
    montant_ttc  REAL    NOT NULL,
    categorie    TEXT    NOT NULL,
    statut       TEXT    NOT NULL DEFAULT 'en_attente',
    created_at   TEXT    DEFAULT (datetime('now'))
  );
`);

// ── Schéma Qonto ─────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS qonto_config (
    id                  INTEGER PRIMARY KEY CHECK (id = 1),
    organization_slug   TEXT,
    secret_key          TEXT,
    iban                TEXT,
    auto_sync_enabled   INTEGER NOT NULL DEFAULT 0,
    last_sync_at        TEXT
  );

  CREATE TABLE IF NOT EXISTS qonto_category_mapping (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    qonto_operation_type  TEXT NOT NULL,
    side                  TEXT NOT NULL CHECK (side IN ('credit','debit')),
    pcg_category          TEXT NOT NULL,
    default_taux_tva      REAL NOT NULL DEFAULT 20,
    UNIQUE (qonto_operation_type, side)
  );

  CREATE TABLE IF NOT EXISTS qonto_imports (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    qonto_transaction_id  TEXT NOT NULL UNIQUE,
    local_type            TEXT NOT NULL CHECK (local_type IN ('facture','depense')),
    local_id              INTEGER NOT NULL,
    imported_at           TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS qonto_sync_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    synced_at   TEXT NOT NULL,
    fetched     INTEGER NOT NULL DEFAULT 0,
    imported    INTEGER NOT NULL DEFAULT 0,
    skipped     INTEGER NOT NULL DEFAULT 0,
    errors      TEXT
  );

  CREATE TABLE IF NOT EXISTS qonto_accounts (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    name                TEXT NOT NULL DEFAULT 'Compte Qonto',
    organization_slug   TEXT,
    secret_key          TEXT,
    iban                TEXT,
    auto_sync_enabled   INTEGER NOT NULL DEFAULT 0,
    last_sync_at        TEXT,
    created_at          TEXT DEFAULT (datetime('now'))
  );
`);

// Add account_id to qonto_sync_log (migration — silently ignored if column already exists)
try { db.run('ALTER TABLE qonto_sync_log ADD COLUMN account_id INTEGER'); } catch (_) {}

// Migrate existing single qonto_config → qonto_accounts
{
  const acctCount = db.get('SELECT COUNT(*) AS cnt FROM qonto_accounts');
  if (acctCount.cnt === 0) {
    const oldCfg = db.get('SELECT * FROM qonto_config WHERE id = 1');
    if (oldCfg?.organization_slug) {
      db.run(
        'INSERT INTO qonto_accounts (name, organization_slug, secret_key, iban, auto_sync_enabled, last_sync_at) VALUES (?, ?, ?, ?, ?, ?)',
        ['Compte principal', oldCfg.organization_slug, oldCfg.secret_key, oldCfg.iban, oldCfg.auto_sync_enabled, oldCfg.last_sync_at]
      );
    }
  }
}

// ── Migration PCG : mise à jour des catégories existantes vers les comptes PCG ─
// Factures
const MIGRATION_FACTURES = [
  ["Prestations de services", "706 \u2013 Prestations de services"],
  ["Conseil",                 "706 \u2013 Prestations de services"],
  ["Formation",               "706 \u2013 Prestations de services"],
  ["Vente de produits",       "701 \u2013 Ventes de produits finis"],
  ["Autre recette",           "75 \u2013 Autres produits de gestion courante"],
];
for (const [ancien, nouveau] of MIGRATION_FACTURES) {
  db.run(`UPDATE factures SET categorie = ? WHERE categorie = ?`, [nouveau, ancien]);
}

// Dépenses
const MIGRATION_DEPENSES = [
  ["Loyer & charges locatives",  "613 \u2013 Locations & charges locatives"],
  ["Matériel & équipement",      "606 \u2013 Fournitures et petits équipements"],
  ["Logiciels & abonnements",    "606 \u2013 Fournitures et petits équipements"],
  ["Déplacements & transport",   "625 \u2013 Déplacements, missions & réceptions"],
  ["Repas & réception",          "625 \u2013 Déplacements, missions & réceptions"],
  ["Frais bancaires",            "627 \u2013 Services bancaires & assimilés"],
  ["Sous-traitance",             "611 \u2013 Sous-traitance générale"],
  ["Salaires & charges sociales","641 \u2013 Rémunérations du personnel"],
  ["Assurances",                 "616 \u2013 Primes d'assurance"],
  ["Fournitures de bureau",      "606 \u2013 Fournitures et petits équipements"],
  ["Autre charge",               "671 \u2013 Charges exceptionnelles sur opérations de gestion"],
];
for (const [ancien, nouveau] of MIGRATION_DEPENSES) {
  db.run(`UPDATE depenses SET categorie = ? WHERE categorie = ?`, [nouveau, ancien]);
}

// ── Migration : normalise le séparateur de catégorie (tiret ASCII → tiret demi-cadratin) ──
// Les anciennes versions de l'app enregistraient " - " ; les services P&L/Bilan utilisent " – "
db.run("UPDATE factures SET categorie = REPLACE(categorie, ' - ', ' \u2013 ') WHERE categorie LIKE '% - %'");
db.run("UPDATE depenses SET categorie = REPLACE(categorie, ' - ', ' \u2013 ') WHERE categorie LIKE '% - %'");

// ── Seed data ─────────────────────────────────────────────────────────────────
// Only insert seed data when the tables are empty to avoid duplicates on restart

function round2(n) {
  return Math.round(n * 100) / 100;
}

const factureCount = db.get('SELECT COUNT(*) AS cnt FROM factures');
if (factureCount.cnt === 0) {
  const insertFacture = db.prepare(`
    INSERT INTO factures (numero, date, client, description, montant_ht, taux_tva, montant_tva, montant_ttc, categorie, statut)
    VALUES (@numero, @date, @client, @description, @montant_ht, @taux_tva, @montant_tva, @montant_ttc, @categorie, @statut)
  `);

  const seedFactures = [
    {
      numero: 'F-2026-001',
      date: '2026-01-15',
      client: 'Acme Corp SAS',
      description: 'Développement application web – phase 1',
      montant_ht: 4500.00,
      taux_tva: 20,
      statut: 'payee',
      categorie: '706 \u2013 Prestations de services',
    },
    {
      numero: 'F-2026-002',
      date: '2026-02-03',
      client: 'Dupont & Associés',
      description: 'Mission de conseil stratégique – février',
      montant_ht: 2800.00,
      taux_tva: 20,
      statut: 'payee',
      categorie: '706 \u2013 Prestations de services',
    },
    {
      numero: 'F-2026-003',
      date: '2026-02-20',
      client: 'Mairie de Lyon',
      description: 'Formation React avancé – 2 jours',
      montant_ht: 1600.00,
      taux_tva: 0,
      statut: 'payee',
      categorie: '706 \u2013 Prestations de services',
    },
    {
      numero: 'F-2026-004',
      date: '2026-03-10',
      client: 'StartupX',
      description: 'Audit UX et recommandations',
      montant_ht: 3200.00,
      taux_tva: 20,
      statut: 'payee',
      categorie: '706 \u2013 Prestations de services',
    },
    {
      numero: 'F-2026-005',
      date: '2026-04-01',
      client: 'BioFood SAS',
      description: 'Intégration API paiement – livraison avril',
      montant_ht: 5000.00,
      taux_tva: 20,
      statut: 'en_attente',
      categorie: '706 \u2013 Prestations de services',
    },
  ];

  const insertManyFactures = transaction((rows) => {
    for (const row of rows) {
      const montant_tva = round2(row.montant_ht * row.taux_tva / 100);
      const montant_ttc = round2(row.montant_ht + montant_tva);
      insertFacture.run({ ...row, montant_tva, montant_ttc });
    }
  });
  insertManyFactures(seedFactures);
}

const depenseCount = db.get('SELECT COUNT(*) AS cnt FROM depenses');
if (depenseCount.cnt === 0) {
  const insertDepense = db.prepare(`
    INSERT INTO depenses (date, fournisseur, description, montant_ht, taux_tva, montant_tva, montant_ttc, categorie, statut)
    VALUES (@date, @fournisseur, @description, @montant_ht, @taux_tva, @montant_tva, @montant_ttc, @categorie, @statut)
  `);

  const seedDepenses = [
    {
      date: '2026-01-05',
      fournisseur: 'Regus Paris',
      description: 'Loyer bureau – janvier 2026',
      montant_ht: 750.00,
      taux_tva: 20,
      statut: 'payee',
      categorie: '613 \u2013 Locations & charges locatives',
    },
    {
      date: '2026-01-20',
      fournisseur: 'Apple Store',
      description: 'MacBook Pro 14" M3',
      montant_ht: 2074.17,
      taux_tva: 20,
      statut: 'payee',
      categorie: '606 \u2013 Fournitures et petits équipements',
    },
    {
      date: '2026-02-05',
      fournisseur: 'Regus Paris',
      description: 'Loyer bureau – février 2026',
      montant_ht: 750.00,
      taux_tva: 20,
      statut: 'payee',
      categorie: '613 \u2013 Locations & charges locatives',
    },
    {
      date: '2026-02-14',
      fournisseur: 'SNCF',
      description: 'Billet Paris–Lyon (client Mairie de Lyon)',
      montant_ht: 68.33,
      taux_tva: 10,
      statut: 'payee',
      categorie: '625 \u2013 Déplacements, missions & réceptions',
    },
    {
      date: '2026-03-05',
      fournisseur: 'Regus Paris',
      description: 'Loyer bureau – mars 2026',
      montant_ht: 750.00,
      taux_tva: 20,
      statut: 'en_attente',
      categorie: '613 \u2013 Locations & charges locatives',
    },
  ];

  const insertManyDepenses = transaction((rows) => {
    for (const row of rows) {
      const montant_tva = round2(row.montant_ht * row.taux_tva / 100);
      const montant_ttc = round2(row.montant_ht + montant_tva);
      insertDepense.run({ ...row, montant_tva, montant_ttc });
    }
  });
  insertManyDepenses(seedDepenses);
}

module.exports = db;
