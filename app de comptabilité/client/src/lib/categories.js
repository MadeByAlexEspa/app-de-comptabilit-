// Options de catégories PCG pour le combobox inline des transactions.
// Format : [{ group, options: [{value, label}] }]
// Une entrée par type d'activité (activite_type) × direction (entrees / sorties).

function opts(groupes) {
  return groupes.map(g => ({
    group: g.group,
    options: g.options.map(v => ({ value: v, label: v })),
  }))
}

// ── SaaS ──────────────────────────────────────────────────────────────────────

const SAAS_ENTREES = opts([
  { group: 'Abonnements & Licences',
    options: [
      '706 – Abonnements SaaS (MRR / ARR)',
      '706.1 – Licences logicielles',
      '706.2 – Abonnements annuels prépayés',
      '706.3 – Abonnements mensuels',
    ],
  },
  { group: 'Services & Prestations annexes',
    options: [
      '708 – Consulting & prestations annexes',
      '708.1 – Formation & onboarding clients',
      '708.2 – Intégrations & développements sur mesure',
      '708.3 – Support premium / SLA',
      '708.4 – Revenus de marketplace / commissions',
    ],
  },
  { group: 'Subventions & Aides publiques',
    options: [
      '74 – Subventions d’exploitation',
      '741 – Aides BPI / innovation (CIR, CII)',
    ],
  },
  { group: 'Autres produits',
    options: [
      '701 – Ventes de produits finis',
      '707 – Ventes de marchandises',
      '75 – Autres produits de gestion courante',
      '76 – Produits financiers',
      '77 – Produits exceptionnels',
      '409 – Avoirs fournisseurs reçus',
      '709 – Avoirs & remboursements clients',
    ],
  },
  { group: 'Financement & opérations internes',
    options: [
      '101 – Capital social (apport)',
      '108 – Apport de l’exploitant',
      '164 – Emprunts bancaires reçus',
      '455 – Avances en compte courant associé',
      '58 – Virement interne entre comptes',
    ],
  },
])

const SAAS_SORTIES = opts([
  { group: 'Infrastructure & Hébergement',
    options: [
      '618.1 – Hébergement cloud (AWS, GCP, Azure)',
      '618.2 – Base de données & stockage cloud',
      '618.3 – CDN, DNS & sécurité réseau',
      '618.4 – Monitoring & observabilité (Datadog, Sentry…)',
      '618 – Autres abonnements & frais informatiques',
    ],
  },
  { group: 'Outils SaaS tiers',
    options: [
      '618.5 – CRM (Salesforce, HubSpot…)',
      '618.6 – Support client (Intercom, Zendesk…)',
      '618.7 – Productivité & collaboration (Notion, Slack…)',
      '618.8 – Analytics & BI (Mixpanel, Amplitude…)',
      '618.9 – Paiement & facturation (Stripe, Paddle…)',
      '618.10 – Emailing & marketing automation',
      '618.11 – Sécurité & conformité (auth, SSO)',
    ],
  },
  { group: 'Développement & Propriété intellectuelle',
    options: [
      '2052 – Logiciels développés en interne',
      '2051 – Concessions, brevets, licences & marques',
      '604 – Achats de prestations de développement',
      '611 – Sous-traitance technique (freelances, agences)',
    ],
  },
  { group: 'Personnel & RH',
    options: [
      '641 – Rémunérations du personnel',
      '645 – Charges sociales & cotisations patronales',
      '648 – Mutuelle, tickets-restaurant & avantages',
      '421 – Notes de frais du personnel',
      '631 – Impôts & taxes sur rémunérations',
    ],
  },
  { group: 'Marketing & Acquisition',
    options: [
      '623.1 – Publicité digitale (Google Ads, Meta, LinkedIn…)',
      '623.2 – SEO & content marketing',
      '623.3 – Partenariats & affiliation',
      '623.4 – Événements & conférences',
      '623.5 – Création de contenu & design',
      '623 – Autres dépenses publicité & communication',
    ],
  },
  { group: 'Frais généraux',
    options: [
      '622.1 – Honoraires comptables & juridiques',
      '622 – Autres honoraires & rémunérations intermédiaires',
      '616 – Primes d’assurance (RC pro, cyber…)',
      '613 – Locations & charges locatives',
      '6135 – Coworking & espaces de travail partagés',
      '625 – Déplacements, missions & réceptions',
      '626 – Frais postaux & télécommunications',
      '627 – Services bancaires & commissions',
    ],
  },
  { group: 'Impôts, amortissements & exceptionnel',
    options: [
      '635 – Autres impôts, taxes & versements assimilés',
      '695 – Impôt sur les bénéfices (IS)',
      '681 – Dotations aux amortissements d’exploitation',
      '661 – Charges d’intérêts',
      '668 – Autres charges financières',
      '671 – Charges exceptionnelles',
    ],
  },
  { group: 'Opérations financières & internes',
    options: [
      '108 – Prélèvements de l’exploitant',
      '164 – Remboursement d’emprunt',
      '455 – Remboursement compte courant associé',
      '58 – Virement interne entre comptes',
    ],
  },
])

