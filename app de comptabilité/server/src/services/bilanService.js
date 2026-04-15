function round2(n) {
  return Math.round(n * 100) / 100;
}

// ── Catégories Bilan (hors P&L) ───────────────────────────────────────────────

// Immobilisations incorporelles (Classe 2)
const CAT_IMMO_INCORP = [
  '201 \u2013 Frais d\u2019\u00e9tablissement',
  '2051 \u2013 Concessions, brevets, licences, marques',
  '2052 \u2013 Logiciels (d\u00e9veloppement interne)',
];
// Immobilisations corporelles (Classe 2)
const CAT_IMMO_CORP = [
  '211 \u2013 Terrains',
  '213 \u2013 Constructions',
  '215 \u2013 Mat\u00e9riel et outillage industriel',
  '218 \u2013 Autres immobilisations corporelles',
];

// Financement entrées (Classe 1)
const CAT_CAPITAL_SOCIAL   = '101 \u2013 Capital social (apport)';
const CAT_APPORT_EXPL      = '108 \u2013 Apport de l\u2019exploitant';
const CAT_EMPRUNT_RECU     = '164 \u2013 Emprunts bancaires re\u00e7us';
const CAT_CC_ASSOC_RECU    = '455 \u2013 Avances en compte courant associ\u00e9';

// Financement sorties (Classe 1)
const CAT_PRELEV_EXPL      = '108 \u2013 Pr\u00e9l\u00e8vements de l\u2019exploitant';
const CAT_EMPRUNT_REMBOURS = '164 \u2013 Remboursement d\u2019emprunt';
const CAT_CC_ASSOC_REMBOURS = '455 \u2013 Remboursement compte courant associ\u00e9';

// Catégories P&L (pour le calcul du résultat d'exercice, hors BS)
const CAT_PNL_PRODUITS = [
  // Chiffre d'affaires (Classe 7)
  '706 \u2013 Prestations de services',
  '701 \u2013 Ventes de produits finis',
  '707 \u2013 Ventes de marchandises',
  '708 \u2013 Produits des activit\u00e9s annexes',
  // Autres produits d'exploitation
  '74 \u2013 Subventions d\u2019exploitation',
  '75 \u2013 Autres produits de gestion courante',
  // 409 : avoir fournisseur reçu (réduit le coût net des achats)
  '409 \u2013 Avoirs fournisseurs re\u00e7us',
  // Produits financiers & exceptionnels
  '76 \u2013 Produits financiers',
  '77 \u2013 Produits exceptionnels',
];
const CAT_PNL_CHARGES = [
  // Achats consommés (Classe 6)
  '604 \u2013 Achats de prestations de services',
  '606 \u2013 Fournitures et petits \u00e9quipements',
  '607 \u2013 Achats de marchandises',
  // Charges externes (Classe 6)
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
  // Impôts et taxes (Classe 6)
  '631 \u2013 Imp\u00f4ts, taxes et versements assimil\u00e9s sur r\u00e9mun\u00e9rations',
  '635 \u2013 Autres imp\u00f4ts, taxes et versements assimil\u00e9s',
  // Charges de personnel (Classe 6)
  '641 \u2013 R\u00e9mun\u00e9rations du personnel',
  '645 \u2013 Charges sociales & cotisations',
  '421 \u2013 Notes de frais du personnel',
  // Dotations aux amortissements (Classe 6)
  '681 \u2013 Dotations aux amortissements d\u2019exploitation',
  // Charges financières & exceptionnelles
  '661 \u2013 Charges d\u2019int\u00e9r\u00eats',
  '668 \u2013 Autres charges financi\u00e8res',
  '671 \u2013 Charges exceptionnelles sur op\u00e9rations de gestion',
  '675 \u2013 Valeurs comptables des \u00e9l\u00e9ments c\u00e9d\u00e9s',
  // 709 : avoirs / remboursements clients (réduit le CA net)
  '709 \u2013 Avoirs & remboursements clients',
  // Impôt sur les bénéfices
  '695 \u2013 Imp\u00f4t sur les b\u00e9n\u00e9fices (IS)',
];

