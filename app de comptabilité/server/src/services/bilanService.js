const { decryptRows, FACTURE_FIELDS, DEPENSE_FIELDS } = require('./cryptoService');

function round2(n) {
  return Math.round(n * 100) / 100;
}

const CAT_IMMO_INCORP = [
  '201 \u2013 Frais d\u2019\u00e9tablissement',
  '2051 \u2013 Concessions, brevets, licences, marques',
  '2052 \u2013 Logiciels (d\u00e9veloppement interne)',
];
const CAT_IMMO_CORP = [
  '211 \u2013 Terrains',
  '213 \u2013 Constructions',
  '215 \u2013 Mat\u00e9riel et outillage industriel',
  '218 \u2013 Autres immobilisations corporelles',
];

const CAT_CAPITAL_SOCIAL   = '101 \u2013 Capital social (apport)';
const CAT_APPORT_EXPL      = '108 \u2013 Apport de l\u2019exploitant';
const CAT_EMPRUNT_RECU     = '164 \u2013 Emprunts bancaires re\u00e7us';
const CAT_CC_ASSOC_RECU    = '455 \u2013 Avances en compte courant associ\u00e9';
const CAT_PRELEV_EXPL      = '108 \u2013 Pr\u00e9l\u00e8vements de l\u2019exploitant';
const CAT_EMPRUNT_REMBOURS = '164 \u2013 Remboursement d\u2019emprunt';
const CAT_CC_ASSOC_REMBOURS = '455 \u2013 Remboursement compte courant associ\u00e9';

const CAT_PNL_PRODUITS = [
  '706 \u2013 Prestations de services',
  '701 \u2013 Ventes de produits finis',
  '707 \u2013 Ventes de marchandises',
  '708 \u2013 Produits des activit\u00e9s annexes',
  '74 \u2013 Subventions d\u2019exploitation',
  '75 \u2013 Autres produits de gestion courante',
  '409 \u2013 Avoirs fournisseurs re\u00e7us',
  '76 \u2013 Produits financiers',
  '77 \u2013 Produits exceptionnels',
];
const CAT_PNL_CHARGES = [
  '604 \u2013 Achats de prestations de services',
  '606 \u2013 Fournitures et petits \u00e9quipements',
  '607 \u2013 Achats de marchandises',
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
  '631 \u2013 Imp\u00f4ts, taxes et versements assimil\u00e9s sur r\u00e9mun\u00e9rations',
  '635 \u2013 Autres imp\u00f4ts, taxes et versements assimil\u00e9s',
  '641 \u2013 R\u00e9mun\u00e9rations du personnel',
  '645 \u2013 Charges sociales & cotisations',
  '421 \u2013 Notes de frais du personnel',
  '681 \u2013 Dotations aux amortissements d\u2019exploitation',
  '661 \u2013 Charges d\u2019int\u00e9r\u00eats',
  '668 \u2013 Autres charges financi\u00e8res',
  '671 \u2013 Charges exceptionnelles sur op\u00e9rations de gestion',
  '675 \u2013 Valeurs comptables des \u00e9l\u00e9ments c\u00e9d\u00e9s',
  '709 \u2013 Avoirs & remboursements clients',
  '695 \u2013 Imp\u00f4t sur les b\u00e9n\u00e9fices (IS)',
];

function sumCat(rows, categories, dateFilter) {
  const catSet = new Set(categories);
  const par_categorie = {};
  let total = 0;
  for (const row of rows) {
    if (!catSet.has(row.categorie)) continue;
    if (dateFilter && !dateFilter(row)) continue;
    par_categorie[row.categorie] = round2((par_categorie[row.categorie] || 0) + (row.montant_ht || 0));
    total = round2(total + (row.montant_ht || 0));
  }
  return { par_categorie, total };
}

function sumCatSingle(rows, categorie, dateFilter) {
  let total = 0;
  for (const row of rows) {
    if (row.categorie !== categorie) continue;
    if (dateFilter && !dateFilter(row)) continue;
    total = round2(total + (row.montant_ht || 0));
  }
  return total;
}

function sumField(rows, field, dateFilter, statut) {
  let total = 0;
  for (const row of rows) {
    if (statut && row.statut !== statut) continue;
    if (dateFilter && !dateFilter(row)) continue;
    total = round2(total + (row[field] || 0));
  }
  return total;
}