// ── Conseil / Freelance ───────────────────────────────────────────────────────

const CONSEIL_ENTREES = opts([
  { group: 'Missions & Prestations',
    options: [
      '706 – Prestations de conseil',
      '706.1 – Missions courtes (< 1 mois)',
      '706.2 – Missions longues / TMA',
      '706.3 – Forfaits & abonnements conseil',
    ],
  },
  { group: 'Formation & Coaching',
    options: [
      '708.1 – Formations professionnelles',
      '708.2 – Coaching & accompagnement',
      '708.3 – Ateliers & workshops',
    ],
  },
  { group: 'Droits & Propriété intellectuelle',
    options: [
      '708.4 – Droits d’auteur & royalties',
      '708.5 – Licences de méthodologies',
    ],
  },
  { group: 'Subventions & autres produits',
    options: [
      '74 – Subventions d’exploitation',
      '75 – Autres produits de gestion courante',
      '76 – Produits financiers',
      '77 – Produits exceptionnels',
      '409 – Avoirs fournisseurs reçus',
      '709 – Avoirs & remboursements clients',
    ],
  },
  { group: 'Financement & opérations internes',
    options: [
      '101 – Capital social (apport)',
      '108 – Apport de l’exploitant',
      '164 – Emprunts bancaires reçus',
      '455 – Avances en compte courant associé',
      '58 – Virement interne entre comptes',
    ],
  },
])

const CONSEIL_SORTIES = opts([
  { group: 'Déplacements & missions',
    options: [
      '625.1 – Transport (train, avion)',
      '625.2 – Hôtel & hébergement',
      '625.3 – Repas & réception client',
      '625 – Autres déplacements, missions & réceptions',
      '624 – Transports de biens',
    ],
  },
  { group: 'Sous-traitance & cotraitance',
    options: [
      '611 – Sous-traitance (consultants, experts)',
      '604 – Achats de prestations de services',
    ],
  },
  { group: 'Outils & logiciels',
    options: [
      '618 – Abonnements & frais informatiques',
      '618.7 – Productivité & collaboration',
      '618.9 – Paiement & facturation',
    ],
  },
  { group: 'Frais généraux',
    options: [
      '622.1 – Honoraires comptables & juridiques',
      '622 – Autres honoraires & rémunérations intermédiaires',
      '616 – Primes d’assurance (RC pro)',
      '613 – Locations & charges locatives',
      '6135 – Coworking & espaces de travail',
      '626 – Frais postaux & télécommunications',
      '627 – Services bancaires & commissions',
      '606 – Fournitures & petits équipements',
    ],
  },
  { group: 'Personnel (si salariés)',
    options: [
      '641 – Rémunérations du personnel',
      '645 – Charges sociales & cotisations patronales',
      '421 – Notes de frais du personnel',
    ],
  },
  { group: 'Impôts, amortissements & exceptionnel',
    options: [
      '635 – Autres impôts, taxes & versements assimilés',
      '695 – Impôt sur les bénéfices (IS)',
      '681 – Dotations aux amortissements d’exploitation',
      '661 – Charges d’intérêts',
      '671 – Charges exceptionnelles',
    ],
  },
  { group: 'Opérations financières & internes',
    options: [
      '108 – Prélèvements de l’exploitant',
      '164 – Remboursement d’emprunt',
      '455 – Remboursement compte courant associé',
      '58 – Virement interne entre comptes',
    ],
  },
])

