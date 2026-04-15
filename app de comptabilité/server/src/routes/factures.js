const { Router } = require('express');
const { getWorkspaceDb } = require('../db/database');
const { validateTaux, validateStatut, computeAmounts } = require('../utils/entryUtils');

const router = Router();

/**
 * Validate and normalise the body for create / update.
 * Throws a 400 error with a French message on validation failure.
 */
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

// ── GET /api/factures ─────────────────────────────────────────────────────────
router.get('/', (req, res, next) => {
  try {
    const db = getWorkspaceDb(req.user.workspaceId);
    const { mois } = req.query; // optional filter: "YYYY-MM"

    let rows;
    if (mois) {
      // SQLite: strftime('%Y-%m', date) = :mois
      rows = db
        .prepare(`SELECT * FROM factures WHERE strftime('%Y-%m', date) = ? ORDER BY date DESC`)
        .all(mois);
    } else {
      rows = db.prepare('SELECT * FROM factures ORDER BY date DESC').all();
    }

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/factures/:id ─────────────────────────────────────────────────────
router.get('/:id', (req, res, next) => {
  try {
    const db = getWorkspaceDb(req.user.workspaceId);
    const row = db.prepare('SELECT * FROM factures WHERE id = ?').get(req.params.id);
    if (!row) {
      return res.status(404).json({ error: 'Facture introuvable' });
    }
    res.json(row);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/factures ────────────────────────────────────────────────────────
router.post('/', (req, res, next) => {
  try {
    const db = getWorkspaceDb(req.user.workspaceId);
    const data = parseBody(req.body, true);

    const result = db
      .prepare(`
        INSERT INTO factures (numero, date, client, description, montant_ht, taux_tva, montant_tva, montant_ttc, categorie, statut)
        VALUES (@numero, @date, @client, @description, @montant_ht, @taux_tva, @montant_tva, @montant_ttc, @categorie, @statut)
      `)
      .run(data);

    const created = db.prepare('SELECT * FROM factures WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/factures/:id ─────────────────────────────────────────────────────
router.put('/:id', (req, res, next) => {
  try {
    const db = getWorkspaceDb(req.user.workspaceId);
    const existing = db.prepare('SELECT * FROM factures WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Facture introuvable' });
    }

    // Merge existing values with incoming body, then re-parse
    const merged = { ...existing, ...req.body };
    const data = parseBody(merged, true);

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
    `).run({ ...data, id: req.params.id });

    const updated = db.prepare('SELECT * FROM factures WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/factures/:id ──────────────────────────────────────────────────
router.delete('/:id', (req, res, next) => {
  try {
    const db = getWorkspaceDb(req.user.workspaceId);
    const existing = db.prepare('SELECT * FROM factures WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Facture introuvable' });
    }

    db.prepare('DELETE FROM factures WHERE id = ?').run(req.params.id);
    // Also remove the Qonto import record so the transaction can be re-imported
    db.prepare("DELETE FROM qonto_imports WHERE local_type = 'facture' AND local_id = ?").run(req.params.id);
    res.json({ message: 'Facture supprimée', id: Number(req.params.id) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
