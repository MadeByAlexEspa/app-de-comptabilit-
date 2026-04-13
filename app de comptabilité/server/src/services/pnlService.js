const db = require('../db/database');

function round2(n) {
  return Math.round(n * 100) / 100;
}

// ── Classification PCG (Plan Comptable Général - ANC janvier 2025) ────────────
// Classe 7 : Produits
const PRODUITS_EXPLOITATION = new Set([
  '706 \u2013 Prestations de services',
  '701 \u2013 Ventes de produits finis',
  '707 \u2013 Ventes de marchandises',
  '708 \u2013 Produits des activités annexes',
  '74 \u2013 Subventions d\u2019exploitation',
  '75 \u2013 Autres produits de gestion courante',
]);
const PRODUITS_FINANCIERS = new Set([
  '76 \u2013 Produits financiers',
]);
const PRODUITS_EXCEPTIONNELS = new Set([
  '77 \u2013 Produits exceptionnels',
]);

// Classe 6 : Charges
const CHARGES_EXPLOITATION = new Set([
  '604 \u2013 Achats de prestations de services',
  '606 \u2013 Fournitures et petits équipements',
  '607 \u2013 Achats de marchandises',
  '611 \u2013 Sous-traitance générale',
  '613 \u2013 Locations & charges locatives',
  '615 \u2013 Entretien et réparations',
  '616 \u2013 Primes d\u2019assurance',
  '622 \u2013 Honoraires et rémunérations d\u2019intermédiaires',
  '623 \u2013 Publicité & communication',
  '624 \u2013 Transports de biens',
  '625 \u2013 Déplacements, missions & réceptions',
  '626 \u2013 Frais postaux & télécommunications',
  '627 \u2013 Services bancaires & assimilés',
  '641 \u2013 Rémunérations du personnel',
  '645 \u2013 Charges sociales & cotisations',
  '681 \u2013 Dotations aux amortissements d\u2019exploitation',
]);
const CHARGES_FINANCIERES = new Set([
  '661 \u2013 Charges d\u2019intérêts',
  '668 \u2013 Autres charges financières',
]);
const CHARGES_EXCEPTIONNELLES = new Set([
  '671 \u2013 Charges exceptionnelles sur opérations de gestion',
  '675 \u2013 Valeurs comptables des éléments cédés',
]);

function classify(categorie, exploitation, financier, exceptionnel) {
  if (exploitation.has(categorie)) return 'exploitation';
  if (financier.has(categorie))    return 'financier';
  if (exceptionnel.has(categorie)) return 'exceptionnel';
  // Fallback: unknown categories go to exploitation
  return 'exploitation';
}

function groupByCategorie(rows) {
  return rows.reduce((acc, row) => {
    acc[row.categorie] = round2((acc[row.categorie] || 0) + row.montant_ht);
    return acc;
  }, {});
}

function buildSection(rows, exploitationSet, financierSet, exceptionnelSet) {
  const exploitation = { par_categorie: {}, total: 0 };
  const financier    = { par_categorie: {}, total: 0 };
  const exceptionnel = { par_categorie: {}, total: 0 };

  for (const row of rows) {
    const bucket = classify(row.categorie, exploitationSet, financierSet, exceptionnelSet);
    const section = bucket === 'exploitation' ? exploitation
                  : bucket === 'financier'    ? financier
                  : exceptionnel;
    section.par_categorie[row.categorie] = round2(
      (section.par_categorie[row.categorie] || 0) + row.montant_ht
    );
  }

  exploitation.total = round2(Object.values(exploitation.par_categorie).reduce((s, v) => s + v, 0));
  financier.total    = round2(Object.values(financier.par_categorie).reduce((s, v) => s + v, 0));
  exceptionnel.total = round2(Object.values(exceptionnel.par_categorie).reduce((s, v) => s + v, 0));

  return { exploitation, financier, exceptionnel };
}

/**
 * Compte de résultat conforme PCG (article 823-1 du règlement ANC n°2014-03).
 * Ventilation en trois niveaux : exploitation / financier / exceptionnel.
 *
 * @param {string} debut - "YYYY-MM-DD"
 * @param {string} fin   - "YYYY-MM-DD"
 */
function getPnlReport(debut, fin) {
  const factureRows = db
    .prepare(`SELECT * FROM factures WHERE date >= ? AND date <= ? ORDER BY date`)
    .all(debut, fin);

  const depenseRows = db
    .prepare(`SELECT * FROM depenses WHERE date >= ? AND date <= ? ORDER BY date`)
    .all(debut, fin);

  const produits = buildSection(factureRows, PRODUITS_EXPLOITATION, PRODUITS_FINANCIERS, PRODUITS_EXCEPTIONNELS);
  const charges  = buildSection(depenseRows, CHARGES_EXPLOITATION, CHARGES_FINANCIERES, CHARGES_EXCEPTIONNELLES);

  const resultatExploitation = round2(produits.exploitation.total - charges.exploitation.total);
  const resultatFinancier    = round2(produits.financier.total    - charges.financier.total);
  const resultatCourant      = round2(resultatExploitation + resultatFinancier);
  const resultatExceptionnel = round2(produits.exceptionnel.total - charges.exceptionnel.total);
  const resultatAvantImpot   = round2(resultatCourant + resultatExceptionnel);

  return {
    periode: { debut, fin },
    produits: {
      exploitation: produits.exploitation,
      financier:    produits.financier,
      exceptionnel: produits.exceptionnel,
      total: round2(produits.exploitation.total + produits.financier.total + produits.exceptionnel.total),
    },
    charges: {
      exploitation: charges.exploitation,
      financier:    charges.financier,
      exceptionnel: charges.exceptionnel,
      total: round2(charges.exploitation.total + charges.financier.total + charges.exceptionnel.total),
    },
    resultat_exploitation:  resultatExploitation,
    resultat_financier:     resultatFinancier,
    resultat_courant:       resultatCourant,
    resultat_exceptionnel:  resultatExceptionnel,
    resultat_avant_impot:   resultatAvantImpot,
    // IS non calculé : dépend du régime fiscal (IS/IR) et des déficits reportables
    resultat_net:           resultatAvantImpot,
  };
}

module.exports = { getPnlReport };
