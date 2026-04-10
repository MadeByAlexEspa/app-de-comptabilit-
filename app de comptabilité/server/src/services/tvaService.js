const db = require('../db/database');

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Compute the TVA report for a given month.
 * @param {string} mois - "YYYY-MM"
 * @returns {{ mois, tva_collectee, tva_deductible, tva_a_reverser, detail_factures, detail_depenses }}
 */
function getTvaReport(mois) {
  const detailFactures = db
    .prepare(`SELECT * FROM factures WHERE strftime('%Y-%m', date) = ? ORDER BY date`)
    .all(mois);

  const detailDepenses = db
    .prepare(`SELECT * FROM depenses WHERE strftime('%Y-%m', date) = ? ORDER BY date`)
    .all(mois);

  const tvaCollectee  = round2(detailFactures.reduce((s, r) => s + r.montant_tva, 0));
  const tvaDeductible = round2(detailDepenses.reduce((s, r) => s + r.montant_tva, 0));
  const tvaAReverser  = round2(tvaCollectee - tvaDeductible);

  return {
    mois,
    tva_collectee:  tvaCollectee,
    tva_deductible: tvaDeductible,
    tva_a_reverser: tvaAReverser,
    detail_factures: detailFactures,
    detail_depenses: detailDepenses,
  };
}

module.exports = { getTvaReport };
