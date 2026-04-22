const { Router } = require('express');
const { PROVIDERS, getConfig, saveConfig, deleteConfig, chat } = require('../services/aiService');
const { getWorkspaceDb } = require('../db/database');

const router = Router();

// GET /api/ai/config
router.get('/config', (req, res, next) => {
  try {
    const db = getWorkspaceDb(req.user.workspaceId);
    const config = getConfig(db);
    if (!config) return res.json({ configured: false, providers: PROVIDERS });
    const { api_key, ...safe } = config;
    res.json({
      ...safe,
      configured:    !!api_key,
      api_key_masked: api_key ? '\u2022\u2022\u2022\u2022' + api_key.slice(-4) : null,
      providers:     PROVIDERS,
    });
  } catch (e) { next(e); }
});

// POST /api/ai/config
router.post('/config', (req, res, next) => {
  try {
    const db = getWorkspaceDb(req.user.workspaceId);
    const { provider, api_key, model, system_prompt } = req.body;
    if (!provider || !api_key) return res.status(400).json({ error: 'provider et api_key sont requis' });
    saveConfig(db, { provider, api_key, model, system_prompt });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// DELETE /api/ai/config
router.delete('/config', (req, res, next) => {
  try {
    const db = getWorkspaceDb(req.user.workspaceId);
    deleteConfig(db);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// POST /api/ai/chat
router.post('/chat', async (req, res, next) => {
  try {
    const db = getWorkspaceDb(req.user.workspaceId);
    const { messages } = req.body;
    if (!Array.isArray(messages) || !messages.length) {
      return res.status(400).json({ error: 'messages est requis' });
    }

    const ALLOWED_ROLES = new Set(['user', 'assistant']);
    const MAX_CONTENT = 10_000;
    for (const msg of messages) {
      if (!ALLOWED_ROLES.has(msg.role)) {
        return res.status(400).json({ error: `Rôle invalide : ${msg.role}` });
      }
      if (typeof msg.content !== 'string' || msg.content.length > MAX_CONTENT) {
        return res.status(400).json({ error: 'Contenu de message invalide ou trop long' });
      }
    }

    const reply = await chat(db, messages, req.user.workspaceId);
    res.json({ reply });
  } catch (e) { next(e); }
});

module.exports = router;
