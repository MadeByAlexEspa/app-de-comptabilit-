const { Router } = require('express');
const { getTvaReport } = require('../services/tvaService');

const router = Router();

// ── GET /api/tva?mois=YYYY-MM ─────────────────────────────────────────────────
router.get('/', (req, res, next) => {
  try {
    const { mois } = req.query;

    if (!mois) {
      return res.status(400).json({ error: 'Le paramètre "mois" est requis (format YYYY-MM)' });
    }

    if (!/^\d{4}-\d{2}$/.test(mois)) {
      return res.status(400).json({ error: 'Format du paramètre "mois" invalide. Attendu : YYYY-MM' });
    }

    const report = getTvaReport(mois);
    res.json(report);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
