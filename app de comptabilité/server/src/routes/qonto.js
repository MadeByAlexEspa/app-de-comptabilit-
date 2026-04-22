const { Router } = require('express');
const multer = require('multer');
const { getWorkspaceDb } = require('../db/database');
const {
  getAllAccounts,
  getAccount,
  createAccount,
  updateAccount,
  deleteAccount,
  getConfig,
  getOrganization,
  runSync,
  uploadAttachment,
} = require('../services/qontoService');

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: (_req, file, cb) => {
    cb(null, ALLOWED_MIMES.has(file.mimetype));
  },
});

function sanitizeFilename(name) {
  return (name || 'fichier')
    .replace(/[/\\?%*:|"<>]/g, '_')
    .slice(0, 200);
}

// Validate file content via magic bytes (not just Content-Type header)
function validateMagicBytes(buffer, declaredMime) {
  if (buffer.length < 4) return false;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return declaredMime === 'image/jpeg';
  }
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return declaredMime === 'image/png';
  }
  // PDF: 25 50 44 46 (% P D F)
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return declaredMime === 'application/pdf';
  }
  // WebP: RIFF....WEBP
  if (buffer.length >= 12 &&
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
    return declaredMime === 'image/webp';
  }
  // HEIC: complex container — allow through if declared as heic (mobile camera)
  if (declaredMime === 'image/heic') return true;
  return false;
}

const router = Router();

// ── Multi-account CRUD ────────────────────────────────────────────────────────

// GET /api/qonto/configs — list all configured accounts (no secret keys)
router.get('/configs', (req, res, next) => {
  try {
    const db = getWorkspaceDb(req.user.workspaceId);
    res.json({ accounts: getAllAccounts(db) });
  } catch (e) { next(e); }
});

// POST /api/qonto/configs — create new account
router.post('/configs', (req, res, next) => {
  try {
    const db = getWorkspaceDb(req.user.workspaceId);
    const { name, organization_slug, secret_key, iban, auto_sync_enabled } = req.body;
    if (!organization_slug || !secret_key) {
      return res.status(400).json({ error: 'organization_slug et secret_key sont requis' });
    }
    const id = createAccount(db, { name, organization_slug, secret_key, iban, auto_sync_enabled });
    res.json({ ok: true, id });
  } catch (e) { next(e); }
});

// GET /api/qonto/configs/:id — single account (no secret key)
router.get('/configs/:id', (req, res, next) => {
  try {
    const db = getWorkspaceDb(req.user.workspaceId);
    const acct = getAccount(db, Number(req.params.id));
    if (!acct) return res.status(404).json({ error: 'Compte introuvable' });
    const { secret_key, ...safe } = acct;
    res.json({
      ...safe,
      secret_key_masked: secret_key ? '\u2022\u2022\u2022\u2022' + secret_key.slice(-4) : null,
    });
  } catch (e) { next(e); }
});

