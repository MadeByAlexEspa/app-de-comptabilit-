const { Router } = require('express');
const { getBilanReport } = require('../services/bilanService');

const router = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ── GET /api/bilan?date=YYYY-MM-DD ────────────────────────────────────────────
router.get('/', (req, res, next) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'Le paramètre "date" est requis (format YYYY-MM-DD)' });
    }

    if (!DATE_RE.test(date)) {
      return res.status(400).json({ error: 'Format de date invalide. Attendu : YYYY-MM-DD' });
    }

    const report = getBilanReport(date);
    res.json(report);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
