const { Router } = require('express');
const db = require('../db/database');

const router = Router();

const VALID_TAUX_TVA = [0, 5.5, 10, 20];
const VALID_STATUTS  = ['payee', 'en_attente'];

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Validate and normalise the body for create / update.
 * Returns { data } on success or throws an error with status 400.
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
    numero,
    date,
    client,
    description,
    montant_ht:  ht,
    taux_tva:    Number(taux_tva),
    montant_tva: tva,
    montant_ttc: ttc,
    categorie,
    statut,
  };
}

// ── GET /api/factures ─────────────────────────────────────────────────────────
router.get('/', (req, res, next) => {
  try {
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