// ── Événementiel ──────────────────────────────────────────────────────────────

const EVENEMENTIEL_ENTREES = opts([
  { group: 'Billetterie & inscriptions',
    options: [
      '708.1 – Billets & inscriptions participants',
      '708.2 – Pass VIP & formules premium',
      '708.3 – Abonnements annuels / club',
    ],
  },
  { group: 'Sponsoring & partenariats',
    options: [
      '708.4 – Sponsors officiels',
      '708.5 – Partenaires médias',
      '708.6 – Placement de marque & stands',
    ],
  },
  { group: 'Prestations & location',
    options: [
      '706 – Prestations de services événementiels',
      '706.1 – Location d’espace événementiel',
      '707 – Ventes de marchandises (goodies, stands)',
    ],
  },
  { group: 'Subventions & autres produits',
    options: [
      '74 – Subventions d’exploitation',
      '75 – Autres produits de gestion courante',
      '76 – Produits financiers',
      '77 – Produits exceptionnels',
      '409 – Avoirs fournisseurs reçus',
      '709 – Avoirs & remboursements clients',
    ],
  },
  { group: 'Financement & opérations internes',
    options: [
      '101 – Capital social (apport)',
      '108 – Apport de l’exploitant',
      '164 – Emprunts bancaires reçus',
      '455 – Avances en compte courant associé',
      '58 – Virement interne entre comptes',
    ],
  },
])

const EVENEMENTIEL_SORTIES = opts([
  { group: 'Lieu & logistique',
    options: [
      '613 – Location de salle & équipements',
      '613.1 – Décors, scène & montage',
      '613.2 – Matériel audiovisuel & éclairage',
      '624 – Transport & logistique matériel',
    ],
  },
  { group: 'Prestataires & sous-traitance',
    options: [
      '611 – Sous-traitance prestataires événement',
      '611.1 – Artistes, conférenciers & animateurs',
      '611.2 – Photographes & vidéastes',
      '611.3 – Hôtesses & personnel événementiel',
    ],
  },
  { group: 'Restauration & accueil',
    options: [
      '625.1 – Traiteur & restauration',
      '625.2 – Boissons & cocktails',
      '625 – Autres réceptions & réunions',
    ],
  },
  { group: 'Communication & marketing',
    options: [
      '623.1 – Publicité digitale & réseaux sociaux',
      '623.2 – Affiches, flyers & signalétique',
      '623.3 – Relations presse & influenceurs',
      '623 – Autres dépenses communication',
    ],
  },
  { group: 'Frais généraux',
    options: [
      '622 – Honoraires comptables & juridiques',
      '616 – Primes d’assurance événement',
      '626 – Frais postaux & télécommunications',
      '627 – Services bancaires & commissions',
      '625.3 – Déplacements équipe',
      '606 – Fournitures & petits équipements',
    ],
  },
  { group: 'Personnel',
    options: [
      '641 – Rémunérations du personnel',
      '645 – Charges sociales & cotisations patronales',
      '421 – Notes de frais du personnel',
    ],
  },
  { group: 'Impôts, amortissements & exceptionnel',
    options: [
      '635 – Autres impôts, taxes & versements assimilés',
      '695 – Impôt sur les bénéfices (IS)',
      '681 – Dotations aux amortissements',
      '671 – Charges exceptionnelles',
    ],
  },
  { group: 'Opérations financières & internes',
    options: [
      '108 – Prélèvements de l’exploitant',
      '164 – Remboursement d’emprunt',
      '455 – Remboursement compte courant associé',
      '58 – Virement interne entre comptes',
    ],
  },
])

// ── Commerce / Retail ─────────────────────────────────────────────────────────

const COMMERCE_ENTREES = opts([
  { group: 'Ventes',
    options: [
      '707 – Ventes de marchandises',
      '707.1 – Ventes en magasin',
      '707.2 – Ventes en ligne (e-commerce)',
      '701 – Ventes de produits finis',
      '708 – Prestations de services annexes',
    ],
  },
  { group: 'Remises & Avoirs',
    options: [
      '709 – Avoirs & remboursements clients',
      '409 – Avoirs fournisseurs reçus',
    ],
  },
  { group: 'Autres produits',
    options: [
      '74 – Subventions d’exploitation',
      '75 – Autres produits de gestion courante',
      '76 – Produits financiers',
      '77 – Produits exceptionnels',
    ],
  },
  { group: 'Financement & opérations internes',
    options: [
      '101 – Capital social (apport)',
      '108 – Apport de l’exploitant',
      '164 – Emprunts bancaires reçus',
      '455 – Avances en compte courant associé',
      '58 – Virement interne entre comptes',
    ],
  },
])

