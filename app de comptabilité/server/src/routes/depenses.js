const { Router } = require('express');
const { getWorkspaceDb } = require('../db/database');
const { validateTaux, validateStatut, computeAmounts } = require('../utils/entryUtils');
const { encryptRow, decryptRow, decryptRows, DEPENSE_FIELDS } = require('../services/cryptoService');

const router = Router();

function parseBody(body, requireAll = true) {
  const {
    date,
    fournisseur,
    description = '',
    montant_ht,
    taux_tva,
    categorie,
    statut = 'en_attente',
  } = body;

  if (requireAll) {
    const missing = [];
    if (!date)                     missing.push('date');
    if (!fournisseur)              missing.push('fournisseur');
    if (montant_ht === undefined)  missing.push('montant_ht');
    if (taux_tva === undefined)    missing.push('taux_tva');
    if (!categorie)                missing.push('categorie');

    if (missing.length) {
      const err = new Error(`Champs obligatoires manquants : ${missing.join(', ')}`);
      err.status = 400;
      throw err;
    }
  }

  validateTaux(taux_tva);
  validateStatut(statut);

  return {
    date,
    fournisseur,
    description,
    ...computeAmounts(montant_ht, taux_tva),
    categorie,
    statut,
  };
}

router.get('/', (req, res, next) => {
  try {
    const db = getWorkspaceDb(req.user.workspaceId);
    const { mois } = req.query;

    let rows;
    if (mois) {
      rows = db.prepare(`SELECT * FROM depenses WHERE strftime('%Y-%m', date) = ? ORDER BY date DESC`).all(mois);
    } else {
      rows = db.prepare('SELECT * FROM depenses ORDER BY date DESC').all();
    }

    res.json(decryptRows(rows, DEPENSE_FIELDS, req.user.workspaceId));
  } catch (err) {
    next(err);
  }
});

router.get('/:id', (req, res, next) => {
  try {
    const db = getWorkspaceDb(req.user.workspaceId);
    const row = db.prepare('SELECT * FROM depenses WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Dépense introuvable' });
    res.json(decryptRow(row, DEPENSE_FIELDS, req.user.workspaceId));
  } catch (err) {
    next(err);
  }
});

router.post('/', (req, res, next) => {
  try {
    const db = getWorkspaceDb(req.user.workspaceId);
    const data = parseBody(req.body, true);
    const encrypted = encryptRow(data, DEPENSE_FIELDS, req.user.workspaceId);

    const result = db.prepare(`
      INSERT INTO depenses (date, fournisseur, description, montant_ht, taux_tva, montant_tva, montant_ttc, categorie, statut)
      VALUES (@date, @fournisseur, @description, @montant_ht, @taux_tva, @montant_tva, @montant_ttc, @categorie, @statut)
    `).run(encrypted);

    const created = db.prepare('SELECT * FROM depenses WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(decryptRow(created, DEPENSE_FIELDS, req.user.workspaceId));
  } catch (err) {
    next(err);
  }
});

router.put('/:id', (req, res, next) => {
  try {
    const db = getWorkspaceDb(req.user.workspaceId);
    const existing = db.prepare('SELECT * FROM depenses WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Dépense introuvable' });

    const decrypted = decryptRow(existing, DEPENSE_FIELDS, req.user.workspaceId);
    const merged = { ...decrypted, ...req.body };
    const data = parseBody(merged, true);
    const encrypted = encryptRow(data, DEPENSE_FIELDS, req.user.workspaceId);

    db.prepare(`
      UPDATE depenses
      SET date = @date,
          fournisseur = @fournisseur,
          description = @description,
          montant_ht = @montant_ht,
          taux_tva = @taux_tva,
          montant_tva = @montant_tva,
          montant_ttc = @montant_ttc,
          categorie = @categorie,
          statut = @statut
      WHERE id = @id
    `).run({ ...encrypted, id: req.params.id });

    const updated = db.prepare('SELECT * FROM depenses WHERE id = ?').get(req.params.id);
    res.json(decryptRow(updated, DEPENSE_FIELDS, req.user.workspaceId));
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', (req, res, next) => {
  try {
    const db = getWorkspaceDb(req.user.workspaceId);
    const existing = db.prepare('SELECT * FROM depenses WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Dépense introuvable' });

    db.prepare('DELETE FROM depenses WHERE id = ?').run(req.params.id);
    db.prepare("DELETE FROM qonto_imports WHERE local_type = 'depense' AND local_id = ?").run(req.params.id);
    res.json({ message: 'Dépense supprimée', id: Number(req.params.id) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
