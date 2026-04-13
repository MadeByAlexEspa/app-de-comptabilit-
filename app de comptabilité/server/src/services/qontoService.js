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

function getConfig() {
  return db.get('SELECT * FROM qonto_config WHERE id = 1');
}

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

async function runSync(config) {
  const { organization_slug: slug, secret_key, iban, last_sync_at } = config;

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
  db.run('UPDATE qonto_config SET last_sync_at = ? WHERE id = 1', [now]);
  db.run(
    'INSERT INTO qonto_sync_log (synced_at, fetched, imported, skipped, errors) VALUES (?, ?, ?, ?, ?)',
    [now, fetched, imported, skipped, errors.length ? errors.join('\n') : null]
  );

  return { synced_at: now, fetched, imported, skipped, errors };
}

// ── Auto-sync (daily) ─────────────────────────────────────────────────────────

const MS_24H = 24 * 60 * 60 * 1000;

function scheduleAutoSync() {
  setInterval(async () => {
    const config = getConfig();
    if (!config?.auto_sync_enabled || !config?.iban) return;

    const lastSync = config.last_sync_at ? new Date(config.last_sync_at).getTime() : 0;
    if (Date.now() - lastSync < MS_24H) return;

    console.log('[qonto] Auto-sync démarré…');
    try {
      const result = await runSync(config);
      console.log(`[qonto] Auto-sync terminé : ${result.imported} importées, ${result.skipped} ignorées`);
    } catch (e) {
      console.error('[qonto] Auto-sync échoué :', e.message);
    }
  }, 60 * 60 * 1000); // vérifie toutes les heures
}

module.exports = { getConfig, getOrganization, runSync, scheduleAutoSync, PCG_PRODUITS, PCG_CHARGES, DEFAULT_MAPPINGS };
