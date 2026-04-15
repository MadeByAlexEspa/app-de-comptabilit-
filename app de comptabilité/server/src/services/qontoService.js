/**
 * Qonto API v2 integration service.
 * Auth: Authorization header = "{organization_slug}:{secret_key}"
 * Docs: https://api-doc.qonto.com/
 */
const db = require('../db/database');

const QONTO_BASE = 'https://thirdparty.qonto.com/v2';

// ── PCG account lists (shared with frontend via /api/qonto/mappings) ──────────

const PCG_PRODUITS = [
  '706 \u2013 Prestations de services',
  '701 \u2013 Ventes de produits finis',
  '707 \u2013 Ventes de marchandises',
  '708 \u2013 Produits des activités annexes',
  '74 \u2013 Subventions d\u2019exploitation',
  '75 \u2013 Autres produits de gestion courante',
  '76 \u2013 Produits financiers',
  '77 \u2013 Produits exceptionnels',
];

const PCG_CHARGES = [
  '604 \u2013 Achats de prestations de services',
  '606 \u2013 Fournitures et petits équipements',
  '607 \u2013 Achats de marchandises',
  '611 \u2013 Sous-traitance générale',
  '613 \u2013 Locations & charges locatives',
  '615 \u2013 Entretien et réparations',
  '616 \u2013 Primes d\u2019assurance',
  '618 \u2013 Abonnements & frais informatiques',
  '622 \u2013 Honoraires et rémunérations d\u2019intermédiaires',
  '623 \u2013 Publicité & communication',
  '624 \u2013 Transports de biens',
  '625 \u2013 Déplacements, missions & réceptions',
  '626 \u2013 Frais postaux & télécommunications',
  '627 \u2013 Services bancaires & assimilés',
  '641 \u2013 Rémunérations du personnel',
  '645 \u2013 Charges sociales & cotisations',
  '681 \u2013 Dotations aux amortissements d\u2019exploitation',
  '661 \u2013 Charges d\u2019intérêts',
  '668 \u2013 Autres charges financières',
  '671 \u2013 Charges exceptionnelles sur opérations de gestion',
  '675 \u2013 Valeurs comptables des éléments cédés',
];

