const db = require('../db/database');

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Compute the simplified balance sheet at a given date.
 * @param {string} date - "YYYY-MM-DD"
 * @returns {Object}
 */
function getBilanReport(date) {
  // Créances clients : factures en_attente (TTC) up to `date`
  const creancesRow = db
    .prepare(`
      SELECT COALESCE(SUM(montant_ttc), 0) AS total
      FROM factures
      WHERE statut = 'en_attente' AND date <= ?
    `)
    .get(date);

  // Trésorerie : factures payées TTC minus dépenses payées TTC up to `date`
  const facturesPayeesRow = db
    .prepare(`
      SELECT COALESCE(SUM(montant_ttc), 0) AS total
      FROM factures
      WHERE statut = 'payee' AND date <= ?
    `)
    .get(date);

  const depensesPayeesRow = db
    .prepare(`
      SELECT COALESCE(SUM(montant_ttc), 0) AS total
      FROM depenses
      WHERE statut = 'payee' AND date <= ?
    `)
    .get(date);

  // Dettes fournisseurs : dépenses en_attente (TTC) up to `date`
  const dettesRow = db
    .prepare(`
      SELECT COALESCE(SUM(montant_ttc), 0) AS total
      FROM depenses
      WHERE statut = 'en_attente' AND date <= ?
    `)
    .get(date);

  // TVA à payer : cumulative TVA à reverser (collectée - déductible) up to `date`
  // We compute month by month up to the given date by aggregating all records
  const tvaCollecteeRow = db
    .prepare(`
      SELECT COALESCE(SUM(montant_tva), 0) AS total
      FROM factures
      WHERE date <= ?
    `)
    .get(date);

  const tvaDeductibleRow = db
    .prepare(`
      SELECT COALESCE(SUM(montant_tva), 0) AS total
      FROM depenses
      WHERE date <= ?
    `)
    .get(date);

  const creancesClients   = round2(creancesRow.total);
  const tresorerie        = round2(facturesPayeesRow.total - depensesPayeesRow.total);
  const totalActif        = round2(creancesClients + tresorerie);

  const dettesFournisseurs = round2(dettesRow.total);
  const tvaAPayer          = round2(tvaCollecteeRow.total - tvaDeductibleRow.total);
  // Capital = actif - dettes courantes - TVA à payer
  const capital            = round2(totalActif - dettesFournisseurs - tvaAPayer);
  const totalPassif        = round2(dettesFournisseurs + tvaAPayer + capital);

  return {
    date,
    actif: {
      creances_clients: creancesClients,
      tresorerie,
      total: totalActif,
    },
    passif: {
      dettes_fournisseurs: dettesFournisseurs,
      tva_a_payer: tvaAPayer,
      capital,
      total: totalPassif,
    },
  };
}

module.exports = { getBilanReport };
