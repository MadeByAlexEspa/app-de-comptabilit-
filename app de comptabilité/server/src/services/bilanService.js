const db = require('../db/database');

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Bilan simplifié conforme PCG (règlement ANC n°2014-03, art. 821-1).
 *
 * Actif :
 *   - 41  Créances clients     : factures en_attente (TTC) à la date d'arrêté
 *   - 44566 TVA déductible     : crédit de TVA cumulé si TVA déductible > collectée
 *   - 512 Disponibilités       : encaissements payés − décaissements payés (si > 0)
 *
 * Passif :
 *   - 12  Résultat de l'exercice : revenus HT − charges HT depuis le 1er janvier
 *   - 40  Dettes fournisseurs    : dépenses en_attente (TTC) à la date d'arrêté
 *   - 44551 TVA à décaisser      : TVA nette à reverser (si collectée > déductible)
 *   - 564 Découvert bancaire     : si disponibilités négatives → passé en passif
 *
 * @param {string} date - "YYYY-MM-DD"
 */
function getBilanReport(date) {
  const annee = date.slice(0, 4);
  const debutExercice = `${annee}-01-01`;

  // ── Créances clients (41) ─────────────────────────────────────────────────
  const creancesRow = db
    .prepare(`SELECT COALESCE(SUM(montant_ttc), 0) AS total FROM factures WHERE statut = 'en_attente' AND date <= ?`)
    .get(date);

  // ── Trésorerie brute (512) ────────────────────────────────────────────────
  const factPayeesRow = db
    .prepare(`SELECT COALESCE(SUM(montant_ttc), 0) AS total FROM factures WHERE statut = 'payee' AND date <= ?`)
    .get(date);

  const depPayeesRow = db
    .prepare(`SELECT COALESCE(SUM(montant_ttc), 0) AS total FROM depenses WHERE statut = 'payee' AND date <= ?`)
    .get(date);

  // ── Dettes fournisseurs (40) ──────────────────────────────────────────────
  const dettesRow = db
    .prepare(`SELECT COALESCE(SUM(montant_ttc), 0) AS total FROM depenses WHERE statut = 'en_attente' AND date <= ?`)
    .get(date);

  // ── TVA cumulée jusqu'à la date ───────────────────────────────────────────
  const tvaCollecteeRow = db
    .prepare(`SELECT COALESCE(SUM(montant_tva), 0) AS total FROM factures WHERE date <= ?`)
    .get(date);

  const tvaDeductibleRow = db
    .prepare(`SELECT COALESCE(SUM(montant_tva), 0) AS total FROM depenses WHERE date <= ?`)
    .get(date);

  // ── Résultat de l'exercice (12) ───────────────────────────────────────────
  const revenusRow = db
    .prepare(`SELECT COALESCE(SUM(montant_ht), 0) AS total FROM factures WHERE date >= ? AND date <= ?`)
    .get(debutExercice, date);

  const chargesRow = db
    .prepare(`SELECT COALESCE(SUM(montant_ht), 0) AS total FROM depenses WHERE date >= ? AND date <= ?`)
    .get(debutExercice, date);

  // ── Calculs ───────────────────────────────────────────────────────────────
  const creancesClients    = round2(creancesRow.total);
  const tresorerieBrute    = round2(factPayeesRow.total - depPayeesRow.total);
  const dettesFournisseurs = round2(dettesRow.total);
  const resultatExercice   = round2(revenusRow.total - chargesRow.total);

  const tvaCollectee  = round2(tvaCollecteeRow.total);
  const tvaDeductible = round2(tvaDeductibleRow.total);
  const soldetva      = round2(tvaCollectee - tvaDeductible);

  // Position TVA : crédit (actif 44567) ou à décaisser (passif 44551)
  const creditTva       = round2(Math.max(0, -soldetva));
  const tvaADecaisser   = round2(Math.max(0,  soldetva));

  // Trésorerie positive → actif 512 ; négative → découvert passif 564
  const disponibilites  = round2(Math.max(0,  tresorerieBrute));
  const decouvert       = round2(Math.max(0, -tresorerieBrute));

  const totalActif  = round2(creancesClients + creditTva + disponibilites);
  const totalPassif = round2(resultatExercice + dettesFournisseurs + tvaADecaisser + decouvert);

  return {
    date,
    actif: {
      creances_clients: creancesClients,   // 41
      credit_tva:       creditTva,          // 44567
      disponibilites:   disponibilites,     // 512
      total:            totalActif,
    },
    passif: {
      resultat_exercice:   resultatExercice,   // 12
      dettes_fournisseurs: dettesFournisseurs, // 40
      tva_a_decaisser:     tvaADecaisser,      // 44551
      decouvert:           decouvert,           // 564
      total:               totalPassif,
    },
  };
}

module.exports = { getBilanReport };
