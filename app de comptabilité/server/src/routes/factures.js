const { Router } = require('express');
const { getWorkspaceDb } = require('../db/database');
const { validateTaux, validateStatut, computeAmounts } = require('../utils/entryUtils');
const { encryptRow, decryptRow, decryptRows, FACTURE_FIELDS } = require('../services/cryptoService');

const router = Router();

function parseBody(body, requireAll = true) {
  const {
    numero,
    date,
    client,
    description = '',
    montant_ht,
    taux_tva,
    categorie,
    statut = 'en_attente',
  } = body;

  if (requireAll) {
    const missing = [];
    if (!numero)                   missing.push('numero');
    if (!date)                     missing.push('date');
    if (!client)                   missing.push('client');
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
    numero,
    date,
    client,
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

    const baseSQL = `
      SELECT f.*,
        COALESCE(
          (SELECT has_attachment FROM qonto_imports WHERE local_type='facture' AND local_id=f.id),
          (SELECT has_attachment FROM shine_imports  WHERE local_type='facture' AND local_id=f.id),
          0
        ) AS has_attachment,
        CASE
          WHEN (SELECT 1 FROM qonto_imports WHERE local_type='facture' AND local_id=f.id) THEN 'qonto'
          WHEN (SELECT 1 FROM shine_imports  WHERE local_type='facture' AND local_id=f.id) THEN 'shine'
          ELSE NULL
        END AS bank_source
      FROM factures f
    `;
    let rows;
    if (mois) {
      rows = db.prepare(`${baseSQL} WHERE strftime('%Y-%m', f.date) = ? ORDER BY f.date DESC`).all(mois);
    } else {
      rows = db.prepare(`${baseSQL} ORDER BY f.date DESC`).all();
    }

    res.json(decryptRows(rows, FACTURE_FIELDS, req.user.workspaceId));
  } catch (err) {
    next(err);
  }
});

router.get('/:id', (req, res, next) => {
  try {
    const db = getWorkspaceDb(req.user.workspaceId);
    const row = db.prepare('SELECT * FROM factures WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Facture introuvable' });
    res.json(decryptRow(row, FACTURE_FIELDS, req.user.workspaceId));
  } catch (err) {
    next(err);
  }
});

router.post('/', (req, res, next) => {
  try {
    const db = getWorkspaceDb(req.user.workspaceId);
    const data = parseBody(req.body, true);
    const encrypted = encryptRow(data, FACTURE_FIELDS, req.user.workspaceId);

    const result = db.prepare(`
      INSERT INTO factures (numero, date, client, description, montant_ht, taux_tva, montant_tva, montant_ttc, categorie, statut)
      VALUES (@numero, @date, @client, @description, @montant_ht, @taux_tva, @montant_tva, @montant_ttc, @categorie, @statut)
    `).run(encrypted);

    const created = db.prepare('SELECT * FROM factures WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(decryptRow(created, FACTURE_FIELDS, req.user.workspaceId));
  } catch (err) {
    next(err);
  }
});

router.put('/:id', (req, res, next) => {
  try {
    const db = getWorkspaceDb(req.user.workspaceId);
    const existing = db.prepare('SELECT * FROM factures WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Facture introuvable' });

    const decrypted = decryptRow(existing, FACTURE_FIELDS, req.user.workspaceId);
    const merged = { ...decrypted, ...req.body };
    const data = parseBody(merged, true);
    const encrypted = encryptRow(data, FACTURE_FIELDS, req.user.workspaceId);

    db.prepare(`
      UPDATE factures
      SET numero = @numero,
          date = @date,
          client = @client,
          description = @description,
          montant_ht = @montant_ht,
          taux_tva = @taux_tva,
          montant_tva = @montant_tva,
          montant_ttc = @montant_ttc,
          categorie = @categorie,
          statut = @statut
      WHERE id = @id
    `).run({ ...encrypted, id: req.params.id });

    const updated = db.prepare('SELECT * FROM factures WHERE id = ?').get(req.params.id);
    res.json(decryptRow(updated, FACTURE_FIELDS, req.user.workspaceId));
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', (req, res, next) => {
  try {
    const db = getWorkspaceDb(req.user.workspaceId);
    const existing = db.prepare('SELECT * FROM factures WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Facture introuvable' });

    db.prepare('DELETE FROM factures WHERE id = ?').run(req.params.id);
    db.prepare("DELETE FROM qonto_imports WHERE local_type = 'facture' AND local_id = ?").run(req.params.id);
    res.json({ message: 'Facture supprimée', id: Number(req.params.id) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
