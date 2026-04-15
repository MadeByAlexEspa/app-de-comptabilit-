const { Router } = require('express');
const { getTvaReport, getTvaReportRange } = require('../services/tvaService');

const router = Router();

const DATE_RE  = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

// ── GET /api/tva ──────────────────────────────────────────────────────────────
// Accepte :
//   ?mois=YYYY-MM              (rétrocompatibilité)
//   ?debut=YYYY-MM-DD&fin=YYYY-MM-DD
router.get('/', (req, res, next) => {
  try {
    const { mois, debut, fin } = req.query;

    if (debut || fin) {
      if (!debut || !fin)
        return res.status(400).json({ error: '"debut" et "fin" sont tous les deux requis (format YYYY-MM-DD)' });
      if (!DATE_RE.test(debut))
        return res.status(400).json({ error: 'Format invalide pour "debut". Attendu : YYYY-MM-DD' });
      if (!DATE_RE.test(fin))
        return res.status(400).json({ error: 'Format invalide pour "fin". Attendu : YYYY-MM-DD' });

      return res.json(getTvaReportRange(debut, fin));
    }

    if (!mois)
      return res.status(400).json({ error: 'Paramètre "debut"+"fin" ou "mois" requis' });
    if (!MONTH_RE.test(mois))
      return res.status(400).json({ error: 'Format du paramètre "mois" invalide. Attendu : YYYY-MM' });

    res.json(getTvaReport(mois));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
