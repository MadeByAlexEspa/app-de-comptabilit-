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

  const result = {};
  for (const [t, data] of Object.entries(par_taux)) {
    if (data.base_ht !== 0 || data.tva !== 0 || Number(t) === 0) {
      result[t] = { base_ht: data.base_ht, tva: data.tva };
    }
  }
  return result;
}

/**
 * Déclaration TVA sur une plage de dates (conforme CA3 — art. 287 CGI).
 *
 * @param {object} db    - workspace DB instance
 * @param {string} debut - "YYYY-MM-DD"
 * @param {string} fin   - "YYYY-MM-DD"
 */
function getTvaReportRange(db, debut, fin) {
  const detailFactures = db
    .prepare(`SELECT * FROM factures WHERE date >= ? AND date <= ? ORDER BY date`)
    .all(debut, fin);

  const detailDepenses = db
    .prepare(`SELECT * FROM depenses WHERE date >= ? AND date <= ? ORDER BY date`)
    .all(debut, fin);

  const collecteParTaux   = ventilerParTaux(detailFactures);
  const deductibleParTaux = ventilerParTaux(detailDepenses);

  const totalCollectee  = round2(detailFactures.reduce((s, r) => s + r.montant_tva, 0));
  const totalDeductible = round2(detailDepenses.reduce((s, r) => s + r.montant_tva, 0));
  const solde           = round2(totalCollectee - totalDeductible);

  return {
    debut,
    fin,
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

/**
 * Rétrocompatibilité : accepte un mois "YYYY-MM".
 *
 * @param {object} db   - workspace DB instance
 * @param {string} mois - "YYYY-MM"
 */
function getTvaReport(db, mois) {
  const [y, m] = mois.split('-');
  const debut  = `${y}-${m}-01`;
  const lastDay = new Date(Number(y), Number(m), 0).getDate();
  const fin    = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
  return { ...getTvaReportRange(db, debut, fin), mois };
}

module.exports = { getTvaReport, getTvaReportRange };
