-- ─────────────────────────────────────────────────────────────────────────────
-- Migration initiale — App de Comptabilité
-- Traduit le schéma SQLite multi-fichiers en Postgres mono-base avec RLS.
--
-- Architecture :
--   • auth.users  → géré par Supabase Auth (pas de table users custom)
--   • workspaces  → un workspace par organisation, lié à auth.users via memberships
--   • Toutes les tables métier ont une colonne workspace_id + politique RLS
-- ─────────────────────────────────────────────────────────────────────────────

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Workspaces ────────────────────────────────────────────────────────────────

CREATE TABLE workspaces (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  activite_type   TEXT,
  structure_type  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Memberships (remplace la table users du master.db) ────────────────────────
-- Lie un auth.users à un workspace avec un rôle.

CREATE TABLE memberships (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'admin', 'member')),
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, user_id)
);

-- ── Invitations ───────────────────────────────────────────────────────────────

CREATE TABLE invitations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'owner',
  token         TEXT NOT NULL UNIQUE,
  invited_by    UUID NOT NULL REFERENCES auth.users(id),
  expires_at    TIMESTAMPTZ NOT NULL,
  used_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Factures ──────────────────────────────────────────────────────────────────

CREATE TABLE factures (
  id            BIGSERIAL PRIMARY KEY,
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  numero        TEXT NOT NULL,
  date          DATE NOT NULL,
  client        TEXT NOT NULL,
  description   TEXT,
  montant_ht    NUMERIC(12, 2) NOT NULL,
  taux_tva      NUMERIC(5, 2)  NOT NULL,
  montant_tva   NUMERIC(12, 2) NOT NULL,
  montant_ttc   NUMERIC(12, 2) NOT NULL,
  tva_lines     JSONB,
  categorie     TEXT NOT NULL,
  statut        TEXT NOT NULL DEFAULT 'en_attente'
                  CHECK (statut IN ('payee', 'en_attente')),
  bank_source   TEXT,
  has_attachment BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX factures_workspace_date ON factures (workspace_id, date DESC);
CREATE INDEX factures_workspace_categorie ON factures (workspace_id, categorie);

-- ── Dépenses ──────────────────────────────────────────────────────────────────

CREATE TABLE depenses (
  id            BIGSERIAL PRIMARY KEY,
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  fournisseur   TEXT NOT NULL,
  description   TEXT,
  montant_ht    NUMERIC(12, 2) NOT NULL,
  taux_tva      NUMERIC(5, 2)  NOT NULL,
  montant_tva   NUMERIC(12, 2) NOT NULL,
  montant_ttc   NUMERIC(12, 2) NOT NULL,
  tva_lines     JSONB,
  categorie     TEXT NOT NULL,
  statut        TEXT NOT NULL DEFAULT 'en_attente'
                  CHECK (statut IN ('payee', 'en_attente')),
  bank_source   TEXT,
  has_attachment BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX depenses_workspace_date ON depenses (workspace_id, date DESC);
CREATE INDEX depenses_workspace_categorie ON depenses (workspace_id, categorie);

-- ── Qonto accounts ────────────────────────────────────────────────────────────

CREATE TABLE qonto_accounts (
  id                  BIGSERIAL PRIMARY KEY,
  workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name                TEXT NOT NULL DEFAULT 'Compte Qonto',
  organization_slug   TEXT,
  secret_key          TEXT,   -- chiffré côté app
  iban                TEXT,
  auto_sync_enabled   BOOLEAN NOT NULL DEFAULT FALSE,
  last_sync_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE qonto_imports (
  id                    BIGSERIAL PRIMARY KEY,
  workspace_id          UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  qonto_transaction_id  TEXT NOT NULL,
  local_type            TEXT NOT NULL CHECK (local_type IN ('facture', 'depense')),
  local_id              BIGINT NOT NULL,
  has_attachment        BOOLEAN NOT NULL DEFAULT FALSE,
  imported_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, qonto_transaction_id)
);

CREATE TABLE qonto_category_mapping (
  id                    BIGSERIAL PRIMARY KEY,
  workspace_id          UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  qonto_operation_type  TEXT NOT NULL,
  side                  TEXT NOT NULL CHECK (side IN ('credit', 'debit')),
  pcg_category          TEXT NOT NULL,
  default_taux_tva      NUMERIC(5, 2) NOT NULL DEFAULT 20,
  UNIQUE (workspace_id, qonto_operation_type, side)
);

CREATE TABLE qonto_sync_log (
  id            BIGSERIAL PRIMARY KEY,
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  account_id    BIGINT,
  synced_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fetched       INTEGER NOT NULL DEFAULT 0,
  imported      INTEGER NOT NULL DEFAULT 0,
  skipped       INTEGER NOT NULL DEFAULT 0,
  errors        TEXT
);

-- ── Shine accounts ────────────────────────────────────────────────────────────

CREATE TABLE shine_accounts (
  id                  BIGSERIAL PRIMARY KEY,
  workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name                TEXT NOT NULL DEFAULT 'Compte Shine',
  access_token        TEXT,   -- chiffré côté app
  shine_account_id    TEXT,
  iban                TEXT,
  auto_sync_enabled   BOOLEAN NOT NULL DEFAULT FALSE,
  last_sync_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE shine_imports (
  id                    BIGSERIAL PRIMARY KEY,
  workspace_id          UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  shine_transaction_id  TEXT NOT NULL,
  local_type            TEXT NOT NULL CHECK (local_type IN ('facture', 'depense')),
  local_id              BIGINT NOT NULL,
  has_attachment        BOOLEAN NOT NULL DEFAULT FALSE,
  imported_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, shine_transaction_id)
);

CREATE TABLE shine_category_mapping (
  id                    BIGSERIAL PRIMARY KEY,
  workspace_id          UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  shine_operation_type  TEXT NOT NULL,
  side                  TEXT NOT NULL CHECK (side IN ('credit', 'debit')),
  pcg_category          TEXT NOT NULL,
  default_taux_tva      NUMERIC(5, 2) NOT NULL DEFAULT 20,
  UNIQUE (workspace_id, shine_operation_type, side)
);

-- ── AI config ─────────────────────────────────────────────────────────────────

CREATE TABLE ai_config (
  workspace_id    UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL DEFAULT 'anthropic',
  api_key         TEXT,   -- chiffré côté app
  model           TEXT DEFAULT 'claude-sonnet-4-6',
  system_prompt   TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Notes de frais ────────────────────────────────────────────────────────────

CREATE TABLE expense_notes (
  id                    BIGSERIAL PRIMARY KEY,
  workspace_id          UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  original_name         TEXT NOT NULL,
  description           TEXT,
  montant_ttc           NUMERIC(12, 2),
  account_id            BIGINT,
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'sending', 'sent', 'error')),
  qonto_attachment_id   TEXT,
  error_message         TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at               TIMESTAMPTZ
);

-- ── Row Level Security ────────────────────────────────────────────────────────
-- Chaque utilisateur ne voit que les données de ses workspaces.
-- La fonction helper retourne les workspace_ids auxquels l'utilisateur appartient.

CREATE OR REPLACE FUNCTION auth_workspace_ids()
RETURNS SETOF UUID
LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
  SELECT workspace_id FROM memberships WHERE user_id = auth.uid()
$$;

-- Activer RLS sur toutes les tables
ALTER TABLE workspaces              ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships             ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations             ENABLE ROW LEVEL SECURITY;
ALTER TABLE factures                ENABLE ROW LEVEL SECURITY;
ALTER TABLE depenses                ENABLE ROW LEVEL SECURITY;
ALTER TABLE qonto_accounts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE qonto_imports           ENABLE ROW LEVEL SECURITY;
ALTER TABLE qonto_category_mapping  ENABLE ROW LEVEL SECURITY;
ALTER TABLE qonto_sync_log          ENABLE ROW LEVEL SECURITY;
ALTER TABLE shine_accounts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE shine_imports           ENABLE ROW LEVEL SECURITY;
ALTER TABLE shine_category_mapping  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_config               ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_notes           ENABLE ROW LEVEL SECURITY;

-- Workspaces : visible si membre
CREATE POLICY workspaces_select ON workspaces
  FOR SELECT USING (id IN (SELECT auth_workspace_ids()));

CREATE POLICY workspaces_update ON workspaces
  FOR UPDATE USING (id IN (SELECT auth_workspace_ids()));

CREATE POLICY workspaces_delete ON workspaces
  FOR DELETE USING (id IN (SELECT auth_workspace_ids()));

-- Memberships : visible si dans le même workspace
CREATE POLICY memberships_select ON memberships
  FOR SELECT USING (workspace_id IN (SELECT auth_workspace_ids()));

CREATE POLICY memberships_insert ON memberships
  FOR INSERT WITH CHECK (workspace_id IN (SELECT auth_workspace_ids()));

CREATE POLICY memberships_delete ON memberships
  FOR DELETE USING (workspace_id IN (SELECT auth_workspace_ids()));

-- Macro pour les tables métier (select/insert/update/delete par workspace)
-- Appliqué à : factures, depenses, qonto_*, shine_*, ai_config, expense_notes, invitations

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'factures', 'depenses',
    'qonto_accounts', 'qonto_imports', 'qonto_category_mapping', 'qonto_sync_log',
    'shine_accounts', 'shine_imports', 'shine_category_mapping',
    'ai_config', 'expense_notes', 'invitations'
  ]
  LOOP
    EXECUTE format(
      'CREATE POLICY %I_select ON %I FOR SELECT USING (workspace_id IN (SELECT auth_workspace_ids()))',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY %I_insert ON %I FOR INSERT WITH CHECK (workspace_id IN (SELECT auth_workspace_ids()))',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY %I_update ON %I FOR UPDATE USING (workspace_id IN (SELECT auth_workspace_ids()))',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY %I_delete ON %I FOR DELETE USING (workspace_id IN (SELECT auth_workspace_ids()))',
      tbl, tbl
    );
  END LOOP;
END
$$;
