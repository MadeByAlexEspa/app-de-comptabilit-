const { decryptRows, FACTURE_FIELDS, DEPENSE_FIELDS } = require('./cryptoService');

function round2(n) {
  return Math.round(n * 100) / 100;
}

const CAT_IMMO_INCORP = [
  // Old labels
  '201 – Frais d'établissement',
  '2051 – Concessions, brevets, licences, marques',
  '2052 – Logiciels (développement interne)',
  // New labels
  '2051 – Concessions, brevets, licences & marques',
  '2052 – Logiciels développés en interne',
];
const CAT_IMMO_CORP = [
  // Old labels
  '211 – Terrains',
  '213 – Constructions',
  '215 – Matériel et outillage industriel',
  '218 – Autres immobilisations corporelles',
  // New labels
  '215 – Matériel informatique & outillage',
  '218 – Immobilisations corporelles (matériel bureautique)',
];

const CAT_CAPITAL_SOCIAL   = '101 – Capital social (apport)';
const CAT_APPORT_EXPL      = '108 – Apport de l'exploitant';
const CAT_EMPRUNT_RECU     = '164 – Emprunts bancaires reçus';
const CAT_CC_ASSOC_RECU    = '455 – Avances en compte courant associé';
const CAT_PRELEV_EXPL      = '108 – Prélèvements de l'exploitant';
const CAT_EMPRUNT_REMBOURS = '164 – Remboursement d'emprunt';
const CAT_CC_ASSOC_REMBOURS = '455 – Remboursement compte courant associé';

const CAT_PNL_PRODUITS = [
  // CA
  '706 – Prestations de services',
  '701 – Ventes de produits finis',
  '707 – Ventes de marchandises',
  '708 – Produits des activités annexes',
  '706 – Abonnements SaaS (MRR / ARR)',
  '706.1 – Licences logicielles',
  '706.2 – Abonnements annuels prépayés',
  '706.3 – Abonnements mensuels',
  '708 – Consulting & prestations annexes',
  '708.1 – Formation & onboarding clients',
  '708.2 – Intégrations & développements sur mesure',
  '708.3 – Support premium / SLA',
  '708.4 – Revenus de marketplace / commissions',
  // Autres produits
  '74 – Subventions d'exploitation',
  '741 – Aides BPI / innovation (CIR, CII)',
  '742 – Subventions d'équipement',
  '75 – Autres produits de gestion courante',
  '409 – Avoirs fournisseurs reçus',
  '76 – Produits financiers',
  '77 – Produits exceptionnels',
];

const CAT_PNL_CHARGES = [
  // Achats
  '604 – Achats de prestations de services',
  '604 – Achats de prestations de développement',
  '606 – Fournitures et petits équipements',
  '606 – Fournitures & petits équipements',
  '607 – Achats de marchandises',
  // Charges externes
  '611 – Sous-traitance générale',
  '611 – Sous-traitance technique (freelances, agences)',
  '613 – Locations & charges locatives',
  '6135 – Coworking & espaces de travail partagés',
  '615 – Entretien et réparations',
  '615 – Entretien & réparations',
  '616 – Primes d'assurance',
  '616 – Primes d'assurance (RC pro, cyber…)',
  '618 – Abonnements & frais informatiques',
  '618 – Autres abonnements & frais informatiques',
  '618.1 – Hébergement cloud (AWS, GCP, Azure)',
  '618.2 – Base de données & stockage cloud',
  '618.3 – CDN, DNS & sécurité réseau',
  '618.4 – Monitoring & observabilité (Datadog, Sentry…)',
  '618.5 – CRM (Salesforce, HubSpot…)',
  '618.6 – Support client (Intercom, Zendesk…)',
  '618.7 – Productivité & collaboration (Notion, Slack…)',
  '618.8 – Analytics & BI (Mixpanel, Amplitude…)',
  '618.9 – Paiement & facturation (Stripe, Paddle…)',
  '618.10 – Emailing & marketing automation',
  '618.11 – Sécurité & conformité (auth, SSO, DLP)',
  '622 – Honoraires et rémunérations d'intermédiaires',
  '622 – Autres honoraires & rémunérations intermédiaires',
  '622.1 – Honoraires comptables & juridiques',
  '622.2 – Conseil & consulting stratégique',
  '623 – Publicité & communication',
  '623 – Autres dépenses publicité & communication',
  '623.1 – Publicité digitale (Google Ads, Meta, LinkedIn…)',
  '623.2 – SEO & content marketing',
  '623.3 – Partenariats & affiliation',
  '623.4 – Événements, salons & conférences',
  '623.5 – Création de contenu & design',
  '624 – Transports de biens',
  '625 – Déplacements, missions & réceptions',
  '626 – Frais postaux & télécommunications',
  '627 – Services bancaires & assimilés',
  '627 – Services bancaires & commissions',
  // Impôts taxes
  '631 – Impôts, taxes et versements assimilés sur rémunérations',
  '631 – Impôts & taxes sur rémunérations',
  '635 – Autres impôts, taxes et versements assimilés',
  '635 – Autres impôts, taxes & versements assimilés',
  // Personnel
  '641 – Rémunérations du personnel',
  '645 – Charges sociales & cotisations',
  '645 – Charges sociales & cotisations patronales',
  '648 – Mutuelle, tickets-restaurant & avantages',
  '421 – Notes de frais du personnel',
  // Dotations
  '681 – Dotations aux amortissements d'exploitation',
  // Financières
  '661 – Charges d'intérêts',
  '668 – Autres charges financières',
  // Exceptionnelles
  '671 – Charges exceptionnelles sur opérations de gestion',
  '671 – Charges exceptionnelles',
  '675 – Valeurs comptables des éléments cédés',
  // Avoirs clients (déduits du CA)
  '709 – Avoirs & remboursements clients',
  // IS
  '695 – Impôt sur les bénéfices (IS)',
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

  // Report à nouveau (11) — bénéfices/pertes des exercices antérieurs non distribués
  // Approximation : cumul des résultats des exercices antérieurs à l'exercice courant.
  // On prend tous les produits/charges hors période courante (avant debutExercice).
  const beforePeriod = row => row.date < debutExercice;
  let produitsAnterieurs = 0, chargesAnterieures = 0;
  for (const r of allFactures) {
    if (beforePeriod(r) && pnlProdSet.has(r.categorie)) produitsAnterieurs = round2(produitsAnterieurs + (r.montant_ht || 0));
  }
  for (const r of allDepenses) {
    if (beforePeriod(r) && pnlChgSet.has(r.categorie)) chargesAnterieures = round2(chargesAnterieures + (r.montant_ht || 0));
  }
  const reportANouveau = round2(produitsAnterieurs - chargesAnterieures);

  let revenusExerc = 0, chargesExerc = 0;
  for (const r of allFactures) {
    if (byPeriod(r) && pnlProdSet.has(r.categorie)) revenusExerc = round2(revenusExerc + (r.montant_ht || 0));
  }
  for (const r of allDepenses) {
    if (byPeriod(r) && pnlChgSet.has(r.categorie)) chargesExerc = round2(chargesExerc + (r.montant_ht || 0));
  }
  const resultatExercice = round2(revenusExerc - chargesExerc);
  const totalCapitauxPropres = round2(capitalSocial + compteExploitant + reportANouveau + resultatExercice);

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
        report_a_nouveau:    reportANouveau,
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