const COMMERCE_SORTIES = opts([
  { group: 'Achats de marchandises',
    options: [
      '607 – Achats de marchandises',
      '607.1 – Achats fournisseurs import',
      '607.2 – Achats en circuit court / local',
      '604 – Achats de prestations de services',
      '606 – Fournitures & petits équipements',
    ],
  },
  { group: 'Logistique & transport',
    options: [
      '624 – Transport de marchandises',
      '624.1 – Frais de port & livraison clients',
      '624.2 – Stockage & entreposage',
    ],
  },
  { group: 'Local commercial',
    options: [
      '613 – Loyer & charges locatives',
      '615 – Entretien & réparations du local',
      '606.1 – Matériel de caisse & displays',
    ],
  },
  { group: 'Personnel',
    options: [
      '641 – Rémunérations du personnel',
      '645 – Charges sociales & cotisations patronales',
      '648 – Tickets-restaurant & avantages',
      '421 – Notes de frais du personnel',
      '631 – Impôts & taxes sur rémunérations',
    ],
  },
  { group: 'Marketing & communication',
    options: [
      '623.1 – Publicité digitale & réseaux sociaux',
      '623.2 – Vitrine & signalétique',
      '623 – Autres dépenses publicité & communication',
    ],
  },
  { group: 'Frais généraux',
    options: [
      '622 – Honoraires comptables & juridiques',
      '616 – Primes d’assurance',
      '618 – Abonnements & frais informatiques',
      '626 – Frais postaux & télécommunications',
      '627 – Services bancaires & commissions',
      '625 – Déplacements, missions & réceptions',
    ],
  },
  { group: 'Impôts, amortissements & exceptionnel',
    options: [
      '635 – Autres impôts, taxes & versements assimilés',
      '695 – Impôt sur les bénéfices (IS)',
      '681 – Dotations aux amortissements',
      '671 – Charges exceptionnelles',
    ],
  },
  { group: 'Opérations financières & internes',
    options: [
      '108 – Prélèvements de l’exploitant',
      '164 – Remboursement d’emprunt',
      '455 – Remboursement compte courant associé',
      '58 – Virement interne entre comptes',
    ],
  },
])

// ── Formation ─────────────────────────────────────────────────────────────────

const FORMATION_ENTREES = opts([
  { group: 'Formations',
    options: [
      '706 – Prestations de formation',
      '706.1 – Formations intra-entreprise',
      '706.2 – Formations inter-entreprises',
      '706.3 – E-learning & formations en ligne',
      '706.4 – Certifications & passages d’examens',
    ],
  },
  { group: 'Financement formation',
    options: [
      '74.1 – Prise en charge OPCO',
      '74.2 – Fonds CPF',
      '74 – Autres subventions d’exploitation',
    ],
  },
  { group: 'Autres produits',
    options: [
      '708 – Ventes de supports & matériaux pédagogiques',
      '708.1 – Livres & e-books',
      '75 – Autres produits de gestion courante',
      '76 – Produits financiers',
      '77 – Produits exceptionnels',
      '409 – Avoirs fournisseurs reçus',
      '709 – Avoirs & remboursements clients',
    ],
  },
  { group: 'Financement & opérations internes',
    options: [
      '101 – Capital social (apport)',
      '108 – Apport de l’exploitant',
      '164 – Emprunts bancaires reçus',
      '455 – Avances en compte courant associé',
      '58 – Virement interne entre comptes',
    ],
  },
])

