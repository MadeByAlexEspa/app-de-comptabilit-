/**
 * Qonto API v2 integration service.
 * Auth: Authorization header = "{organization_slug}:{secret_key}"
 * Docs: https://api-doc.qonto.com/
 *
 * All functions accept `db` as their first argument (the workspace DB).
 */

const QONTO_BASE = 'https://thirdparty.qonto.com/v2';

// ── Fallback PCG categories (new tiers with no history) ───────────────────────

const DEFAULT_CREDIT_CAT = '706 \u2013 Prestations de services';
const DEFAULT_DEBIT_CAT  = '604 \u2013 Achats de prestations de services';

// ── Helpers ───────────────────────────────────────────────────────────────────

function round2(n) {
  return Math.round(n * 100) / 100;
}

// Fix UTF-8 bytes misinterpreted as Latin-1 (mojibake: "Ã©" → "é")
function fixMojibake(str) {
  if (typeof str !== 'string') return str;
  try {
    const candidate = Buffer.from(str, 'latin1').toString('utf8');
    return candidate.includes('�') ? str : candidate;
  } catch {
    return str;
  }
}

// Look up the most recent PCG category used for this tiers name.
// Searches factures (for credits) or dépenses (for debits) case-insensitively.
function lookupTiersCategorie(db, tiers, side) {
  const t = (tiers || '').trim();
  if (!t) return side === 'credit' ? DEFAULT_CREDIT_CAT : DEFAULT_DEBIT_CAT;

  if (side === 'credit') {
    const row = db.get(
      'SELECT categorie FROM factures WHERE LOWER(client) = LOWER(?) ORDER BY date DESC LIMIT 1',
      [t]
    );
    return row?.categorie || DEFAULT_CREDIT_CAT;
  } else {
    const row = db.get(
      'SELECT categorie FROM depenses WHERE LOWER(fournisseur) = LOWER(?) ORDER BY date DESC LIMIT 1',
      [t]
    );
    return row?.categorie || DEFAULT_DEBIT_CAT;
  }
}

// ── Multi-account CRUD ────────────────────────────────────────────────────────

function getAllAccounts(db) {
  return db.prepare(
    'SELECT id, name, organization_slug, iban, auto_sync_enabled, last_sync_at, created_at FROM qonto_accounts ORDER BY created_at'
  ).all();
}

function getAccount(db, id) {
  return db.get('SELECT * FROM qonto_accounts WHERE id = ?', [id]);
}

function createAccount(db, data) {
  const result = db.prepare(
    'INSERT INTO qonto_accounts (name, organization_slug, secret_key, iban, auto_sync_enabled) VALUES (@name, @organization_slug, @secret_key, @iban, @auto_sync_enabled)'
  ).run({
    name:              data.name || 'Compte Qonto',
    organization_slug: data.organization_slug,
    secret_key:        data.secret_key,
    iban:              data.iban || null,
    auto_sync_enabled: data.auto_sync_enabled ? 1 : 0,
  });
  return result.lastInsertRowid;
}

