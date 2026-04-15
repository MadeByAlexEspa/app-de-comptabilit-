const { Router } = require('express');
const { getBilanReport } = require('../services/bilanService');
const { getWorkspaceDb } = require('../db/database');

const router = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ── GET /api/bilan?fin=YYYY-MM-DD[&debut=YYYY-MM-DD] ─────────────────────────
// Accepte aussi "date" pour la rétrocompatibilité.
router.get('/', (req, res, next) => {
  try {
    const db = getWorkspaceDb(req.user.workspaceId);
    const fin   = req.query.fin   || req.query.date;
    const debut = req.query.debut || null;

    if (!fin) {
      return res.status(400).json({ error: 'Le paramètre "fin" (ou "date") est requis (format YYYY-MM-DD)' });
    }
    if (!DATE_RE.test(fin)) {
      return res.status(400).json({ error: 'Format de date invalide pour "fin". Attendu : YYYY-MM-DD' });
    }
    if (debut && !DATE_RE.test(debut)) {
      return res.status(400).json({ error: 'Format de date invalide pour "debut". Attendu : YYYY-MM-DD' });
    }

    const report = getBilanReport(db, fin, debut);
    res.json(report);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
