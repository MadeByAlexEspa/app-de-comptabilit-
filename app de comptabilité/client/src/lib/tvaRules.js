/**
 * Règles de TVA par catégorie PCG
 * Sources légales : CGI art. 256, 261, 278, 279, 293 B
 *
 * Matching par préfixe de code PCG (ex: '627', '74', '58')
 * → couvre les sous-codes 625.1, 706.3, 741, etc. automatiquement.
 */

// Codes PCG hors champ ou exonérés de TVA → taux forcé à 0 %, non modifiable
const CODES_HORS_TVA = new Set([
  // Capitaux propres & financement (Classe 1)
  '101', '108', '164', '455',
  // Subventions & produits financiers / exceptionnels
  '74', '76', '77',
  // Personnel (hors champ TVA)
  '641', '645', '421',
  // Impôts & taxes (hors champ TVA)
  '631', '635',
  // Charges financières (exonérées CGI art. 261 C)
  '661', '668', '671', '675',
  // Impôt sur les bénéfices
  '695',
  // Dotations aux amortissements (écriture comptable sans flux TVA)
  '681',
  // Services bancaires & assurances (exonérés CGI art. 261 C)
  '627', '616',
  // Virements internes (Classe 5)
  '58',
])

// Taux par défaut par code PCG de base quand soumis à TVA (CGI art. 279 et 278 bis)
const TAUX_DEFAUT_PAR_CODE = {
  '624': 10,
  '625': 10,
}

function extractCode(categorie) {
  return String(categorie || '').match(/^(\d+(?:\.\d+)?)/)?.[1] ?? null
}

function isHorsTVA(code) {
  if (!code) return false
  if (CODES_HORS_TVA.has(code)) return true
  // check base code (e.g. '741' → '74', '625.1' → '625' → not hors-TVA, but '74.1' → '74' → hors-TVA)
  const base = code.includes('.') ? code.split('.')[0] : code.replace(/\d$/, '')
  // walk prefix from longest to shortest until 2 digits
  for (let len = code.length; len >= 2; len--) {
    const prefix = code.slice(0, len)
    if (CODES_HORS_TVA.has(prefix)) return true
  }
  return false
}

function getTauxDefaut(code) {
  if (!code) return 20
  // exact match first
  if (TAUX_DEFAUT_PAR_CODE[code] != null) return TAUX_DEFAUT_PAR_CODE[code]
  // base code (strip sub-code)
  const base = code.split('.')[0]
  return TAUX_DEFAUT_PAR_CODE[base] ?? 20
}

/**
 * Retourne le régime TVA d'une catégorie PCG.
 * @returns {{ taux: number, locked: boolean }}
 *   locked = true  → hors champ / exonéré, taux forcé à 0 %
 *   locked = false → taux suggéré (modifiable par l'utilisateur)
 */
export function getTvaRegime(categorie) {
  const code = extractCode(categorie)
  if (isHorsTVA(code)) return { taux: 0, locked: true }
  return { taux: getTauxDefaut(code), locked: false }
}

/**
 * Construit le patch de champs TVA à envoyer au backend
 * quand la catégorie change.
 *
 * Règles :
 *  - nouvelle catégorie exonérée          → taux_tva = 0  (TTC = HT)
 *  - ancienne exonérée → nouvelle taxable → taux_tva = taux par défaut
 *  - taxable → taxable                    → pas de changement de taux
 */
export function buildCategoriePatch(oldCategorie, newCategorie) {
  const patch = { categorie: newCategorie }
  const oldRegime = getTvaRegime(oldCategorie)
  const newRegime = getTvaRegime(newCategorie)

  if (newRegime.locked) {
    patch.taux_tva = 0
  } else if (oldRegime.locked && !newRegime.locked) {
    patch.taux_tva = newRegime.taux
  }

  return patch
}