const FORMATION_SORTIES = opts([
  { group: 'Lieu de formation',
    options: [
      '613 – Location de salle de formation',
      '613.1 – Hébergement des stagiaires',
      '615 – Entretien & réparations des locaux',
    ],
  },
  { group: 'Matériel & ressources pédagogiques',
    options: [
      '606 – Supports de cours & matériel pédagogique',
      '618 – Plateformes e-learning & LMS',
      '618.1 – Outils de visio & collaboration',
      '2052 – Développement de contenus digitaux',
    ],
  },
  { group: 'Formateurs & experts',
    options: [
      '622 – Honoraires formateurs externes',
      '611 – Sous-traitance pédagogique',
    ],
  },
  { group: 'Déplacements & accueil',
    options: [
      '625.1 – Transport des formateurs',
      '625.2 – Restauration & pauses café',
      '625 – Autres déplacements, missions & réceptions',
    ],
  },
  { group: 'Marketing & communication',
    options: [
      '623 – Communication & promotion des formations',
      '623.1 – Publicité digitale',
    ],
  },
  { group: 'Frais généraux',
    options: [
      '622.1 – Honoraires comptables & juridiques',
      '616 – Primes d’assurance (RC pro)',
      '626 – Frais postaux & télécommunications',
      '627 – Services bancaires & commissions',
      '641 – Rémunérations du personnel',
      '645 – Charges sociales & cotisations patronales',
    ],
  },
  { group: 'Impôts, amortissements & exceptionnel',
    options: [
      '635 – Autres impôts, taxes & versements assimilés',
      '695 – Impôt sur les bénéfices (IS)',
      '681 – Dotations aux amortissements',
      '671 – Charges exceptionnelles',
    ],
  },
  { group: 'Opérations financières & internes',
    options: [
      '108 – Prélèvements de l’exploitant',
      '164 – Remboursement d’emprunt',
      '455 – Remboursement compte courant associé',
      '58 – Virement interne entre comptes',
    ],
  },
])

// ── Immobilier ────────────────────────────────────────────────────────────────

const IMMOBILIER_ENTREES = opts([
  { group: 'Revenus locatifs',
    options: [
      '708.1 – Loyers bruts (résidentiel)',
      '708.2 – Loyers bruts (commercial)',
      '708.3 – Charges locatives récupérées',
      '708.4 – Revenus location courte durée (Airbnb…)',
    ],
  },
  { group: 'Honoraires & gestion',
    options: [
      '706 – Honoraires de gestion locative',
      '706.1 – Honoraires de transaction',
      '706.2 – Honoraires de syndic',
    ],
  },
  { group: 'Autres produits',
    options: [
      '77 – Plus-values & produits exceptionnels',
      '74 – Subventions (ANAH, rénovation…)',
      '75 – Autres produits de gestion courante',
      '76 – Produits financiers',
      '409 – Avoirs fournisseurs reçus',
      '709 – Avoirs & remboursements clients',
    ],
  },
  { group: 'Financement & opérations internes',
    options: [
      '101 – Capital social (apport)',
      '108 – Apport de l’exploitant',
      '164 – Emprunts bancaires reçus',
      '455 – Avances en compte courant associé',
      '58 – Virement interne entre comptes',
    ],
  },
])

const IMMOBILIER_SORTIES = opts([
  { group: 'Travaux & entretien',
    options: [
      '615 – Entretien & réparations courantes',
      '615.1 – Travaux de rénovation',
      '615.2 – Ravalement & gros entretien',
      '606 – Fournitures & petits travaux',
    ],
  },
  { group: 'Charges de bien',
    options: [
      '613.1 – Charges de copropriété',
      '616 – Assurance propriétaire non-occupant (PNO)',
      '616.1 – Assurance loyers impayés (GLI)',
      '635.1 – Taxe foncière',
      '635.2 – CFE & taxes locales',
    ],
  },
  { group: 'Financement',
    options: [
      '661 – Intérêts d’emprunt immobilier',
      '627 – Frais bancaires & garanties',
    ],
  },
  { group: 'Honoraires & gestion',
    options: [
      '622 – Honoraires comptables & juridiques',
      '622.1 – Honoraires agence de gestion',
      '622.2 – Honoraires notaires & avocats',
    ],
  },
  { group: 'Amortissements & frais d’acquisition',
    options: [
      '213 – Immobilisations — bâtiments',
      '681 – Dotations aux amortissements (composants)',
      '201 – Frais d’acte & frais d’établissement',
    ],
  },
  { group: 'Frais généraux',
    options: [
      '626 – Frais postaux & télécommunications',
      '618 – Logiciels de gestion locative',
      '625 – Déplacements & visites',
      '641 – Rémunérations du personnel',
      '645 – Charges sociales & cotisations patronales',
    ],
  },
  { group: 'Impôts & exceptionnel',
    options: [
      '635 – Autres impôts & taxes',
      '695 – Impôt sur les bénéfices (IS)',
      '671 – Charges exceptionnelles',
      '675 – Valeurs comptables des éléments cédés',
    ],
  },
  { group: 'Opérations financières & internes',
    options: [
      '108 – Prélèvements de l’exploitant',
      '164 – Remboursement d’emprunt',
      '455 – Remboursement compte courant associé',
      '58 – Virement interne entre comptes',
    ],
  },
])

