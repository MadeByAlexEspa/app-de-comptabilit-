const { Router } = require('express');
const { getWorkspaceDb } = require('../db/database');

const router = Router();

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Return a "YYYY-MM-DD" string for today.
 */
function today() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Return a "YYYY-MM" string for the current month.
 */
function currentMonth() {
  return today().slice(0, 7);
}

/**
 * Return "YYYY-01-01" for the current year.
 */
function startOfYear() {
  return `${today().slice(0, 4)}-01-01`;
}

// ── GET /api/dashboard ────────────────────────────────────────────────────────
router.get('/', (req, res, next) => {
  try {
    const db = getWorkspaceDb(req.user.workspaceId);
    const mois     = currentMonth();  // e.g. "2026-04"
    const todayStr = today();         // e.g. "2026-04-09"
    const janFirst = startOfYear();   // e.g. "2026-01-01"

    // CA HT du mois courant (toutes factures)
    const caHtMoisRow = db
      .prepare(`
        SELECT COALESCE(SUM(montant_ht), 0) AS total
        FROM factures
        WHERE strftime('%Y-%m', date) = ?
      `)
      .get(mois);

    // Charges HT du mois courant
    const chargesHtMoisRow = db
      .prepare(`
        SELECT COALESCE(SUM(montant_ht), 0) AS total
        FROM depenses
        WHERE strftime('%Y-%m', date) = ?
      `)
      .get(mois);

    // TVA collectée du mois
    const tvaCollecteeMoisRow = db
      .prepare(`
        SELECT COALESCE(SUM(montant_tva), 0) AS total
        FROM factures
        WHERE strftime('%Y-%m', date) = ?
      `)
      .get(mois);

    // TVA déductible du mois
    const tvaDeductibleMoisRow = db
      .prepare(`
        SELECT COALESCE(SUM(montant_tva), 0) AS total
        FROM depenses
        WHERE strftime('%Y-%m', date) = ?
      `)
      .get(mois);

    // Résultat net YTD (Jan 1 → today)
    const revenusYtdRow = db
      .prepare(`
        SELECT COALESCE(SUM(montant_ht), 0) AS total
        FROM factures
        WHERE date >= ? AND date <= ?
      `)
      .get(janFirst, todayStr);

    const chargesYtdRow = db
      .prepare(`
        SELECT COALESCE(SUM(montant_ht), 0) AS total
        FROM depenses
        WHERE date >= ? AND date <= ?
      `)
      .get(janFirst, todayStr);

    // Factures en attente (count)
    const facturesEnAttenteRow = db
      .prepare(`SELECT COUNT(*) AS cnt FROM factures WHERE statut = 'en_attente'`)
      .get();

    // Dépenses en attente (count)
    const depensesEnAttenteRow = db
      .prepare(`SELECT COUNT(*) AS cnt FROM depenses WHERE statut = 'en_attente'`)
      .get();

    const tvaDueMois = round2(tvaCollecteeMoisRow.total - tvaDeductibleMoisRow.total);

    res.json({
      ca_ht_mois:           round2(caHtMoisRow.total),
      charges_ht_mois:      round2(chargesHtMoisRow.total),
      tva_due_mois:         tvaDueMois,
      resultat_ytd:         round2(revenusYtdRow.total - chargesYtdRow.total),
      factures_en_attente:  facturesEnAttenteRow.cnt,
      depenses_en_attente:  depensesEnAttenteRow.cnt,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
