/**
 * Shared validation and calculation utilities for factures and depenses routes.
 */

const VALID_TAUX_TVA = [0, 2.1, 5.5, 10, 20];
const VALID_STATUTS  = ['payee', 'en_attente'];
const MULTI_TAUX_SENTINEL = -1;

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Validate a single taux_tva value.
 * allowSentinel=true permits -1 (used internally when merging existing multi-TVA rows).
 */
function validateTaux(taux_tva, { allowSentinel = false } = {}) {
  if (taux_tva === undefined) return;
  const n = Number(taux_tva);
  if (allowSentinel && n === MULTI_TAUX_SENTINEL) return;
  if (!VALID_TAUX_TVA.includes(n)) {
    const err = new Error(`taux_tva invalide. Valeurs acceptées : ${VALID_TAUX_TVA.join(', ')}`);
    err.status = 400;
    throw err;
  }
}

function validateStatut(statut) {
  if (statut && !VALID_STATUTS.includes(statut)) {
    const err = new Error(`statut invalide. Valeurs acceptées : ${VALID_STATUTS.join(', ')}`);
    err.status = 400;
    throw err;
  }
}

function computeAmounts(montant_ht, taux_tva) {
  const ht  = round2(Number(montant_ht));
  const tva = round2(ht * Number(taux_tva) / 100);
  const ttc = round2(ht + tva);
  return { montant_ht: ht, taux_tva: Number(taux_tva), montant_tva: tva, montant_ttc: ttc };
}

const MAX_TVA_LINES = 50;

function computeAmountsFromLines(lines) {
  if (!Array.isArray(lines) || lines.length === 0) {
    const err = new Error('lines doit être un tableau non vide');
    err.status = 400;
    throw err;
  }
  if (lines.length > MAX_TVA_LINES) {
    const err = new Error(`Nombre maximum de lignes TVA dépassé (max ${MAX_TVA_LINES})`);
    err.status = 400;
    throw err;
  }

  const processedLines = [];
  let totalHt = 0;
  let totalTva = 0;

  for (const line of lines) {
    const { taux_tva, montant_ht } = line;

    if (!VALID_TAUX_TVA.includes(Number(taux_tva))) {
      const err = new Error(`taux_tva invalide dans une ligne. Valeurs acceptées : ${VALID_TAUX_TVA.join(', ')}`);
      err.status = 400;
      throw err;
    }

    const ht = Number(montant_ht);
    if (isNaN(ht) || !isFinite(ht)) {
      const err = new Error('montant_ht invalide dans une ligne');
      err.status = 400;
      throw err;
    }

    const montantHt = round2(ht);
    const montantTva = round2(montantHt * Number(taux_tva) / 100);

    processedLines.push({
      taux_tva: Number(taux_tva),
      montant_ht: montantHt,
      montant_tva: montantTva
    });

    totalHt += montantHt;
    totalTva += montantTva;
  }

  const montantTtc = round2(totalHt + totalTva);

  return {
    taux_tva: MULTI_TAUX_SENTINEL,
    montant_ht: round2(totalHt),
    montant_tva: round2(totalTva),
    montant_ttc: montantTtc,
    tva_lines: JSON.stringify(processedLines)
  };
}

module.exports = { VALID_TAUX_TVA, VALID_STATUTS, round2, validateTaux, validateStatut, computeAmounts, MULTI_TAUX_SENTINEL, computeAmountsFromLines };
