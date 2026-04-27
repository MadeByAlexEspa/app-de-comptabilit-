/**
 * Shine API v2 integration service.
 * Auth: Authorization: Bearer {access_token}
 * Docs: https://developers.shine.fr/
 *
 * All functions accept `db` as their first argument (the workspace DB).
 */

const SHINE_BASE = 'https://api.shine.fr/v2';

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
    'SELECT id, name, shine_account_id, iban, auto_sync_enabled, last_sync_at, created_at FROM shine_accounts ORDER BY created_at'
  ).all();
}

function getAccount(db, id) {
  return db.get('SELECT * FROM shine_accounts WHERE id = ?', [id]);
}

function createAccount(db, data) {
  const result = db.prepare(
    'INSERT INTO shine_accounts (name, access_token, shine_account_id, iban, auto_sync_enabled) VALUES (@name, @access_token, @shine_account_id, @iban, @auto_sync_enabled)'
  ).run({
    name:             data.name || 'Compte Shine',
    access_token:     data.access_token,
    shine_account_id: data.shine_account_id || null,
    iban:             data.iban || null,
    auto_sync_enabled: data.auto_sync_enabled ? 1 : 0,
  });
  return result.lastInsertRowid;
}

function updateAccount(db, id, data) {
  const existing = getAccount(db, id);
  if (!existing) throw new Error('Compte introuvable');
  // Preserve token if placeholder submitted
  const newToken = data.access_token?.startsWith('\u2022') ? existing.access_token : data.access_token;
  db.run(
    'UPDATE shine_accounts SET name=?, access_token=?, shine_account_id=?, iban=?, auto_sync_enabled=? WHERE id=?',
    [
      data.name             ?? existing.name,
      newToken              ?? existing.access_token,
      data.shine_account_id ?? existing.shine_account_id,
      data.iban             ?? existing.iban,
      data.auto_sync_enabled ? 1 : 0,
      id,
    ]
  );
}

function deleteAccount(db, id) {
  db.run('DELETE FROM shine_accounts WHERE id = ?', [id]);
}

// ── Shine API helpers ─────────────────────────────────────────────────────────

