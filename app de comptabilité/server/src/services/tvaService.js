const db = require('../db/database');

function round2(n) {
  return Math.round(n * 100) / 100;
}

// Taux légaux de TVA en France (CGI art. 278 à 281 nonies)
const TAUX_LEGAUX = [20, 10, 5.5, 2.1, 0];

function ventilerParTaux(rows) {
  const par_taux = {};
  for (const t of TAUX_LEGAUX) {
    par_taux[t] = { base_ht: 0, tva: 0 };
  }

  for (const row of rows) {
    const t = row.taux_tva;
    if (!(t in par_taux)) par_taux[t] = { base_ht: 0, tva: 0 };
    par_taux[t].base_ht = round2(par_taux[t].base_ht + row.montant_ht);
    par_taux[t].tva     = round2(par_taux[t].tva     + row.montant_tva);
  }

  // Supprimer les taux à zéro pour alléger la réponse (sauf taux 0 s'il y a des lignes)
  const result = {};
  for (const [t, data] of Object.entries(par_taux)) {
    if (data.base_ht !== 0 || data.tva !== 0 || Number(t) === 0) {
      result[t] = { base_ht: data.base_ht, tva: data.tva };
    }
  }
  return result;
}

/**
 * Déclaration TVA mensuelle conforme PCG / CA3 (art. 287 CGI).
 *
 * Structure de retour calquée sur le formulaire CA3 :
 *   - collectée : TVA sur ventes ventilée par taux (lignes A1/A2/A3/A4)
 *   - déductible : TVA récupérable sur achats (ligne 20)
 *   - tva_a_reverser : solde net (ligne 28)
 *   - credit_tva : si solde négatif, montant du crédit (ligne 26)
 *
 * @param {string} mois - "YYYY-MM"
 */
function getTvaReport(mois) {
  const detailFactures = db
    .prepare(`SELECT * FROM factures WHERE strftime('%Y-%m', date) = ? ORDER BY date`)
    .all(mois);

  const detailDepenses = db
    .prepare(`SELECT * FROM depenses WHERE strftime('%Y-%m', date) = ? ORDER BY date`)
    .all(mois);

  const collecteParTaux   = ventilerParTaux(detailFactures);
  const deductibleParTaux = ventilerParTaux(detailDepenses);

  const totalCollectee  = round2(detailFactures.reduce((s, r) => s + r.montant_tva, 0));
  const totalDeductible = round2(detailDepenses.reduce((s, r) => s + r.montant_tva, 0));
  const solde           = round2(totalCollectee - totalDeductible);

  return {
    mois,
    collectee: {
      par_taux:      collecteParTaux,
      total_base_ht: round2(detailFactures.reduce((s, r) => s + r.montant_ht, 0)),
      total_tva:     totalCollectee,
    },
    deductible: {
      par_taux:      deductibleParTaux,
      total_base_ht: round2(detailDepenses.reduce((s, r) => s + r.montant_ht, 0)),
      total_tva:     totalDeductible,
    },
    tva_a_reverser: Math.max(0, solde),
    credit_tva:     Math.max(0, -solde),
    detail_factures: detailFactures,
    detail_depenses: detailDepenses,
  };
}

module.exports = { getTvaReport };
