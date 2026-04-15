const db = require('../db/database');

function round2(n) {
  return Math.round(n * 100) / 100;
}

// ── Catégories P&L (Classe 6 & 7 uniquement — hors immobilisations & financement) ──

// PRODUITS ─────────────────────────────────────────────────────────────────────

const CAT_CA = new Set([
  '706 \u2013 Prestations de services',
  '701 \u2013 Ventes de produits finis',
  '707 \u2013 Ventes de marchandises',
  '708 \u2013 Produits des activit\u00e9s annexes',
]);

// 709 : rabais, remises, ristournes accordés (débit sur vente → réduit le CA)
// Enregistrés en dépenses dans l'app ; soustraits du CA brut pour obtenir le CA net.
const CAT_AVOIRS_CLIENTS = new Set([
  '709 \u2013 Avoirs & remboursements clients',
]);

const CAT_AUTRES_PRODUITS_EXPL = new Set([
  '74 \u2013 Subventions d\u2019exploitation',
  '75 \u2013 Autres produits de gestion courante',
  // 409 : avoir fournisseur reçu — enregistré en entrée, réduit le coût d'achat net
  '409 \u2013 Avoirs fournisseurs re\u00e7us',
]);

const CAT_PRODUITS_FINANCIERS = new Set([
  '76 \u2013 Produits financiers',
]);

const CAT_PRODUITS_EXCEPTIONNELS = new Set([
  '77 \u2013 Produits exceptionnels',
]);

// CHARGES ──────────────────────────────────────────────────────────────────────

const CAT_ACHATS = new Set([
  '604 \u2013 Achats de prestations de services',
  '606 \u2013 Fournitures et petits \u00e9quipements',
  '607 \u2013 Achats de marchandises',
]);

const CAT_CHARGES_EXTERNES = new Set([
  '611 \u2013 Sous-traitance g\u00e9n\u00e9rale',
  '613 \u2013 Locations & charges locatives',
  '615 \u2013 Entretien et r\u00e9parations',
  '616 \u2013 Primes d\u2019assurance',
  '618 \u2013 Abonnements & frais informatiques',
  '622 \u2013 Honoraires et r\u00e9mun\u00e9rations d\u2019interm\u00e9diaires',
  '623 \u2013 Publicit\u00e9 & communication',
  '624 \u2013 Transports de biens',
  '625 \u2013 D\u00e9placements, missions & r\u00e9ceptions',
  '626 \u2013 Frais postaux & t\u00e9l\u00e9communications',
  '627 \u2013 Services bancaires & assimil\u00e9s',
]);

const CAT_IMPOTS_TAXES = new Set([
  '631 \u2013 Imp\u00f4ts, taxes et versements assimil\u00e9s sur r\u00e9mun\u00e9rations',
  '635 \u2013 Autres imp\u00f4ts, taxes et versements assimil\u00e9s',
]);

const CAT_CHARGES_PERSONNEL = new Set([
  '641 \u2013 R\u00e9mun\u00e9rations du personnel',
  '645 \u2013 Charges sociales & cotisations',
  // 421 : remboursement de notes de frais (charge de personnel nette de TVA)
  '421 \u2013 Notes de frais du personnel',
]);

const CAT_DOTATIONS = new Set([
  '681 \u2013 Dotations aux amortissements d\u2019exploitation',
]);

const CAT_CHARGES_FINANCIERES = new Set([
  '661 \u2013 Charges d\u2019int\u00e9r\u00eats',
  '668 \u2013 Autres charges financi\u00e8res',
]);

const CAT_CHARGES_EXCEPTIONNELLES = new Set([
  '671 \u2013 Charges exceptionnelles sur op\u00e9rations de gestion',
  '675 \u2013 Valeurs comptables des \u00e9l\u00e9ments c\u00e9d\u00e9s',
]);

const CAT_IS = new Set([
  '695 \u2013 Imp\u00f4t sur les b\u00e9n\u00e9fices (IS)',
]);

// All sets for quick "is this a P&L item?" check
const ALL_PRODUITS_PNL = new Set([
  ...CAT_CA, ...CAT_AUTRES_PRODUITS_EXPL, ...CAT_PRODUITS_FINANCIERS, ...CAT_PRODUITS_EXCEPTIONNELS,
]);
const ALL_CHARGES_PNL = new Set([
  ...CAT_ACHATS, ...CAT_CHARGES_EXTERNES, ...CAT_IMPOTS_TAXES, ...CAT_CHARGES_PERSONNEL,
  ...CAT_DOTATIONS, ...CAT_CHARGES_FINANCIERES, ...CAT_CHARGES_EXCEPTIONNELLES, ...CAT_IS,
  ...CAT_AVOIRS_CLIENTS,
]);

// ── Helpers ───────────────────────────────────────────────────────────────────