function updateAccount(db, id, data) {
  const existing = getAccount(db, id);
  if (!existing) throw new Error('Compte introuvable');
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

function deleteAccount(db, id) {
  db.run('DELETE FROM qonto_accounts WHERE id = ?', [id]);
}

// ── Legacy single-config accessor (backward compat) ───────────────────────────

function getConfig(db) {
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

function isAlreadyImported(db, qontoId) {
  return !!db.get('SELECT id FROM qonto_imports WHERE qonto_transaction_id = ?', [qontoId]);
}

// Returns the import record (local_type + local_id) for an already-imported transaction
function getImportRecord(db, qontoId) {
  return db.get('SELECT local_type, local_id FROM qonto_imports WHERE qonto_transaction_id = ?', [qontoId]);
}

// If the Qonto transaction now has VAT data, update the local facture/depense.
// TTC is kept fixed; only montant_tva and montant_ht are recalculated.
// Returns true if an update was applied.
function applyVatUpdate(db, qontoId, tx) {
  if (!tx.vat_amount) return false;

  const montantTva = round2(tx.vat_amount / 100);
  if (montantTva <= 0) return false;

  const record = getImportRecord(db, qontoId);
  if (!record) return false;

  const table = record.local_type === 'facture' ? 'factures' : 'depenses';
  const row = db.get(`SELECT montant_ttc, montant_tva FROM ${table} WHERE id = ?`, [record.local_id]);
  if (!row) return false;

  // Skip if TVA already correct (within 1 cent)
  if (Math.abs(row.montant_tva - montantTva) < 0.01) return false;

  const montantHt = round2(row.montant_ttc - montantTva);
  const tauxTva   = tx.vat_rate ? parseFloat(tx.vat_rate) : null;

  if (tauxTva !== null) {
    db.run(
      `UPDATE ${table} SET montant_tva = ?, montant_ht = ?, taux_tva = ? WHERE id = ?`,
      [montantTva, montantHt, tauxTva, record.local_id]
    );
  } else {
    db.run(
      `UPDATE ${table} SET montant_tva = ?, montant_ht = ? WHERE id = ?`,
      [montantTva, montantHt, record.local_id]
    );
  }
  return true;
}

function recordImport(db, qontoId, type, localId, hasAttachment = false) {
  db.run(
    'INSERT INTO qonto_imports (qonto_transaction_id, local_type, local_id, has_attachment) VALUES (?, ?, ?, ?)',
    [qontoId, type, localId, hasAttachment ? 1 : 0]
  );
}

function updateAttachmentStatus(db, qontoId, hasAttachment) {
  db.run(
    'UPDATE qonto_imports SET has_attachment = ? WHERE qonto_transaction_id = ?',
    [hasAttachment ? 1 : 0, qontoId]
  );
}

function nextQontoNumero(db) {
  const row = db.get(
    "SELECT MAX(CAST(SUBSTR(numero, 5) AS INTEGER)) AS n FROM factures WHERE numero LIKE 'QTO-%'"
  );
  return `QTO-${String((row?.n || 0) + 1).padStart(5, '0')}`;
}

function importTransaction(db, tx) {
  const amountCents = tx.amount_cents ?? Math.round((tx.amount || 0) * 100);
  const montantTtc  = round2(amountCents / 100);

  // Use VAT data from Qonto when available, otherwise default to 0 %
  let taux, montantTva, montantHt;
  if (tx.vat_amount && tx.vat_amount > 0) {
    montantTva = round2(tx.vat_amount / 100);
    montantHt  = round2(montantTtc - montantTva);
    taux       = tx.vat_rate != null ? parseFloat(tx.vat_rate) : (montantHt > 0 ? round2((montantTva / montantHt) * 100) : 0);
  } else {
    taux       = 0;
    montantTva = 0;
    montantHt  = montantTtc;
  }

  const date          = (tx.settled_at || tx.emitted_at || '').slice(0, 10);
  const label         = fixMojibake((tx.label || '').trim() || (tx.side === 'credit' ? 'Virement reçu' : 'Paiement'));
  const note          = fixMojibake((tx.note  || '').trim());
  const hasAttachment = Array.isArray(tx.attachment_ids) && tx.attachment_ids.length > 0;

  // Auto-assign category from tiers history, else use PCG default
  const categorie = lookupTiersCategorie(db, label, tx.side);

  if (tx.side === 'credit') {
    const stmt = db.prepare(`
      INSERT INTO factures (numero, date, client, description, montant_ht, taux_tva, montant_tva, montant_ttc, categorie, statut)
      VALUES (@numero, @date, @client, @description, @montant_ht, @taux_tva, @montant_tva, @montant_ttc, @categorie, @statut)
    `);
    const result = stmt.run({
      numero:      nextQontoNumero(db),
      date,
      client:      label,
      description: note || label,
      montant_ht:  montantHt,
      taux_tva:    taux,
      montant_tva: montantTva,
      montant_ttc: montantTtc,
      categorie,
      statut:      'payee',
    });
    recordImport(db, tx.transaction_id, 'facture', result.lastInsertRowid, hasAttachment);
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
      categorie,
      statut:      'payee',
    });
    recordImport(db, tx.transaction_id, 'depense', result.lastInsertRowid, hasAttachment);
  }
}