// PUT /api/qonto/configs/:id — update account
router.put('/configs/:id', (req, res, next) => {
  try {
    const db = getWorkspaceDb(req.user.workspaceId);
    const id = Number(req.params.id);
    const { name, organization_slug, secret_key, iban, auto_sync_enabled } = req.body;
    updateAccount(db, id, { name, organization_slug, secret_key, iban, auto_sync_enabled });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// DELETE /api/qonto/configs/:id — delete account
router.delete('/configs/:id', (req, res, next) => {
  try {
    const db = getWorkspaceDb(req.user.workspaceId);
    deleteAccount(db, Number(req.params.id));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// GET /api/qonto/configs/:id/bank-accounts — fetch Qonto bank accounts for this config
router.get('/configs/:id/bank-accounts', async (req, res, next) => {
  try {
    const db = getWorkspaceDb(req.user.workspaceId);
    const acct = getAccount(db, Number(req.params.id));
    if (!acct?.organization_slug) return res.status(400).json({ error: 'Compte non configuré' });
    const data = await getOrganization(acct.organization_slug, acct.secret_key);
    const accounts = (data.organization?.bank_accounts || []).map(a => ({
      iban:     a.iban,
      name:     a.name,
      balance:  a.balance,
      currency: a.currency,
    }));
    res.json({ accounts });
  } catch (e) { next(e); }
});

// POST /api/qonto/configs/:id/sync — sync specific account
router.post('/configs/:id/sync', async (req, res, next) => {
  try {
    const db = getWorkspaceDb(req.user.workspaceId);
    const acct = getAccount(db, Number(req.params.id));
    if (!acct?.organization_slug || !acct?.secret_key || !acct?.iban) {
      return res.status(400).json({ error: 'Compte non configuré (slug, clé API et IBAN requis)' });
    }
    const result = await runSync(db, acct);
    res.json(result);
  } catch (e) { next(e); }
});

// POST /api/qonto/sync-all — sync all configured accounts
router.post('/sync-all', async (req, res, next) => {
  try {
    const db = getWorkspaceDb(req.user.workspaceId);
    const accounts = getAllAccounts(db);
    const results = [];
    for (const acct of accounts) {
      if (!acct.iban) {
        results.push({ id: acct.id, name: acct.name, skipped: true, reason: 'IBAN manquant' });
        continue;
      }
      try {
        const full = getAccount(db, acct.id);
        const r = await runSync(db, full);
        results.push({ id: acct.id, name: acct.name, ...r });
      } catch (e) {
        results.push({ id: acct.id, name: acct.name, error: e.message });
      }
    }
    res.json({ results });
  } catch (e) { next(e); }
});

// ── Legacy single-config routes (backward compat) ─────────────────────────────

// GET /api/qonto/config
router.get('/config', (req, res, next) => {
  try {
    const db = getWorkspaceDb(req.user.workspaceId);
    const config = getConfig(db);
    if (!config?.organization_slug) {
      return res.json({ configured: false });
    }
    res.json({
      configured:          true,
      organization_slug:   config.organization_slug,
      secret_key_masked:   config.secret_key
        ? '\u2022\u2022\u2022\u2022' + config.secret_key.slice(-4)
        : null,
      iban:                config.iban,
      auto_sync_enabled:   !!config.auto_sync_enabled,
      last_sync_at:        config.last_sync_at,
    });
  } catch (e) { next(e); }
});

// POST /api/qonto/config — upserts the first account (legacy)
router.post('/config', (req, res, next) => {
  try {
    const db = getWorkspaceDb(req.user.workspaceId);
    const { organization_slug, secret_key, iban, auto_sync_enabled } = req.body;
    if (!organization_slug || !secret_key) {
      return res.status(400).json({ error: 'organization_slug et secret_key sont requis' });
    }

    const existing = getConfig(db);
    const autoSync = auto_sync_enabled ? 1 : 0;

    if (existing?.id && existing.id !== undefined) {
      // existing is from qonto_accounts
      const newSecret = secret_key.startsWith('\u2022') ? existing.secret_key : secret_key;
      db.run(
        'UPDATE qonto_accounts SET organization_slug=?, secret_key=?, iban=?, auto_sync_enabled=? WHERE id=?',
        [organization_slug, newSecret, iban ?? existing.iban, autoSync, existing.id]
      );
    } else if (existing) {
      // existing is from qonto_config (legacy)
      const newSecret = secret_key.startsWith('\u2022') ? existing.secret_key : secret_key;
      db.run(
        'UPDATE qonto_config SET organization_slug=?, secret_key=?, iban=?, auto_sync_enabled=? WHERE id=1',
        [organization_slug, newSecret, iban ?? existing.iban, autoSync]
      );
    } else {
      db.run(
        'INSERT INTO qonto_config (id, organization_slug, secret_key, iban, auto_sync_enabled) VALUES (1,?,?,?,?)',
        [organization_slug, secret_key, iban ?? null, autoSync]
      );
    }

    res.json({ ok: true });
  } catch (e) { next(e); }
});

// GET /api/qonto/accounts — fetch Qonto bank accounts from API (legacy, uses first config)
router.get('/accounts', async (req, res, next) => {
  try {
    const db = getWorkspaceDb(req.user.workspaceId);
    const config = getConfig(db);
    if (!config?.organization_slug) {
      return res.status(400).json({ error: 'Qonto non configuré' });
    }
    const data = await getOrganization(config.organization_slug, config.secret_key);
    const accounts = (data.organization?.bank_accounts || []).map(a => ({
      iban:     a.iban,
      name:     a.name,
      balance:  a.balance,
      currency: a.currency,
    }));
    res.json({ accounts });
  } catch (e) { next(e); }
});

// ── Legacy sync routes ────────────────────────────────────────────────────────

// POST /api/qonto/sync
router.post('/sync', async (req, res, next) => {
  try {
    const db = getWorkspaceDb(req.user.workspaceId);
    const config = getConfig(db);
    if (!config?.organization_slug || !config?.secret_key || !config?.iban) {
      return res.status(400).json({ error: 'Qonto non configuré (slug, clé API et IBAN requis)' });
    }
    const result = await runSync(db, config);
    res.json(result);
  } catch (e) { next(e); }
});

// GET /api/qonto/sync/log
router.get('/sync/log', (req, res, next) => {
  try {
    const db = getWorkspaceDb(req.user.workspaceId);
    const logs = db
      .prepare(`
        SELECT l.*, a.name AS account_name
        FROM qonto_sync_log l
        LEFT JOIN qonto_accounts a ON a.id = l.account_id
        ORDER BY l.synced_at DESC LIMIT 50
      `)
      .all();
    res.json({ logs });
  } catch (e) { next(e); }
});

// POST /api/qonto/reset
router.post('/reset', (req, res, next) => {
  try {
    const db = getWorkspaceDb(req.user.workspaceId);
    db.run('DELETE FROM qonto_imports');
    db.run('DELETE FROM qonto_sync_log');
    db.run('DELETE FROM factures');
    db.run('DELETE FROM depenses');
    db.run('UPDATE qonto_config SET last_sync_at = NULL WHERE id = 1');
    db.run('UPDATE qonto_accounts SET last_sync_at = NULL');
    res.json({ ok: true, message: 'Toutes les transactions ont été supprimées. Le prochain sync Qonto récupérera tout depuis le début.' });
  } catch (e) { next(e); }
});

// ── Expense notes (notes de frais) ───────────────────────────────────────────

// GET /api/qonto/expense-notes — list all expense notes
router.get('/expense-notes', (req, res, next) => {
  try {
    const db = getWorkspaceDb(req.user.workspaceId);
    const notes = db.prepare(`
      SELECT n.*, a.name AS account_name
      FROM qonto_expense_notes n
      LEFT JOIN qonto_accounts a ON a.id = n.account_id
      ORDER BY n.created_at DESC
    `).all();
    res.json({ notes });
  } catch (e) { next(e); }
});

// POST /api/qonto/expense-notes — upload photo and send to Qonto
router.post('/expense-notes', upload.single('file'), async (req, res, next) => {
  try {
    const db = getWorkspaceDb(req.user.workspaceId);
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'Fichier image ou PDF requis' });

    if (!validateMagicBytes(file.buffer, file.mimetype)) {
      return res.status(400).json({ error: 'Le contenu du fichier ne correspond pas au type déclaré' });
    }

    const { description, montant_ttc, account_id } = req.body;
    const parsedAccountId = account_id ? parseInt(account_id) : null;
    const parsedMontant   = montant_ttc ? parseFloat(montant_ttc) : null;
    const safeFilename    = sanitizeFilename(file.originalname);

    const insertResult = db.prepare(`
      INSERT INTO qonto_expense_notes (original_name, description, montant_ttc, account_id, status)
      VALUES (?, ?, ?, ?, 'pending')
    `).run(safeFilename, description || null, parsedMontant, parsedAccountId);

    const noteId = insertResult.lastInsertRowid;
    db.run('UPDATE qonto_expense_notes SET status=? WHERE id=?', ['sending', noteId]);

    try {
      const account = parsedAccountId ? getAccount(db, parsedAccountId) : getConfig(db);
      if (!account?.organization_slug || !account?.secret_key) {
        throw new Error('Compte Qonto non configuré (clé API manquante)');
      }

      const data = await uploadAttachment(
        account.organization_slug,
        account.secret_key,
        file.buffer,
        safeFilename,
        file.mimetype
      );

      const attachmentId = data.attachment?.id ?? data.id ?? null;
      const now = new Date().toISOString();
      db.run(
        'UPDATE qonto_expense_notes SET status=?, qonto_attachment_id=?, sent_at=? WHERE id=?',
        ['sent', attachmentId, now, noteId]
      );

      res.json({ ok: true, id: noteId, attachment_id: attachmentId });
    } catch (uploadErr) {
      db.run(
        'UPDATE qonto_expense_notes SET status=?, error_message=? WHERE id=?',
        ['error', uploadErr.message, noteId]
      );
      res.json({ ok: false, id: noteId, error: uploadErr.message });
    }
  } catch (e) { next(e); }
});

// DELETE /api/qonto/expense-notes/:id
router.delete('/expense-notes/:id', (req, res, next) => {
  try {
    const db = getWorkspaceDb(req.user.workspaceId);
    db.run('DELETE FROM qonto_expense_notes WHERE id=?', [parseInt(req.params.id)]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