function accumulate(rows, catSet, acc) {
  for (const row of rows) {
    if (catSet.has(row.categorie)) {
      acc[row.categorie] = round2((acc[row.categorie] || 0) + row.montant_ht);
    }
  }
}

function sumObj(obj) {
  return round2(Object.values(obj).reduce((s, v) => s + v, 0));
}

function buildBucket(rows, catSet) {
  const par_categorie = {};
  accumulate(rows, catSet, par_categorie);
  return { par_categorie, total: sumObj(par_categorie) };
}

/**
 * Compte de résultat avec Soldes Intermédiaires de Gestion (SIG).
 * Conforme PCG — règlement ANC n°2014-03, art. 823-1.
 * Les mouvements de capitaux (Cl. 1), d'immobilisations (Cl. 2)
 * et les virements internes (Cl. 5) sont exclus.
 *
 * @param {string} debut - "YYYY-MM-DD"
 * @param {string} fin   - "YYYY-MM-DD"
 */
function getPnlReport(debut, fin) {
  const factures = db.prepare('SELECT * FROM factures WHERE date >= ? AND date <= ?').all(debut, fin);
  const depenses = db.prepare('SELECT * FROM depenses WHERE date >= ? AND date <= ?').all(debut, fin);

  // ── Produits ───────────────────────────────────────────────────────────────
  const ca                     = buildBucket(factures, CAT_CA);
  const avoirs_clients         = buildBucket(depenses, CAT_AVOIRS_CLIENTS);
  const autres_produits_expl   = buildBucket(factures, CAT_AUTRES_PRODUITS_EXPL);
  const produits_financiers    = buildBucket(factures, CAT_PRODUITS_FINANCIERS);
  const produits_exceptionnels = buildBucket(factures, CAT_PRODUITS_EXCEPTIONNELS);

  // CA net = CA brut - avoirs / remboursements accordés aux clients (709)
  const ca_net = round2(ca.total - avoirs_clients.total);

  const total_produits_expl = round2(ca_net + autres_produits_expl.total);

  // ── Charges ────────────────────────────────────────────────────────────────
  const achats               = buildBucket(depenses, CAT_ACHATS);
  const charges_externes     = buildBucket(depenses, CAT_CHARGES_EXTERNES);
  const impots_taxes         = buildBucket(depenses, CAT_IMPOTS_TAXES);
  const charges_personnel    = buildBucket(depenses, CAT_CHARGES_PERSONNEL);
  const dotations            = buildBucket(depenses, CAT_DOTATIONS);
  const charges_financieres  = buildBucket(depenses, CAT_CHARGES_FINANCIERES);
  const charges_exceptionnelles = buildBucket(depenses, CAT_CHARGES_EXCEPTIONNELLES);
  const impot_societes       = buildBucket(depenses, CAT_IS);

  const total_charges_expl = round2(
    achats.total + charges_externes.total + impots_taxes.total +
    charges_personnel.total + dotations.total
  );

  // ── SIG ────────────────────────────────────────────────────────────────────
  // Marge brute commerciale (si activité de négoce)
  const marge_brute = round2(
    (ca.par_categorie['707 \u2013 Ventes de marchandises'] || 0) -
    (achats.par_categorie['607 \u2013 Achats de marchandises'] || 0)
  );

  // Valeur ajoutée = CA net + autres produits expl - achats consommés - charges externes
  const valeur_ajoutee = round2(
    ca_net + autres_produits_expl.total - achats.total - charges_externes.total
  );

  // EBE = VA - impôts et taxes - charges de personnel
  const ebe = round2(valeur_ajoutee - impots_taxes.total - charges_personnel.total);

  // Résultat d'exploitation = EBE - dotations
  const resultat_exploitation = round2(ebe - dotations.total);

  // Résultat financier
  const resultat_financier = round2(produits_financiers.total - charges_financieres.total);

  // Résultat courant
  const resultat_courant = round2(resultat_exploitation + resultat_financier);

  // Résultat exceptionnel
  const resultat_exceptionnel = round2(produits_exceptionnels.total - charges_exceptionnelles.total);

  // Résultat avant IS
  const resultat_avant_impot = round2(resultat_courant + resultat_exceptionnel);

  // Résultat net
  const resultat_net = round2(resultat_avant_impot - impot_societes.total);

  return {
    periode: { debut, fin },

    // Produits
    ca,
    avoirs_clients,
    ca_net,
    autres_produits_expl,
    produits_financiers,
    produits_exceptionnels,
    total_produits_expl,

    // Charges
    achats,
    charges_externes,
    impots_taxes,
    charges_personnel,
    dotations,
    charges_financieres,
    charges_exceptionnelles,
    impot_societes,
    total_charges_expl,

    // SIG
    marge_brute,
    valeur_ajoutee,
    ebe,
    resultat_exploitation,
    resultat_financier,
    resultat_courant,
    resultat_exceptionnel,
    resultat_avant_impot,
    resultat_net,
  };
}

module.exports = { getPnlReport };
