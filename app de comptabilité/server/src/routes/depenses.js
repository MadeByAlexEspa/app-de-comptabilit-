const { Router } = require('express');
const db = require('../db/database');

const router = Router();

const VALID_TAUX_TVA = [0, 5.5, 10, 20];
const VALID_STATUTS  = ['payee', 'en_attente'];

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Validate and normalise the request body.
 * Throws a 400 error with a French message on validation failure.
 */
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

  if (taux_tva !== undefined && !VALID_TAUX_TVA.includes(Number(taux_tva))) {
    const err = new Error(`taux_tva invalide. Valeurs acceptées : ${VALID_TAUX_TVA.join(', ')}`);
    err.status = 400;
    throw err;
  }

  if (statut && !VALID_STATUTS.includes(statut)) {
    const err = new Error(`statut invalide. Valeurs acceptées : ${VALID_STATUTS.join(', ')}`);
    err.status = 400;
    throw err;
  }

  const ht  = round2(Number(montant_ht));
  const tva = round2(ht * Number(taux_tva) / 100);
  const ttc = round2(ht + tva);

  return {
    date,
    fournisseur,
    description,
    montant_ht:  ht,
    taux_tva:    Number(taux_tva),
    montant_tva: tva,
    montant_ttc: ttc,
    categorie,
    statut,
  };
}

// ── GET /api/depenses ─────────────────────────────────────────────────────────
router.get('/', (req, res, next) => {
  try {
    const { mois } = req.query;

    let rows;
    if (mois) {
      rows = db
        .prepare(`SELECT * FROM depenses WHERE strftime('%Y-%m', date) = ? ORDER BY date DESC`)
        .all(mois);
    } else {
      rows = db.prepare('SELECT * FROM depenses ORDER BY date DESC').all();
    }

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/depenses/:id ─────────────────────────────────────────────────────
router.get('/:id', (req, res, next) => {
  try {
    const row = db.prepare('SELECT * FROM depenses WHERE id = ?').get(req.params.id);
    if (!row) {
      return res.status(404).json({ error: 'Dépense introuvable' });
    }
    res.json(row);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/depenses ────────────────────────────────────────────────────────
router.post('/', (req, res, next) => {
  try {
    const data = parseBody(req.body, true);

    const result = db
      .prepare(`
        INSERT INTO depenses (date, fournisseur, description, montant_ht, taux_tva, montant_tva, montant_ttc, categorie, statut)
        VALUES (@date, @fournisseur, @description, @montant_ht, @taux_tva, @montant_tva, @montant_ttc, @categorie, @statut)
      `)
      .run(data);

    const created = db.prepare('SELECT * FROM depenses WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/depenses/:id ─────────────────────────────────────────────────────
router.put('/:id', (req, res, next) => {
  try {
    const existing = db.prepare('SELECT * FROM depenses WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Dépense introuvable' });
    }

    const merged = { ...existing, ...req.body };
    const data = parseBody(merged, true);

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
    `).run({ ...data, id: req.params.id });

    const updated = db.prepare('SELECT * FROM depenses WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/depenses/:id ──────────────────────────────────────────────────
router.delete('/:id', (req, res, next) => {
  try {
    const existing = db.prepare('SELECT * FROM depenses WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Dépense introuvable' });
    }

    db.prepare('DELETE FROM depenses WHERE id = ?').run(req.params.id);
    res.json({ message: 'Dépense supprimée', id: Number(req.params.id) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
