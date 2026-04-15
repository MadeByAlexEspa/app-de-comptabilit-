const { Router } = require('express');
const { getWorkspaceDb } = require('../db/database');
const {
  getAllAccounts,
  getAccount,
  createAccount,
  updateAccount,
  deleteAccount,
  getBankAccounts,
  runSync,
} = require('../services/shineService');

const router = Router();

// ── Accounts CRUD ─────────────────────────────────────────────────────────────

// GET /api/shine/configs
router.get('/configs', (req, res, next) => {
  try {
    const db = getWorkspaceDb(req.user.workspaceId);
    res.json({ accounts: getAllAccounts(db) });
  } catch (e) { next(e); }
});

// POST /api/shine/configs
router.post('/configs', (req, res, next) => {
  try {
    const db = getWorkspaceDb(req.user.workspaceId);
    const { name, access_token, shine_account_id, iban, auto_sync_enabled } = req.body;
    if (!access_token) return res.status(400).json({ error: 'access_token est requis' });
    const id = createAccount(db, { name, access_token, shine_account_id, iban, auto_sync_enabled });
    res.json({ ok: true, id });
  } catch (e) { next(e); }
});

// GET /api/shine/configs/:id
router.get('/configs/:id', (req, res, next) => {
  try {
    const db = getWorkspaceDb(req.user.workspaceId);
    const acct = getAccount(db, Number(req.params.id));
    if (!acct) return res.status(404).json({ error: 'Compte introuvable' });
    const { access_token, ...safe } = acct;
    res.json({
      ...safe,
      access_token_masked: access_token
        ? '\u2022\u2022\u2022\u2022' + access_token.slice(-4)
        : null,
    });
  } catch (e) { next(e); }
});

// PUT /api/shine/configs/:id
router.put('/configs/:id', (req, res, next) => {
  try {
    const db = getWorkspaceDb(req.user.workspaceId);
    const id = Number(req.params.id);
    const { name, access_token, shine_account_id, iban, auto_sync_enabled } = req.body;
    updateAccount(db, id, { name, access_token, shine_account_id, iban, auto_sync_enabled });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// DELETE /api/shine/configs/:id
router.delete('/configs/:id', (req, res, next) => {
  try {
    const db = getWorkspaceDb(req.user.workspaceId);
    deleteAccount(db, Number(req.params.id));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// GET /api/shine/configs/:id/bank-accounts — fetch Shine bank accounts
router.get('/configs/:id/bank-accounts', async (req, res, next) => {
  try {
    const db = getWorkspaceDb(req.user.workspaceId);
    const acct = getAccount(db, Number(req.params.id));
    if (!acct?.access_token) return res.status(400).json({ error: 'Compte non configuré' });
    const data = await getBankAccounts(acct.access_token);
    const accounts = (data.accounts || data.items || []).map(a => ({
      id:       a.id,
      name:     a.name || a.label || 'Compte',
      iban:     a.iban,
      balance:  typeof a.balance === 'object' ? a.balance.amount / 100 : a.balance,
      currency: a.currency || 'EUR',
    }));
    res.json({ accounts });
  } catch (e) { next(e); }
});

// POST /api/shine/configs/:id/sync
router.post('/configs/:id/sync', async (req, res, next) => {
  try {
    const db = getWorkspaceDb(req.user.workspaceId);
    const acct = getAccount(db, Number(req.params.id));
    if (!acct?.access_token || !acct?.shine_account_id) {
      return res.status(400).json({ error: 'Compte non configuré (token et identifiant de compte requis)' });
    }
    const result = await runSync(db, acct);
    res.json(result);
  } catch (e) { next(e); }
});

// POST /api/shine/sync-all
router.post('/sync-all', async (req, res, next) => {
  try {
    const db = getWorkspaceDb(req.user.workspaceId);
    const accounts = getAllAccounts(db);
    const results = [];
    for (const acct of accounts) {
      if (!acct.shine_account_id) {
        results.push({ id: acct.id, name: acct.name, skipped: true, reason: 'Identifiant de compte manquant' });
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

// ── Sync log ──────────────────────────────────────────────────────────────────

// GET /api/shine/sync/log
router.get('/sync/log', (req, res, next) => {
  try {
    const db = getWorkspaceDb(req.user.workspaceId);
    const logs = db
      .prepare(`
        SELECT l.*, a.name AS account_name
        FROM shine_sync_log l
        LEFT JOIN shine_accounts a ON a.id = l.account_id
        ORDER BY l.synced_at DESC LIMIT 50
      `)
      .all();
    res.json({ logs });
  } catch (e) { next(e); }
});

// POST /api/shine/reset
router.post('/reset', (req, res, next) => {
  try {
    const db = getWorkspaceDb(req.user.workspaceId);
    db.run('DELETE FROM shine_imports');
    db.run('DELETE FROM shine_sync_log');
    db.run('UPDATE shine_accounts SET last_sync_at = NULL');
    res.json({ ok: true, message: 'Historique Shine réinitialisé.' });
  } catch (e) { next(e); }
});

module.exports = router;
