const { Router } = require('express');
const db = require('../db/database');
const {
  getConfig,
  getOrganization,
  runSync,
  PCG_PRODUITS,
  PCG_CHARGES,
  DEFAULT_MAPPINGS,
} = require('../services/qontoService');

const router = Router();

// ── GET /api/qonto/config ─────────────────────────────────────────────────────
router.get('/config', (req, res, next) => {
  try {
    const config = getConfig();
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

// ── POST /api/qonto/config ────────────────────────────────────────────────────
router.post('/config', (req, res, next) => {
  try {
    const { organization_slug, secret_key, iban, auto_sync_enabled } = req.body;
    if (!organization_slug || !secret_key) {
      return res.status(400).json({ error: 'organization_slug et secret_key sont requis' });
    }

    const existing = getConfig();
    const autoSync = auto_sync_enabled ? 1 : 0;

    if (existing) {
      // Preserve existing secret_key if placeholder submitted
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
      // Seed default mappings on first configuration
      for (const m of DEFAULT_MAPPINGS) {
        db.run(
          'INSERT OR IGNORE INTO qonto_category_mapping (qonto_operation_type, side, pcg_category, default_taux_tva) VALUES (?,?,?,?)',
          [m.qonto_operation_type, m.side, m.pcg_category, m.default_taux_tva]
        );
      }
    }

    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── GET /api/qonto/accounts — récupère les comptes bancaires Qonto ────────────
router.get('/accounts', async (req, res, next) => {
  try {
    const config = getConfig();
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

// ── GET /api/qonto/mappings ───────────────────────────────────────────────────
router.get('/mappings', (req, res, next) => {
  try {
    const mappings = db
      .prepare('SELECT * FROM qonto_category_mapping ORDER BY side DESC, qonto_operation_type')
      .all();
    res.json({ mappings, pcg_produits: PCG_PRODUITS, pcg_charges: PCG_CHARGES });
  } catch (e) { next(e); }
});

// ── PUT /api/qonto/mappings ───────────────────────────────────────────────────
router.put('/mappings', (req, res, next) => {
  try {
    const { mappings } = req.body;
    if (!Array.isArray(mappings)) {
      return res.status(400).json({ error: 'mappings doit être un tableau' });
    }
    for (const m of mappings) {
      db.run(
        `INSERT INTO qonto_category_mapping (qonto_operation_type, side, pcg_category, default_taux_tva)
         VALUES (?,?,?,?)
         ON CONFLICT(qonto_operation_type, side) DO UPDATE SET
           pcg_category = excluded.pcg_category,
           default_taux_tva = excluded.default_taux_tva`,
        [m.qonto_operation_type, m.side, m.pcg_category, m.default_taux_tva ?? 20]
      );
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── POST /api/qonto/sync — synchronisation manuelle ──────────────────────────
router.post('/sync', async (req, res, next) => {
  try {
    const config = getConfig();
    if (!config?.organization_slug || !config?.secret_key || !config?.iban) {
      return res.status(400).json({ error: 'Qonto non configuré (slug, clé API et IBAN requis)' });
    }
    const result = await runSync(config);
    res.json(result);
  } catch (e) { next(e); }
});

// ── GET /api/qonto/sync/log ───────────────────────────────────────────────────
router.get('/sync/log', (req, res, next) => {
  try {
    const logs = db
      .prepare('SELECT * FROM qonto_sync_log ORDER BY synced_at DESC LIMIT 20')
      .all();
    res.json({ logs });
  } catch (e) { next(e); }
});

module.exports = router;