function sumCat(db, table, categories, dateCond, dateParams, extraCond = '') {
  const rows = db
    .prepare(`SELECT categorie, COALESCE(SUM(montant_ht), 0) AS total
              FROM ${table}
              WHERE (${categories.map(() => 'categorie = ?').join(' OR ')})
              AND ${dateCond} ${extraCond}
              GROUP BY categorie`)
    .all(...categories, ...dateParams);
  const par_categorie = {};
  let total = 0;
  for (const r of rows) {
    par_categorie[r.categorie] = round2(r.total);
    total = round2(total + r.total);
  }
  return { par_categorie, total };
}

function sumCatSingle(db, table, categorie, dateCond, dateParams) {
  const row = db
    .prepare(`SELECT COALESCE(SUM(montant_ht), 0) AS total FROM ${table} WHERE categorie = ? AND ${dateCond}`)
    .get(categorie, ...dateParams);
  return round2(row.total);
}

/**
 * Bilan complet conforme PCG (règlement ANC n°2014-03, art. 821-1).
 *
 * @param {object} db    - workspace DB instance
 * @param {string} date  - date d'arrêté "YYYY-MM-DD"
 * @param {string} debut - début de l'exercice "YYYY-MM-DD" (défaut : 1er janvier de l'année de date)
 */