// Default mapping: Qonto operation_type × side → PCG + taux TVA
const DEFAULT_MAPPINGS = [
  // ── Crédits (revenus) ──────────────────────────────────────────────────────
  { qonto_operation_type: 'transfer',      side: 'credit', pcg_category: '706 \u2013 Prestations de services',                     default_taux_tva: 20 },
  { qonto_operation_type: 'card_refund',   side: 'credit', pcg_category: '75 \u2013 Autres produits de gestion courante',           default_taux_tva: 20 },
  { qonto_operation_type: 'direct_debit',  side: 'credit', pcg_category: '75 \u2013 Autres produits de gestion courante',           default_taux_tva: 20 },
  { qonto_operation_type: 'cheque',        side: 'credit', pcg_category: '706 \u2013 Prestations de services',                     default_taux_tva: 20 },
  { qonto_operation_type: 'other',         side: 'credit', pcg_category: '75 \u2013 Autres produits de gestion courante',           default_taux_tva: 20 },
  // ── Débits (charges) ───────────────────────────────────────────────────────
  { qonto_operation_type: 'transfer',      side: 'debit',  pcg_category: '604 \u2013 Achats de prestations de services',            default_taux_tva: 20 },
  { qonto_operation_type: 'card',          side: 'debit',  pcg_category: '606 \u2013 Fournitures et petits équipements',            default_taux_tva: 20 },
  { qonto_operation_type: 'direct_debit',  side: 'debit',  pcg_category: '613 \u2013 Locations & charges locatives',                default_taux_tva: 20 },
  { qonto_operation_type: 'qonto_fee',     side: 'debit',  pcg_category: '627 \u2013 Services bancaires & assimilés',               default_taux_tva: 20 },
  { qonto_operation_type: 'atm',           side: 'debit',  pcg_category: '625 \u2013 Déplacements, missions & réceptions',          default_taux_tva: 0  },
  { qonto_operation_type: 'cheque',        side: 'debit',  pcg_category: '604 \u2013 Achats de prestations de services',            default_taux_tva: 20 },
  { qonto_operation_type: 'payroll',       side: 'debit',  pcg_category: '641 \u2013 Rémunérations du personnel',                   default_taux_tva: 0  },
  { qonto_operation_type: 'recall',        side: 'debit',  pcg_category: '668 \u2013 Autres charges financières',                   default_taux_tva: 0  },
  { qonto_operation_type: 'other',         side: 'debit',  pcg_category: '604 \u2013 Achats de prestations de services',            default_taux_tva: 20 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function round2(n) {
  return Math.round(n * 100) / 100;
}

// ── Multi-account CRUD ────────────────────────────────────────────────────────

function getAllAccounts() {
  return db.prepare(
    'SELECT id, name, organization_slug, iban, auto_sync_enabled, last_sync_at, created_at FROM qonto_accounts ORDER BY created_at'
  ).all();
}

function getAccount(id) {
  return db.get('SELECT * FROM qonto_accounts WHERE id = ?', [id]);
}

function createAccount(data) {
  const result = db.prepare(
    'INSERT INTO qonto_accounts (name, organization_slug, secret_key, iban, auto_sync_enabled) VALUES (@name, @organization_slug, @secret_key, @iban, @auto_sync_enabled)'
  ).run({
    name:              data.name || 'Compte Qonto',
    organization_slug: data.organization_slug,
    secret_key:        data.secret_key,
    iban:              data.iban || null,
    auto_sync_enabled: data.auto_sync_enabled ? 1 : 0,
  });
  // Seed default mappings once (shared across all accounts)
  const mappingCount = db.get('SELECT COUNT(*) AS cnt FROM qonto_category_mapping');
  if (mappingCount.cnt === 0) {
    for (const m of DEFAULT_MAPPINGS) {
      db.run(
        'INSERT OR IGNORE INTO qonto_category_mapping (qonto_operation_type, side, pcg_category, default_taux_tva) VALUES (?,?,?,?)',
        [m.qonto_operation_type, m.side, m.pcg_category, m.default_taux_tva]
      );
    }
  }
  return result.lastInsertRowid;
}

function updateAccount(id, data) {
  const existing = getAccount(id);
  if (!existing) throw new Error('Compte introuvable');
  // Preserve secret if placeholder submitted
  const newSecret = data.secret_key?.startsWith('\u2022') ? existing.secret_key : data.secret_key;
  db.run(
    'UPDATE qonto_accounts SET name=?, organization_slug=?, secret_key=?, iban=?, auto_sync_enabled=? WHERE id=?',
    [
      data.name              ?? existing.name,
      data.organization_slug ?? existing.organization_slug,
      newSecret              ?? existing.secret_key,
      data.iban              ?? existing.iban,
      data.auto_sync_enabled  ? 1 : 0,
      id,
    ]
  );
}

function deleteAccount(id) {
  db.run('DELETE FROM qonto_accounts WHERE id = ?', [id]);
}

// ── Legacy single-config accessor (backward compat) ───────────────────────────

function getConfig() {
  // Try qonto_accounts first (new), fall back to qonto_config (legacy)
  const acct = db.get('SELECT * FROM qonto_accounts ORDER BY created_at LIMIT 1');
  if (acct) return acct;
  return db.get('SELECT * FROM qonto_config WHERE id = 1');
}

// ── Qonto API helpers ─────────────────────────────────────────────────────────

async function qontoFetch(path, slug, secretKey) {
  const res = await fetch(`${QONTO_BASE}${path}`, {
    headers: { Authorization: `${slug}:${secretKey}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body.message || body.error || `HTTP ${res.status}`;
    throw new Error(`Qonto API : ${msg}`);
  }
  return res.json();
}

async function getOrganization(slug, secretKey) {
  return qontoFetch(`/organizations/${slug}`, slug, secretKey);
}

async function fetchTransactions(slug, secretKey, iban, { after, page = 1 } = {}) {
  let url = `/transactions?iban=${encodeURIComponent(iban)}&status=completed&sort_by=settled_at:asc&current_page=${page}&per_page=100`;
  if (after) url += `&filters[settled_at_from]=${encodeURIComponent(after)}`;
  return qontoFetch(url, slug, secretKey);
}

function lookupMapping(operationType, side) {
  const row = db.get(
    'SELECT pcg_category, default_taux_tva FROM qonto_category_mapping WHERE qonto_operation_type = ? AND side = ?',
    [operationType, side]
  );
  if (row) return row;
  return {
    pcg_category: side === 'credit'
      ? '706 \u2013 Prestations de services'
      : '604 \u2013 Achats de prestations de services',
    default_taux_tva: 20,
  };
}

function isAlreadyImported(qontoId) {
  return !!db.get('SELECT id FROM qonto_imports WHERE qonto_transaction_id = ?', [qontoId]);
}

function recordImport(qontoId, type, localId) {
  db.run(
    'INSERT INTO qonto_imports (qonto_transaction_id, local_type, local_id) VALUES (?, ?, ?)',
    [qontoId, type, localId]
  );
}

function nextQontoNumero() {
  const row = db.get(
    "SELECT MAX(CAST(SUBSTR(numero, 5) AS INTEGER)) AS n FROM factures WHERE numero LIKE 'QTO-%'"
  );
  return `QTO-${String((row?.n || 0) + 1).padStart(5, '0')}`;
}

function importTransaction(tx) {
  const { pcg_category, default_taux_tva } = lookupMapping(tx.operation_type, tx.side);

  const amountCents = tx.amount_cents ?? Math.round((tx.amount || 0) * 100);
  const montantTtc  = round2(amountCents / 100);
  const taux        = default_taux_tva;
  const montantHt   = round2(montantTtc / (1 + taux / 100));
  const montantTva  = round2(montantTtc - montantHt);
  const date        = (tx.settled_at || tx.emitted_at || '').slice(0, 10);
  const label       = (tx.label || '').trim() || (tx.side === 'credit' ? 'Virement reçu' : 'Paiement');
  const note        = (tx.note || '').trim();

  if (tx.side === 'credit') {
    const stmt = db.prepare(`
      INSERT INTO factures (numero, date, client, description, montant_ht, taux_tva, montant_tva, montant_ttc, categorie, statut)
      VALUES (@numero, @date, @client, @description, @montant_ht, @taux_tva, @montant_tva, @montant_ttc, @categorie, @statut)
    `);
    const result = stmt.run({
      numero:      nextQontoNumero(),
      date,
      client:      label,
      description: note || label,
      montant_ht:  montantHt,
      taux_tva:    taux,
      montant_tva: montantTva,
      montant_ttc: montantTtc,
      categorie:   pcg_category,
      statut:      'payee',
    });
    recordImport(tx.transaction_id, 'facture', result.lastInsertRowid);
  } else {
    const stmt = db.prepare(`
      INSERT INTO depenses (date, fournisseur, description, montant_ht, taux_tva, montant_tva, montant_ttc, categorie, statut)
      VALUES (@date, @fournisseur, @description, @montant_ht, @taux_tva, @montant_tva, @montant_ttc, @categorie, @statut)
    `);
    const result = stmt.run({
      date,
      fournisseur: label,
      description: note || label,
      montant_ht:  montantHt,
      taux_tva:    taux,
      montant_tva: montantTva,
      montant_ttc: montantTtc,
      categorie:   pcg_category,
      statut:      'payee',
    });
    recordImport(tx.transaction_id, 'depense', result.lastInsertRowid);
  }
}

// ── Sync ──────────────────────────────────────────────────────────────────────

async function runSync(account) {
  const { id: accountId, organization_slug: slug, secret_key, iban, last_sync_at } = account;

  let page     = 1;
  let fetched  = 0;
  let imported = 0;
  let skipped  = 0;
  const errors = [];

  try {
    while (true) {
      const data = await fetchTransactions(slug, secret_key, iban, {
        after: last_sync_at || undefined,
        page,
      });

      const transactions = data.transactions || [];
      fetched += transactions.length;

      for (const tx of transactions) {
        if (isAlreadyImported(tx.transaction_id)) {
          skipped++;
          continue;
        }
        try {
          importTransaction(tx);
          imported++;
        } catch (e) {
          errors.push(`[${tx.transaction_id}] ${e.message}`);
        }
      }

      const meta = data.meta || {};
      if (!meta.next_page || transactions.length === 0) break;
      page++;
    }
  } catch (e) {
    errors.push(e.message);
  }

  const now = new Date().toISOString();

  // Update last_sync_at on the account row
  if (accountId) {
    db.run('UPDATE qonto_accounts SET last_sync_at = ? WHERE id = ?', [now, accountId]);
  } else {
    // Fallback for legacy qonto_config row
    db.run('UPDATE qonto_config SET last_sync_at = ? WHERE id = 1', [now]);
  }

  db.run(
    'INSERT INTO qonto_sync_log (account_id, synced_at, fetched, imported, skipped, errors) VALUES (?, ?, ?, ?, ?, ?)',
    [accountId || null, now, fetched, imported, skipped, errors.length ? errors.join('\n') : null]
  );

  return { synced_at: now, fetched, imported, skipped, errors };
}

// ── Auto-sync (daily, all accounts) ──────────────────────────────────────────

const MS_24H = 24 * 60 * 60 * 1000;

function scheduleAutoSync() {
  setInterval(async () => {
    const accounts = getAllAccounts();
    for (const acct of accounts) {
      if (!acct.auto_sync_enabled || !acct.iban) continue;

      const lastSync = acct.last_sync_at ? new Date(acct.last_sync_at).getTime() : 0;
      if (Date.now() - lastSync < MS_24H) continue;

      console.log(`[qonto] Auto-sync démarré pour "${acct.name}"…`);
      try {
        // Need full account with secret_key
        const fullAcct = getAccount(acct.id);
        const result = await runSync(fullAcct);
        console.log(`[qonto] "${acct.name}" : ${result.imported} importées, ${result.skipped} ignorées`);
      } catch (e) {
        console.error(`[qonto] "${acct.name}" auto-sync échoué :`, e.message);
      }
    }
  }, 60 * 60 * 1000); // check every hour
}

module.exports = {
  // Multi-account CRUD
  getAllAccounts,
  getAccount,
  createAccount,
  updateAccount,
  deleteAccount,
  // Legacy
  getConfig,
  // Qonto API
  getOrganization,
  runSync,
  scheduleAutoSync,
  PCG_PRODUITS,
  PCG_CHARGES,
  DEFAULT_MAPPINGS,
};