async function shineFetch(path, accessToken) {
  const res = await fetch(`${SHINE_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg  = body.message || body.error || `HTTP ${res.status}`;
    throw new Error(`Shine API : ${msg}`);
  }
  return res.json();
}

async function getBankAccounts(accessToken) {
  return shineFetch('/accounts', accessToken);
}

async function fetchTransactions(accessToken, shineAccountId, { after, cursor } = {}) {
  let url = `/accounts/${encodeURIComponent(shineAccountId)}/transactions?limit=100`;
  if (after)  url += `&from=${encodeURIComponent(after)}`;
  if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
  return shineFetch(url, accessToken);
}

function isAlreadyImported(db, shineId) {
  return !!db.get('SELECT id FROM shine_imports WHERE shine_transaction_id = ?', [shineId]);
}

function getImportRecord(db, shineId) {
  return db.get('SELECT local_type, local_id FROM shine_imports WHERE shine_transaction_id = ?', [shineId]);
}

// Shine may expose VAT as vatAmount (euros) or vat_amount (cents) depending on API version
function applyVatUpdate(db, shineId, tx) {
  // Support both naming conventions
  const rawVat  = tx.vatAmount  ?? tx.vat_amount  ?? null;
  const rawRate = tx.vatRate    ?? tx.vat_rate     ?? null;
  if (rawVat === null || rawVat === 0) return false;

  // Shine vatAmount is in euros (float); vat_amount would be cents
  const montantTva = round2(tx.vatAmount !== undefined ? rawVat : rawVat / 100);
  if (montantTva <= 0) return false;

  const record = getImportRecord(db, shineId);
  if (!record) return false;

  const table = record.local_type === 'facture' ? 'factures' : 'depenses';
  const row = db.get(`SELECT montant_ttc, montant_tva FROM ${table} WHERE id = ?`, [record.local_id]);
  if (!row) return false;

  if (Math.abs(row.montant_tva - montantTva) < 0.01) return false;

  const montantHt = round2(row.montant_ttc - montantTva);
  const tauxTva   = rawRate ? parseFloat(rawRate) : null;

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

function recordImport(db, shineId, type, localId, hasAttachment = false) {
  db.run(
    'INSERT INTO shine_imports (shine_transaction_id, local_type, local_id, has_attachment) VALUES (?, ?, ?, ?)',
    [shineId, type, localId, hasAttachment ? 1 : 0]
  );
}

function updateAttachmentStatus(db, shineId, hasAttachment) {
  db.run(
    'UPDATE shine_imports SET has_attachment = ? WHERE shine_transaction_id = ?',
    [hasAttachment ? 1 : 0, shineId]
  );
}

function nextShineNumero(db) {
  const row = db.get(
    "SELECT MAX(CAST(SUBSTR(numero, 5) AS INTEGER)) AS n FROM factures WHERE numero LIKE 'SHN-%'"
  );
  return `SHN-${String((row?.n || 0) + 1).padStart(5, '0')}`;
}

function importTransaction(db, tx) {
  // Shine: amount in cents, positive = credit, negative = debit
  const amountCents = typeof tx.amount === 'number' ? Math.abs(tx.amount) : 0;
  const side        = (tx.amount ?? 0) >= 0 ? 'credit' : 'debit';

  const montantTtc = round2(amountCents / 100);

  // Use VAT data from Shine when available (vatAmount in euros, vatRate in %)
  const rawVat  = tx.vatAmount  ?? tx.vat_amount  ?? null;
  const rawRate = tx.vatRate    ?? tx.vat_rate     ?? null;
  let taux, montantTva, montantHt;
  if (rawVat && rawVat > 0) {
    montantTva = round2(tx.vatAmount !== undefined ? rawVat : rawVat / 100);
    montantHt  = round2(montantTtc - montantTva);
    taux       = rawRate != null ? parseFloat(rawRate) : (montantHt > 0 ? round2((montantTva / montantHt) * 100) : 0);
  } else {
    taux       = 0;
    montantTva = 0;
    montantHt  = montantTtc;
  }

  const date          = (tx.executedAt || tx.createdAt || '').slice(0, 10);
  const label         = fixMojibake(
    (tx.label || tx.counterpartyName || '').trim() || (side === 'credit' ? 'Virement reçu' : 'Paiement')
  );
  const hasAttachment = !!(tx.attachments?.length || tx.receipt || tx.receiptUrl);

  // Auto-assign category from tiers history, else use PCG default
  const categorie = lookupTiersCategorie(db, label, side);

  if (side === 'credit') {
    const stmt = db.prepare(`
      INSERT INTO factures (numero, date, client, description, montant_ht, taux_tva, montant_tva, montant_ttc, categorie, statut)
      VALUES (@numero, @date, @client, @description, @montant_ht, @taux_tva, @montant_tva, @montant_ttc, @categorie, @statut)
    `);
    const result = stmt.run({
      numero:      nextShineNumero(db),
      date,
      client:      label,
      description: label,
      montant_ht:  montantHt,
      taux_tva:    taux,
      montant_tva: montantTva,
      montant_ttc: montantTtc,
      categorie,
      statut:      'payee',
    });
    recordImport(db, tx.id, 'facture', result.lastInsertRowid, hasAttachment);
  } else {
    const stmt = db.prepare(`
      INSERT INTO depenses (date, fournisseur, description, montant_ht, taux_tva, montant_tva, montant_ttc, categorie, statut)
      VALUES (@date, @fournisseur, @description, @montant_ht, @taux_tva, @montant_tva, @montant_ttc, @categorie, @statut)
    `);
    const result = stmt.run({
      date,
      fournisseur: label,
      description: label,
      montant_ht:  montantHt,
      taux_tva:    taux,
      montant_tva: montantTva,
      montant_ttc: montantTtc,
      categorie,
      statut:      'payee',
    });
    recordImport(db, tx.id, 'depense', result.lastInsertRowid, hasAttachment);
  }
}

// ── Sync ──────────────────────────────────────────────────────────────────────

async function runSync(db, account) {
  const { id: accountId, access_token, shine_account_id, last_sync_at } = account;

  let fetched  = 0;
  let imported = 0;
  let updated  = 0;
  let skipped  = 0;
  const errors = [];

  try {
    let cursor = undefined;
    while (true) {
      const data = await fetchTransactions(access_token, shine_account_id, {
        after:  last_sync_at ? last_sync_at.slice(0, 10) : undefined,
        cursor,
      });

      const transactions = data.transactions || data.items || [];
      fetched += transactions.length;

      for (const tx of transactions) {
        if (isAlreadyImported(db, tx.id)) {
          try {
            const hasAtt = !!(tx.attachments?.length || tx.receipt || tx.receiptUrl);
            updateAttachmentStatus(db, tx.id, hasAtt);
            if (applyVatUpdate(db, tx.id, tx)) updated++;
            else skipped++;
          } catch (e) {
            errors.push(`[${tx.id}] vat-update: ${e.message}`);
            skipped++;
          }
          continue;
        }
        try {
          importTransaction(db, tx);
          imported++;
        } catch (e) {
          errors.push(`[${tx.id}] ${e.message}`);
        }
      }

      const meta = data.meta || data.pagination || {};
      cursor = meta.cursor || meta.nextCursor || null;
      if (!cursor || transactions.length === 0) break;
    }
  } catch (e) {
    errors.push(e.message);
  }

  const now = new Date().toISOString();

  db.run('UPDATE shine_accounts SET last_sync_at = ? WHERE id = ?', [now, accountId]);
  db.run(
    'INSERT INTO shine_sync_log (account_id, synced_at, fetched, imported, skipped, errors) VALUES (?, ?, ?, ?, ?, ?)',
    [accountId, now, fetched, imported, skipped + updated, errors.length ? errors.join('\n') : null]
  );

  return { synced_at: now, fetched, imported, updated, skipped, errors };
}

// ── Auto-sync ─────────────────────────────────────────────────────────────────

const MS_24H = 24 * 60 * 60 * 1000;

function scheduleAutoSync() {
  const { getWorkspaceDb } = require('../db/database');
  setInterval(async () => {
    // Auto-sync only workspace 1 (legacy behaviour — workspace 1 is compta.db)
    const db = getWorkspaceDb(1);
    const accounts = getAllAccounts(db);
    for (const acct of accounts) {
      if (!acct.auto_sync_enabled || !acct.shine_account_id) continue;
      const lastSync = acct.last_sync_at ? new Date(acct.last_sync_at).getTime() : 0;
      if (Date.now() - lastSync < MS_24H) continue;
      console.log(`[shine] Auto-sync démarré pour "${acct.name}"…`);
      try {
        const full = getAccount(db, acct.id);
        const result = await runSync(db, full);
        console.log(`[shine] "${acct.name}" : ${result.imported} importées, ${result.skipped} ignorées`);
      } catch (e) {
        console.error(`[shine] "${acct.name}" auto-sync échoué :`, e.message);
      }
    }
  }, 60 * 60 * 1000);
}

module.exports = {
  getAllAccounts,
  getAccount,
  createAccount,
  updateAccount,
  deleteAccount,
  getBankAccounts,
  runSync,
  scheduleAutoSync,
};
