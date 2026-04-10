const db = require('../db/database');

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Group an array of rows by the `categorie` field, summing `montant_ht`.
 * @param {Array} rows
 * @returns {Object} e.g. { 'Prestations de services': 4500, ... }
 */
function groupByCategorie(rows) {
  return rows.reduce((acc, row) => {
    acc[row.categorie] = round2((acc[row.categorie] || 0) + row.montant_ht);
    return acc;
  }, {});
}

/**
 * Compute the Profit & Loss statement for a date range.
 * @param {string} debut - "YYYY-MM-DD"
 * @param {string} fin   - "YYYY-MM-DD"
 * @returns {Object}
 */
function getPnlReport(debut, fin) {
  const factureRows = db
    .prepare(`SELECT * FROM factures WHERE date >= ? AND date <= ? ORDER BY date`)
    .all(debut, fin);

  const depenseRows = db
    .prepare(`SELECT * FROM depenses WHERE date >= ? AND date <= ? ORDER BY date`)
    .all(debut, fin);

  const totalRevenusHt  = round2(factureRows.reduce((s, r) => s + r.montant_ht, 0));
  const totalChargesHt  = round2(depenseRows.reduce((s, r) => s + r.montant_ht, 0));
  const resultatBrut    = round2(totalRevenusHt - totalChargesHt);
  // For a simplified P&L we treat brut = net (no further tax computation)
  const resultatNet     = resultatBrut;

  return {
    periode: { debut, fin },
    revenus: {
      total_ht: totalRevenusHt,
      par_categorie: groupByCategorie(factureRows),
    },
    charges: {
      total_ht: totalChargesHt,
      par_categorie: groupByCategorie(depenseRows),
    },
    resultat_brut: resultatBrut,
    resultat_net:  resultatNet,
  };
}

module.exports = { getPnlReport };
