const { decryptRows, FACTURE_FIELDS, DEPENSE_FIELDS } = require('./cryptoService');

function round2(n) {
  return Math.round(n * 100) / 100;
}

// ── Catégories P&L (Classe 6 & 7 uniquement — hors immobilisations & financement) ──

// PRODUITS ─────────────────────────────────────────────────────────────────────

const CAT_CA = new Set([
  // Old labels (kept for DB compatibility)
  "706 – Prestations de services",
  "701 – Ventes de produits finis",
  "707 – Ventes de marchandises",
  "708 – Produits des activités annexes",
  // New SaaS labels
  "706 – Abonnements SaaS (MRR / ARR)",
  "706.1 – Licences logicielles",
  "706.2 – Abonnements annuels prépayés",
  "706.3 – Abonnements mensuels",
  "708 – Consulting & prestations annexes",
  "708.1 – Formation & onboarding clients",
  "708.2 – Intégrations & développements sur mesure",
  "708.3 – Support premium / SLA",
  "708.4 – Revenus de marketplace / commissions",
]);

// 709 : rabais, remises, ristournes accordés (débit sur vente → réduit le CA)
// Enregistrés en dépenses dans l’app ; soustraits du CA brut pour obtenir le CA net.
const CAT_AVOIRS_CLIENTS = new Set([
  "709 – Avoirs & remboursements clients",
]);

const CAT_AUTRES_PRODUITS_EXPL = new Set([
  "74 – Subventions d’exploitation",
  "75 – Autres produits de gestion courante",
  // 409 : avoir fournisseur reçu — enregistré en entrée, réduit le coût d’achat net
  "409 – Avoirs fournisseurs reçus",
  // New
  "741 – Aides BPI / innovation (CIR, CII)",
  "742 – Subventions d’équipement",
]);

const CAT_PRODUITS_FINANCIERS = new Set([
  "76 – Produits financiers",
]);

const CAT_PRODUITS_EXCEPTIONNELS = new Set([
  "77 – Produits exceptionnels",
]);

// CHARGES ──────────────────────────────────────────────────────────────────────

const CAT_ACHATS = new Set([
  // Old labels
  "604 – Achats de prestations de services",
  "606 – Fournitures et petits équipements",
  "607 – Achats de marchandises",
  // New labels
  "604 – Achats de prestations de développement",
  "606 – Fournitures & petits équipements",
]);

const CAT_CHARGES_EXTERNES = new Set([
  // Old labels
  "611 – Sous-traitance générale",
  "613 – Locations & charges locatives",
  "615 – Entretien et réparations",
  "616 – Primes d’assurance",
  "618 – Abonnements & frais informatiques",
  "622 – Honoraires et rémunérations d’intermédiaires",
  "623 – Publicité & communication",
  "624 – Transports de biens",
  "625 – Déplacements, missions & réceptions",
  "626 – Frais postaux & télécommunications",
  "627 – Services bancaires & assimilés",
  // New SaaS labels
  "611 – Sous-traitance technique (freelances, agences)",
  "6135 – Coworking & espaces de travail partagés",
  "615 – Entretien & réparations",
  "616 – Primes d’assurance (RC pro, cyber…)",
  "618 – Autres abonnements & frais informatiques",
  "618.1 – Hébergement cloud (AWS, GCP, Azure)",
  "618.2 – Base de données & stockage cloud",
  "618.3 – CDN, DNS & sécurité réseau",
  "618.4 – Monitoring & observabilité (Datadog, Sentry…)",
  "618.5 – CRM (Salesforce, HubSpot…)",
  "618.6 – Support client (Intercom, Zendesk…)",
  "618.7 – Productivité & collaboration (Notion, Slack…)",
  "618.8 – Analytics & BI (Mixpanel, Amplitude…)",
  "618.9 – Paiement & facturation (Stripe, Paddle…)",
  "618.10 – Emailing & marketing automation",
  "618.11 – Sécurité & conformité (auth, SSO, DLP)",
  "622 – Autres honoraires & rémunérations intermédiaires",
  "622.1 – Honoraires comptables & juridiques",
  "622.2 – Conseil & consulting stratégique",
  "623 – Autres dépenses publicité & communication",
  "623.1 – Publicité digitale (Google Ads, Meta, LinkedIn…)",
  "623.2 – SEO & content marketing",
  "623.3 – Partenariats & affiliation",
  "623.4 – Événements, salons & conférences",
  "623.5 – Création de contenu & design",
  "627 – Services bancaires & commissions",
]);

const CAT_IMPOTS_TAXES = new Set([
  // Old labels
  "631 – Impôts, taxes et versements assimilés sur rémunérations",
  "635 – Autres impôts, taxes et versements assimilés",
  // New labels
  "631 – Impôts & taxes sur rémunérations",
  "635 – Autres impôts, taxes & versements assimilés",
]);

const CAT_CHARGES_PERSONNEL = new Set([
  // Old labels
  "641 – Rémunérations du personnel",
  "645 – Charges sociales & cotisations",
  // 421 : remboursement de notes de frais (charge de personnel nette de TVA)
  "421 – Notes de frais du personnel",
  // New labels
  "645 – Charges sociales & cotisations patronales",
  "648 – Mutuelle, tickets-restaurant & avantages",
]);

const CAT_DOTATIONS = new Set([
  "681 – Dotations aux amortissements d’exploitation",
]);

const CAT_CHARGES_FINANCIERES = new Set([
  "661 – Charges d’intérêts",
  "668 – Autres charges financières",
]);

const CAT_CHARGES_EXCEPTIONNELLES = new Set([
  // Old label
  "671 – Charges exceptionnelles sur opérations de gestion",
  "675 – Valeurs comptables des éléments cédés",
  // New label
  "671 – Charges exceptionnelles",
]);

const CAT_IS = new Set([
  "695 – Impôt sur les bénéfices (IS)",
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
 *
 * @param {object} db    - workspace DB instance
 * @param {string} debut - "YYYY-MM-DD"
 * @param {string} fin   - "YYYY-MM-DD"
 */
function getPnlReport(db, debut, fin, workspaceId) {
  const factures = decryptRows(
    db.prepare('SELECT * FROM factures WHERE date >= ? AND date <= ?').all(debut, fin),
    FACTURE_FIELDS, workspaceId
  );
  const depenses = decryptRows(
    db.prepare('SELECT * FROM depenses WHERE date >= ? AND date <= ?').all(debut, fin),
    DEPENSE_FIELDS, workspaceId
  );

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
    (ca.par_categorie['707 – Ventes de marchandises'] || 0) -
    (achats.par_categorie['607 – Achats de marchandises'] || 0)
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