// ── Générique (fallback) ──────────────────────────────────────────────────────

const GENERIC_ENTREES = opts([
  { group: 'Chiffre d\'affaires',
    options: [
      '706 – Prestations de services',
      '701 – Ventes de produits finis',
      '707 – Ventes de marchandises',
      '708 – Produits des activités annexes',
    ],
  },
  { group: 'Subventions & autres produits',
    options: [
      '74 – Subventions d’exploitation',
      '75 – Autres produits de gestion courante',
      '76 – Produits financiers',
      '77 – Produits exceptionnels',
      '409 – Avoirs fournisseurs reçus',
      '709 – Avoirs & remboursements clients',
    ],
  },
  { group: 'Financement & opérations internes',
    options: [
      '101 – Capital social (apport)',
      '108 – Apport de l’exploitant',
      '164 – Emprunts bancaires reçus',
      '455 – Avances en compte courant associé',
      '58 – Virement interne entre comptes',
    ],
  },
])

const GENERIC_SORTIES = opts([
  { group: 'Achats & sous-traitance',
    options: [
      '604 – Achats de prestations de services',
      '606 – Fournitures & petits équipements',
      '607 – Achats de marchandises',
      '611 – Sous-traitance générale',
    ],
  },
  { group: 'Charges externes',
    options: [
      '613 – Locations & charges locatives',
      '615 – Entretien & réparations',
      '616 – Primes d’assurance',
      '618 – Abonnements & frais informatiques',
      '622 – Honoraires & rémunérations intermédiaires',
      '623 – Publicité & communication',
      '624 – Transports de biens',
      '625 – Déplacements, missions & réceptions',
      '626 – Frais postaux & télécommunications',
      '627 – Services bancaires & commissions',
    ],
  },
  { group: 'Personnel',
    options: [
      '641 – Rémunérations du personnel',
      '645 – Charges sociales & cotisations patronales',
      '421 – Notes de frais du personnel',
      '631 – Impôts & taxes sur rémunérations',
    ],
  },
  { group: 'Impôts, amortissements & exceptionnel',
    options: [
      '635 – Autres impôts, taxes & versements assimilés',
      '695 – Impôt sur les bénéfices (IS)',
      '681 – Dotations aux amortissements',
      '661 – Charges d’intérêts',
      '671 – Charges exceptionnelles',
    ],
  },
  { group: 'Opérations financières & internes',
    options: [
      '108 – Prélèvements de l’exploitant',
      '164 – Remboursement d’emprunt',
      '455 – Remboursement compte courant associé',
      '58 – Virement interne entre comptes',
    ],
  },
])

// ── Export ────────────────────────────────────────────────────────────────────

const CAT_BY_ACTIVITE = {
  saas:         { entrees: SAAS_ENTREES,         sorties: SAAS_SORTIES },
  conseil:      { entrees: CONSEIL_ENTREES,      sorties: CONSEIL_SORTIES },
  evenementiel: { entrees: EVENEMENTIEL_ENTREES, sorties: EVENEMENTIEL_SORTIES },
  commerce:     { entrees: COMMERCE_ENTREES,     sorties: COMMERCE_SORTIES },
  formation:    { entrees: FORMATION_ENTREES,    sorties: FORMATION_SORTIES },
  immobilier:   { entrees: IMMOBILIER_ENTREES,   sorties: IMMOBILIER_SORTIES },
}

export function getCatEntrees(activite_type) {
  return CAT_BY_ACTIVITE[activite_type]?.entrees ?? GENERIC_ENTREES
}

export function getCatSorties(activite_type) {
  return CAT_BY_ACTIVITE[activite_type]?.sorties ?? GENERIC_SORTIES
}
