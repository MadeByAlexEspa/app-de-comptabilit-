const { Router } = require('express');
const { getWorkspaceDb } = require('../db/database');
const { decryptRows, FACTURE_FIELDS, DEPENSE_FIELDS } = require('../services/cryptoService');

const router = Router();
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validateDate(val, name, res) {
  if (!val) return true;
  if (!DATE_RE.test(val)) {
    res.status(400).json({ error: `Format de date invalide pour "${name}". Attendu : YYYY-MM-DD` });
    return false;
  }
  const d = new Date(val);
  if (isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== val) {
    res.status(400).json({ error: `Date inexistante pour "${name}" : ${val}` });
    return false;
  }
  return true;
}

// ── GET /api/transactions ─────────────────────────────────────────────────────
// Paramètres :
//   categorie  (string)  – filtre par catégorie PCG dans factures + dépenses
//   filtre     (string)  – filtre spécial : "creances_clients" | "dettes_fournisseurs"
//   debut      (date)    – borne basse (optionnelle)
//   fin        (date)    – borne haute (optionnelle)
router.get('/', (req, res, next) => {
  try {
    const db = getWorkspaceDb(req.user.workspaceId);
    const { categorie, filtre, debut, fin } = req.query;

    if (!categorie && !filtre) {
      return res.status(400).json({ error: 'Paramètre "categorie" ou "filtre" requis' });
    }
    if (!validateDate(debut, 'debut', res)) return;
    if (!validateDate(fin,   'fin',   res)) return;

    let factures = [], depenses = [];

    const ALLOWED_TABLES = new Set(['factures', 'depenses']);
    function query(table, conditions, params) {
      if (!ALLOWED_TABLES.has(table)) throw new Error(`Table non autorisée : ${table}`);
      const sql = `SELECT * FROM ${table} WHERE ${conditions.join(' AND ')} ORDER BY date DESC`;
      return db.prepare(sql).all(params);
    }

    if (categorie) {
      const conds  = ['categorie = ?'];
      const params = [categorie];
      if (debut) { conds.push('date >= ?'); params.push(debut); }
      if (fin)   { conds.push('date <= ?'); params.push(fin); }

      factures = query('factures', conds, params);
      depenses = query('depenses', conds, params);

    } else if (filtre === 'creances_clients') {
      const conds  = ["statut = 'en_attente'"];
      const params = [];
      if (fin) { conds.push('date <= ?'); params.push(fin); }
      factures = query('factures', conds, params);

    } else if (filtre === 'dettes_fournisseurs') {
      const conds  = ["statut = 'en_attente'"];
      const params = [];
      if (fin) { conds.push('date <= ?'); params.push(fin); }
      depenses = query('depenses', conds, params);

    } else {
      return res.status(400).json({ error: `Filtre inconnu : "${filtre}"` });
    }

    res.json({
      factures: decryptRows(factures, FACTURE_FIELDS, req.user.workspaceId),
      depenses: decryptRows(depenses, DEPENSE_FIELDS, req.user.workspaceId),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