// ── Sync ──────────────────────────────────────────────────────────────────────

async function runSync(db, account) {
  const { id: accountId, organization_slug: slug, secret_key, iban, last_sync_at } = account;

  let page     = 1;
  let fetched  = 0;
  let imported = 0;
  let updated  = 0;
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
        if (isAlreadyImported(db, tx.transaction_id)) {
          try {
            const hasAtt = Array.isArray(tx.attachment_ids) && tx.attachment_ids.length > 0;
            updateAttachmentStatus(db, tx.transaction_id, hasAtt);
            if (applyVatUpdate(db, tx.transaction_id, tx)) updated++;
            else skipped++;
          } catch (e) {
            errors.push(`[${tx.transaction_id}] vat-update: ${e.message}`);
            skipped++;
          }
          continue;
        }
        try {
          importTransaction(db, tx);
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

  if (accountId) {
    db.run('UPDATE qonto_accounts SET last_sync_at = ? WHERE id = ?', [now, accountId]);
  } else {
    db.run('UPDATE qonto_config SET last_sync_at = ? WHERE id = 1', [now]);
  }

  db.run(
    'INSERT INTO qonto_sync_log (account_id, synced_at, fetched, imported, skipped, errors) VALUES (?, ?, ?, ?, ?, ?)',
    [accountId || null, now, fetched, imported, skipped + updated, errors.length ? errors.join('\n') : null]
  );

  return { synced_at: now, fetched, imported, updated, skipped, errors };
}

// ── Auto-sync (daily, all accounts) ──────────────────────────────────────────
// The auto-sync uses workspace 1 (compta.db) for the legacy schedule.
// For a full multi-tenant auto-sync, iterate over all workspaces from masterDb.

const MS_24H = 24 * 60 * 60 * 1000;

function scheduleAutoSync() {
  const { getWorkspaceDb } = require('../db/database');
  setInterval(async () => {
    // Auto-sync only workspace 1 (legacy behaviour — workspace 1 is compta.db)
    const db = getWorkspaceDb(1);
    const accounts = getAllAccounts(db);
    for (const acct of accounts) {
      if (!acct.auto_sync_enabled || !acct.iban) continue;
      const lastSync = acct.last_sync_at ? new Date(acct.last_sync_at).getTime() : 0;
      if (Date.now() - lastSync < MS_24H) continue;
      console.log(`[qonto] Auto-sync démarré pour "${acct.name}"…`);
      try {
        const fullAcct = getAccount(db, acct.id);
        const result = await runSync(db, fullAcct);
        console.log(`[qonto] "${acct.name}" : ${result.imported} importées, ${result.skipped} ignorées`);
      } catch (e) {
        console.error(`[qonto] "${acct.name}" auto-sync échoué :`, e.message);
      }
    }
  }, 60 * 60 * 1000);
}

// ── Expense note attachment upload ────────────────────────────────────────────

async function uploadAttachment(slug, secretKey, fileBuffer, filename, mimeType) {
  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: mimeType });
  formData.append('file', blob, filename);

  const res = await fetch(`${QONTO_BASE}/attachments`, {
    method: 'POST',
    headers: { Authorization: `${slug}:${secretKey}` },
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || body.error || `Qonto HTTP ${res.status}`);
  }
  return res.json();
}

module.exports = {
  getAllAccounts,
  getAccount,
  createAccount,
  updateAccount,
  deleteAccount,
  getConfig,
  getOrganization,
  runSync,
  scheduleAutoSync,
  uploadAttachment,
};
