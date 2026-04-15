/**
 * Shared validation and calculation utilities for factures and depenses routes.
 */

const VALID_TAUX_TVA = [0, 2.1, 5.5, 10, 20];
const VALID_STATUTS  = ['payee', 'en_attente'];

function round2(n) {
  return Math.round(n * 100) / 100;
}

function validateTaux(taux_tva) {
  if (taux_tva !== undefined && !VALID_TAUX_TVA.includes(Number(taux_tva))) {
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

module.exports = { VALID_TAUX_TVA, VALID_STATUTS, round2, validateTaux, validateStatut, computeAmounts };
