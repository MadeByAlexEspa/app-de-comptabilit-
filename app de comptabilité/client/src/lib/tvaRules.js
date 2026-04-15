/**
 * Règles de TVA par catégorie PCG
 * Sources légales : CGI art. 256, 261, 278, 279, 293 B
 */

// Catégories hors champ ou exonérées de TVA → taux forcé à 0 %, non modifiable
export const CATEGORIES_HORS_TVA = new Set([
  // Entrées — Capitaux propres & financement (Classe 1)
  '101 \u2013 Capital social (apport)',
  '108 \u2013 Apport de l\u2019exploitant',
  '164 \u2013 Emprunts bancaires re\u00e7us',
  '455 \u2013 Avances en compte courant associ\u00e9',
  // Entrées — Subventions & produits financiers
  '74 \u2013 Subventions d\u2019exploitation',
  '76 \u2013 Produits financiers',
  '77 \u2013 Produits exceptionnels',
  // Sorties — Personnel (hors champ TVA)
  '641 \u2013 R\u00e9mun\u00e9rations du personnel',
  '645 \u2013 Charges sociales & cotisations',
  '421 \u2013 Notes de frais du personnel',
  // Sorties — Impôts & taxes (hors champ TVA)
  '631 \u2013 Imp\u00f4ts, taxes et versements assimil\u00e9s sur r\u00e9mun\u00e9rations',
  '635 \u2013 Autres imp\u00f4ts, taxes et versements assimil\u00e9s',
  // Sorties — Charges financières (exonérées CGI art. 261 C)
  '661 \u2013 Charges d\u2019int\u00e9r\u00eats',
  '668 \u2013 Autres charges financi\u00e8res',
  '671 \u2013 Charges exceptionnelles sur op\u00e9rations de gestion',
  '675 \u2013 Valeurs comptables des \u00e9l\u00e9ments c\u00e9d\u00e9s',
  // Sorties — Impôt sur les bénéfices
  '695 \u2013 Imp\u00f4t sur les b\u00e9n\u00e9fices (IS)',
  // Sorties — Dotations aux amortissements (écriture comptable, sans flux TVA)
  '681 \u2013 Dotations aux amortissements d\u2019exploitation',
  // Sorties — Remboursements & prélèvements (Classe 1)
  '108 \u2013 Pr\u00e9l\u00e8vements de l\u2019exploitant',
  '164 \u2013 Remboursement d\u2019emprunt',
  '455 \u2013 Remboursement compte courant associ\u00e9',
  // Sorties — Services bancaires & assurances (exonérés CGI art. 261 C)
  '627 \u2013 Services bancaires & assimil\u00e9s',
  '616 \u2013 Primes d\u2019assurance',
  // Virements internes (Classe 5)
  '58 \u2013 Virement interne entre comptes',
])

// Taux par défaut par catégorie quand soumis à TVA (CGI art. 279 et 278 bis)
export const TAUX_DEFAUT_PAR_CATEGORIE = {
  '624 \u2013 Transports de biens':                          10,
  '625 \u2013 D\u00e9placements, missions & r\u00e9ceptions': 10,
}

/**
 * Retourne le régime TVA d'une catégorie PCG.
 * @returns {{ taux: number, locked: boolean }}
 *   locked = true  → hors champ / exonéré, taux forcé à 0 %
 *   locked = false → taux suggéré (modifiable par l'utilisateur)
 */
export function getTvaRegime(categorie) {
  if (CATEGORIES_HORS_TVA.has(categorie)) return { taux: 0, locked: true }
  const taux = TAUX_DEFAUT_PAR_CATEGORIE[categorie] ?? 20
  return { taux, locked: false }
}

/**
 * Construit le patch de champs TVA à envoyer au backend
 * quand la catégorie change.
 *
 * Règles :
 *  - nouvelle catégorie exonérée          → taux_tva = 0  (TTC = HT)
 *  - ancienne exonérée → nouvelle taxable → taux_tva = taux par défaut
 *    (le montant HT reste inchangé, le backend recalcule TVA et TTC)
 *  - taxable → taxable                    → pas de changement de taux
 *
 * @param {string} oldCategorie
 * @param {string} newCategorie
 * @returns {{ categorie: string, taux_tva?: number }}
 */
export function buildCategoriePatch(oldCategorie, newCategorie) {
  const patch = { categorie: newCategorie }
  const oldRegime = getTvaRegime(oldCategorie)
  const newRegime = getTvaRegime(newCategorie)

  if (newRegime.locked) {
    // → exonéré : TVA = 0, TTC = HT
    patch.taux_tva = 0
  } else if (oldRegime.locked && !newRegime.locked) {
    // → était exonéré, devient taxable : appliquer le taux par défaut
    patch.taux_tva = newRegime.taux
  }

  return patch
}
