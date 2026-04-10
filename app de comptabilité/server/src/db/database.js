const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.cwd(), process.env.DB_PATH)
  : path.join(__dirname, '../../data/compta.db');

// Ensure the data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

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

// ── Seed data ─────────────────────────────────────────────────────────────────
// Only insert seed data when the tables are empty to avoid duplicates on restart

function round2(n) {
  return Math.round(n * 100) / 100;
}

const factureCount = db.prepare('SELECT COUNT(*) AS cnt FROM factures').get();
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
      categorie: 'Prestations de services',
    },
    {
      numero: 'F-2026-002',
      date: '2026-02-03',
      client: 'Dupont & Associés',
      description: 'Mission de conseil stratégique – février',
      montant_ht: 2800.00,
      taux_tva: 20,
      statut: 'payee',
      categorie: 'Conseil',
    },
    {
      numero: 'F-2026-003',
      date: '2026-02-20',
      client: 'Mairie de Lyon',
      description: 'Formation React avancé – 2 jours',
      montant_ht: 1600.00,
      taux_tva: 0,
      statut: 'payee',
      categorie: 'Formation',
    },
    {
      numero: 'F-2026-004',
      date: '2026-03-10',
      client: 'StartupX',
      description: 'Audit UX et recommandations',
      montant_ht: 3200.00,
      taux_tva: 20,
      statut: 'payee',
      categorie: 'Conseil',
    },
    {
      numero: 'F-2026-005',
      date: '2026-04-01',
      client: 'BioFood SAS',
      description: 'Intégration API paiement – livraison avril',
      montant_ht: 5000.00,
      taux_tva: 20,
      statut: 'en_attente',
      categorie: 'Prestations de services',
    },
  ];

  const insertManyFactures = db.transaction((rows) => {
    for (const row of rows) {
      const montant_tva = round2(row.montant_ht * row.taux_tva / 100);
      const montant_ttc = round2(row.montant_ht + montant_tva);
      insertFacture.run({ ...row, montant_tva, montant_ttc });
    }
  });
  insertManyFactures(seedFactures);
}

const depenseCount = db.prepare('SELECT COUNT(*) AS cnt FROM depenses').get();
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
      categorie: 'Loyer & charges locatives',
    },
    {
      date: '2026-01-20',
      fournisseur: 'Apple Store',
      description: 'MacBook Pro 14" M3',
      montant_ht: 2074.17,
      taux_tva: 20,
      statut: 'payee',
      categorie: 'Matériel & équipement',
    },
    {
      date: '2026-02-05',
      fournisseur: 'Regus Paris',
      description: 'Loyer bureau – février 2026',
      montant_ht: 750.00,
      taux_tva: 20,
      statut: 'payee',
      categorie: 'Loyer & charges locatives',
    },
    {
      date: '2026-02-14',
      fournisseur: 'SNCF',
      description: 'Billet Paris–Lyon (client Mairie de Lyon)',
      montant_ht: 68.33,
      taux_tva: 10,
      statut: 'payee',
      categorie: 'Déplacements & transport',
    },
    {
      date: '2026-03-05',
      fournisseur: 'Regus Paris',
      description: 'Loyer bureau – mars 2026',
      montant_ht: 750.00,
      taux_tva: 20,
      statut: 'en_attente',
      categorie: 'Loyer & charges locatives',
    },
  ];

  const insertManyDepenses = db.transaction((rows) => {
    for (const row of rows) {
      const montant_tva = round2(row.montant_ht * row.taux_tva / 100);
      const montant_ttc = round2(row.montant_ht + montant_tva);
      insertDepense.run({ ...row, montant_tva, montant_ttc });
    }
  });
  insertManyDepenses(seedDepenses);
}

module.exports = db;
