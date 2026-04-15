const { Router } = require('express');
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
} = require('../services/qontoService');

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

module.exports = router;