function getBilanReport(db, date, debut) {
  const debutExercice = debut || `${date.slice(0, 4)}-01-01`;

  // ── ACTIF IMMOBILISÉ ─────────────────────────────────────────────────────

  // Sorties avec catégories immobilisations (cumul depuis l'origine, pas juste l'exercice)
  const immoIncorp = sumCat(db, 'depenses', CAT_IMMO_INCORP, 'date <= ?', [date]);
  const immoCorpData = sumCat(db, 'depenses', CAT_IMMO_CORP, 'date <= ?', [date]);

  const totalImmobilise = round2(immoIncorp.total + immoCorpData.total);

  // ── ACTIF CIRCULANT ──────────────────────────────────────────────────────

  // Créances clients (41) : factures en_attente
  const creancesRow = db
    .prepare(`SELECT COALESCE(SUM(montant_ttc), 0) AS total FROM factures WHERE statut = 'en_attente' AND date <= ?`)
    .get(date);
  const creancesClients = round2(creancesRow.total);

  // Trésorerie : toutes encaissements payés - tous décaissements payés (toutes catégories, all time)
  const factPayeesRow = db
    .prepare(`SELECT COALESCE(SUM(montant_ttc), 0) AS total FROM factures WHERE statut = 'payee' AND date <= ?`)
    .get(date);
  const depPayeesRow = db
    .prepare(`SELECT COALESCE(SUM(montant_ttc), 0) AS total FROM depenses WHERE statut = 'payee' AND date <= ?`)
    .get(date);
  const tresorerieBrute = round2(factPayeesRow.total - depPayeesRow.total);

  // TVA cumulée (toutes catégories — TVA sur immo est déductible en France)
  const tvaCollecteeRow = db
    .prepare(`SELECT COALESCE(SUM(montant_tva), 0) AS total FROM factures WHERE date <= ?`)
    .get(date);
  const tvaDeductibleRow = db
    .prepare(`SELECT COALESCE(SUM(montant_tva), 0) AS total FROM depenses WHERE date <= ?`)
    .get(date);

  const tvaCollectee  = round2(tvaCollecteeRow.total);
  const tvaDeductible = round2(tvaDeductibleRow.total);
  const soldeTva      = round2(tvaCollectee - tvaDeductible);
  const creditTva     = round2(Math.max(0, -soldeTva));
  const tvaADecaisser = round2(Math.max(0,  soldeTva));

  const disponibilites = round2(Math.max(0,  tresorerieBrute));
  const decouvert      = round2(Math.max(0, -tresorerieBrute));

  const totalCirculant = round2(creancesClients + creditTva + disponibilites);

  // ── PASSIF – CAPITAUX PROPRES ────────────────────────────────────────────

  // Capital social (101) — cumul depuis l'origine
  const capitalSocial = sumCatSingle(db, 'factures', CAT_CAPITAL_SOCIAL, 'date <= ?', [date]);

  // Compte exploitant net (108 apports entrées - 108 prélèvements sorties)
  const apportsExpl   = sumCatSingle(db, 'factures', CAT_APPORT_EXPL, 'date <= ?', [date]);
  const prelevExpl    = sumCatSingle(db, 'depenses', CAT_PRELEV_EXPL,  'date <= ?', [date]);
  const compteExploitant = round2(apportsExpl - prelevExpl);

  // Résultat de l'exercice (uniquement catégories P&L — pas les BS items)
  const produitsPnlPlaceholders = CAT_PNL_PRODUITS.map(() => '?').join(',');
  const chargesPnlPlaceholders  = CAT_PNL_CHARGES.map(() => '?').join(',');

  const revenusRow = db
    .prepare(`SELECT COALESCE(SUM(montant_ht), 0) AS total FROM factures
              WHERE date >= ? AND date <= ? AND categorie IN (${produitsPnlPlaceholders})`)
    .get(debutExercice, date, ...CAT_PNL_PRODUITS);
  const chargesRow = db
    .prepare(`SELECT COALESCE(SUM(montant_ht), 0) AS total FROM depenses
              WHERE date >= ? AND date <= ? AND categorie IN (${chargesPnlPlaceholders})`)
    .get(debutExercice, date, ...CAT_PNL_CHARGES);

  const resultatExercice = round2(revenusRow.total - chargesRow.total);

  const totalCapitauxPropres = round2(capitalSocial + compteExploitant + resultatExercice);

  // ── PASSIF – DETTES FINANCIÈRES ──────────────────────────────────────────

  // Emprunts nets (164 reçus entrées - 164 remboursements sorties)
  const empruntsRecus   = sumCatSingle(db, 'factures', CAT_EMPRUNT_RECU,      'date <= ?', [date]);
  const empruntsRembours = sumCatSingle(db, 'depenses', CAT_EMPRUNT_REMBOURS, 'date <= ?', [date]);
  const empruntsNet     = round2(Math.max(0, empruntsRecus - empruntsRembours));

  // C/C associés nets (455 avances entrées - 455 remboursements sorties)
  const ccRecus    = sumCatSingle(db, 'factures', CAT_CC_ASSOC_RECU,     'date <= ?', [date]);
  const ccRembours = sumCatSingle(db, 'depenses', CAT_CC_ASSOC_REMBOURS, 'date <= ?', [date]);
  const ccNet      = round2(Math.max(0, ccRecus - ccRembours));

  const totalDettesFinancieres = round2(empruntsNet + ccNet);

  // ── PASSIF – DETTES D'EXPLOITATION ──────────────────────────────────────

  const dettesRow = db
    .prepare(`SELECT COALESCE(SUM(montant_ttc), 0) AS total FROM depenses WHERE statut = 'en_attente' AND date <= ?`)
    .get(date);
  const dettesFournisseurs = round2(dettesRow.total);

  const totalDettesExpl = round2(dettesFournisseurs + tvaADecaisser + decouvert);

  // ── TOTAUX ───────────────────────────────────────────────────────────────

  const totalActif  = round2(totalImmobilise + totalCirculant);
  const totalPassif = round2(totalCapitauxPropres + totalDettesFinancieres + totalDettesExpl);

  return {
    date,
    actif: {
      immobilise: {
        incorporelles: immoIncorp,      // 201, 205
        corporelles:   immoCorpData,    // 211, 213, 215, 218
        total: totalImmobilise,
      },
      circulant: {
        creances_clients: creancesClients,  // 41
        credit_tva:       creditTva,         // 44567
        disponibilites:   disponibilites,    // 512
        total: totalCirculant,
      },
      total: totalActif,
    },
    passif: {
      capitaux_propres: {
        capital_social:      capitalSocial,      // 101
        compte_exploitant:   compteExploitant,   // 108 net
        resultat_exercice:   resultatExercice,   // 12
        total: totalCapitauxPropres,
      },
      dettes_financieres: {
        emprunts:            empruntsNet,         // 164 net
        comptes_courants:    ccNet,               // 455 net
        total: totalDettesFinancieres,
      },
      dettes_exploitation: {
        dettes_fournisseurs: dettesFournisseurs, // 40
        tva_a_decaisser:     tvaADecaisser,      // 44551
        decouvert:           decouvert,           // 564
        total: totalDettesExpl,
      },
      total: totalPassif,
    },
  };
}

module.exports = { getBilanReport };