function getBilanReport(db, date, debut, workspaceId) {
  const debutExercice = debut || `${date.slice(0, 4)}-01-01`;

  const allFactures = decryptRows(
    db.prepare('SELECT * FROM factures WHERE date <= ?').all(date),
    FACTURE_FIELDS, workspaceId
  );
  const allDepenses = decryptRows(
    db.prepare('SELECT * FROM depenses WHERE date <= ?').all(date),
    DEPENSE_FIELDS, workspaceId
  );

  const byPeriod = row => row.date >= debutExercice && row.date <= date;

  // ── ACTIF IMMOBILISÉ
  const immoIncorp    = sumCat(allDepenses, CAT_IMMO_INCORP);
  const immoCorpData  = sumCat(allDepenses, CAT_IMMO_CORP);
  const totalImmobilise = round2(immoIncorp.total + immoCorpData.total);

  // ── ACTIF CIRCULANT
  const creancesClients = sumField(allFactures, 'montant_ttc', null, 'en_attente');

  const factPayees  = sumField(allFactures, 'montant_ttc', null, 'payee');
  const depPayees   = sumField(allDepenses, 'montant_ttc', null, 'payee');
  const tresorerieBrute = round2(factPayees - depPayees);

  const tvaCollectee  = sumField(allFactures, 'montant_tva');
  const tvaDeductible = sumField(allDepenses, 'montant_tva');
  const soldeTva      = round2(tvaCollectee - tvaDeductible);
  const creditTva     = round2(Math.max(0, -soldeTva));
  const tvaADecaisser = round2(Math.max(0,  soldeTva));

  const disponibilites = round2(Math.max(0,  tresorerieBrute));
  const decouvert      = round2(Math.max(0, -tresorerieBrute));

  const totalCirculant = round2(creancesClients + creditTva + disponibilites);

  // ── PASSIF – CAPITAUX PROPRES
  const capitalSocial    = sumCatSingle(allFactures, CAT_CAPITAL_SOCIAL);
  const apportsExpl      = sumCatSingle(allFactures, CAT_APPORT_EXPL);
  const prelevExpl       = sumCatSingle(allDepenses, CAT_PRELEV_EXPL);
  const compteExploitant = round2(apportsExpl - prelevExpl);

  const pnlProdSet = new Set(CAT_PNL_PRODUITS);
  const pnlChgSet  = new Set(CAT_PNL_CHARGES);

  let revenusExerc = 0, chargesExerc = 0;
  for (const r of allFactures) {
    if (byPeriod(r) && pnlProdSet.has(r.categorie)) revenusExerc = round2(revenusExerc + (r.montant_ht || 0));
  }
  for (const r of allDepenses) {
    if (byPeriod(r) && pnlChgSet.has(r.categorie)) chargesExerc = round2(chargesExerc + (r.montant_ht || 0));
  }
  const resultatExercice = round2(revenusExerc - chargesExerc);
  const totalCapitauxPropres = round2(capitalSocial + compteExploitant + resultatExercice);

  // ── PASSIF – DETTES FINANCIÈRES
  const empruntsRecus    = sumCatSingle(allFactures, CAT_EMPRUNT_RECU);
  const empruntsRembours = sumCatSingle(allDepenses, CAT_EMPRUNT_REMBOURS);
  const empruntsNet      = round2(Math.max(0, empruntsRecus - empruntsRembours));

  const ccRecus    = sumCatSingle(allFactures, CAT_CC_ASSOC_RECU);
  const ccRembours = sumCatSingle(allDepenses, CAT_CC_ASSOC_REMBOURS);
  const ccNet      = round2(Math.max(0, ccRecus - ccRembours));

  const totalDettesFinancieres = round2(empruntsNet + ccNet);

  // ── PASSIF – DETTES D'EXPLOITATION
  const dettesFournisseurs = sumField(allDepenses, 'montant_ttc', null, 'en_attente');
  const totalDettesExpl    = round2(dettesFournisseurs + tvaADecaisser + decouvert);

  // ── TOTAUX
  const totalActif  = round2(totalImmobilise + totalCirculant);
  const totalPassif = round2(totalCapitauxPropres + totalDettesFinancieres + totalDettesExpl);

  return {
    date,
    actif: {
      immobilise: {
        incorporelles: immoIncorp,
        corporelles:   immoCorpData,
        total: totalImmobilise,
      },
      circulant: {
        creances_clients: creancesClients,
        credit_tva:       creditTva,
        disponibilites:   disponibilites,
        total: totalCirculant,
      },
      total: totalActif,
    },
    passif: {
      capitaux_propres: {
        capital_social:      capitalSocial,
        compte_exploitant:   compteExploitant,
        resultat_exercice:   resultatExercice,
        total: totalCapitauxPropres,
      },
      dettes_financieres: {
        emprunts:            empruntsNet,
        comptes_courants:    ccNet,
        total: totalDettesFinancieres,
      },
      dettes_exploitation: {
        dettes_fournisseurs: dettesFournisseurs,
        tva_a_decaisser:     tvaADecaisser,
        decouvert:           decouvert,
        total: totalDettesExpl,
      },
      total: totalPassif,
    },
  };
}

module.exports = { getBilanReport };
