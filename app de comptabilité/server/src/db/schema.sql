-- ============================================================
-- Schema for the French accounting app
-- ============================================================

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
