const { Router } = require('express');
const { getPnlReport } = require('../services/pnlService');
const { getWorkspaceDb } = require('../db/database');

const router = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ── GET /api/pnl?debut=YYYY-MM-DD&fin=YYYY-MM-DD ──────────────────────────────
router.get('/', (req, res, next) => {
  try {
    const db = getWorkspaceDb(req.user.workspaceId);
    const { debut, fin } = req.query;

    if (!debut || !fin) {
      return res.status(400).json({
        error: 'Les paramètres "debut" et "fin" sont requis (format YYYY-MM-DD)',
      });
    }

    if (!DATE_RE.test(debut) || !DATE_RE.test(fin)) {
      return res.status(400).json({
        error: 'Format de date invalide. Attendu : YYYY-MM-DD',
      });
    }

    if (debut > fin) {
      return res.status(400).json({
        error: '"debut" doit être antérieur ou égal à "fin"',
      });
    }

    const report = getPnlReport(db, debut, fin);
    res.json(report);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
