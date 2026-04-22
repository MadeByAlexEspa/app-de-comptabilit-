const { Router } = require('express');
const { getWorkspaceDb } = require('../db/database');
const { decryptRows, FACTURE_FIELDS, DEPENSE_FIELDS } = require('../services/cryptoService');

const router = Router();

function round2(n) {
  return Math.round(n * 100) / 100;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonth() {
  return today().slice(0, 7);
}

function startOfYear() {
  return `${today().slice(0, 4)}-01-01`;
}

router.get('/', (req, res, next) => {
  try {
    const db = getWorkspaceDb(req.user.workspaceId);
    const wid     = req.user.workspaceId;
    const mois    = currentMonth();
    const todayStr = today();
    const janFirst = startOfYear();

    const allFactures = decryptRows(
      db.prepare('SELECT * FROM factures').all(),
      FACTURE_FIELDS, wid
    );
    const allDepenses = decryptRows(
      db.prepare('SELECT * FROM depenses').all(),
      DEPENSE_FIELDS, wid
    );

    let caHtMois = 0, chargesHtMois = 0, tvaCollecteeMois = 0, tvaDeductibleMois = 0;
    let revenusYtd = 0, chargesYtd = 0;
    let facturesEnAttente = 0, depensesEnAttente = 0;

    for (const r of allFactures) {
      const rowMois = r.date ? r.date.slice(0, 7) : '';
      if (rowMois === mois) {
        caHtMois          = round2(caHtMois          + (r.montant_ht  || 0));
        tvaCollecteeMois  = round2(tvaCollecteeMois  + (r.montant_tva || 0));
      }
      if (r.date >= janFirst && r.date <= todayStr) {
        revenusYtd = round2(revenusYtd + (r.montant_ht || 0));
      }
      if (r.statut === 'en_attente') facturesEnAttente++;
    }

    for (const r of allDepenses) {
      const rowMois = r.date ? r.date.slice(0, 7) : '';
      if (rowMois === mois) {
        chargesHtMois     = round2(chargesHtMois     + (r.montant_ht  || 0));
        tvaDeductibleMois = round2(tvaDeductibleMois + (r.montant_tva || 0));
      }
      if (r.date >= janFirst && r.date <= todayStr) {
        chargesYtd = round2(chargesYtd + (r.montant_ht || 0));
      }
      if (r.statut === 'en_attente') depensesEnAttente++;
    }

    res.json({
      ca_ht_mois:           caHtMois,
      charges_ht_mois:      chargesHtMois,
      tva_due_mois:         round2(tvaCollecteeMois - tvaDeductibleMois),
      resultat_ytd:         round2(revenusYtd - chargesYtd),
      factures_en_attente:  facturesEnAttente,
      depenses_en_attente:  depensesEnAttente,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
