const { decryptRows, FACTURE_FIELDS, DEPENSE_FIELDS } = require('./cryptoService');

function round2(n) {
  return Math.round(n * 100) / 100;
}

const TAUX_LEGAUX = [20, 10, 5.5, 2.1, 0];

function ventilerParTaux(rows) {
  const par_taux = {};
  for (const t of TAUX_LEGAUX) {
    par_taux[t] = { base_ht: 0, tva: 0 };
  }

  for (const row of rows) {
    if (row.tva_lines) {
      // Multi-TVA mode: parse tva_lines and iterate each line
      let lines;
      try {
        lines = JSON.parse(row.tva_lines);
      } catch (_) {
        lines = null;
      }

      if (Array.isArray(lines) && lines.length > 0) {
        for (const line of lines) {
          const t = line.taux_tva;
          if (!(t in par_taux)) par_taux[t] = { base_ht: 0, tva: 0 };
          par_taux[t].base_ht = round2(par_taux[t].base_ht + line.montant_ht);
          par_taux[t].tva     = round2(par_taux[t].tva     + line.montant_tva);
        }
      } else {
        // Fallback to single-rate logic if tva_lines is invalid
        const t = row.taux_tva;
        if (!(t in par_taux)) par_taux[t] = { base_ht: 0, tva: 0 };
        par_taux[t].base_ht = round2(par_taux[t].base_ht + row.montant_ht);
        par_taux[t].tva     = round2(par_taux[t].tva     + row.montant_tva);
      }
    } else {
      // Single-TVA mode: use existing logic
      const t = row.taux_tva;
      if (!(t in par_taux)) par_taux[t] = { base_ht: 0, tva: 0 };
      par_taux[t].base_ht = round2(par_taux[t].base_ht + row.montant_ht);
      par_taux[t].tva     = round2(par_taux[t].tva     + row.montant_tva);
    }
  }

  const result = {};
  for (const [t, data] of Object.entries(par_taux)) {
    if (data.base_ht !== 0 || data.tva !== 0 || Number(t) === 0) {
      result[t] = { base_ht: data.base_ht, tva: data.tva };
    }
  }
  return result;
}

function getTvaReportRange(db, debut, fin, workspaceId) {
  const rawFactures = db.prepare(`
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
    FROM factures f WHERE f.date >= ? AND f.date <= ? ORDER BY f.date
  `).all(debut, fin);
  const rawDepenses = db.prepare(`
    SELECT d.*,
      COALESCE(
        (SELECT has_attachment FROM qonto_imports WHERE local_type='depense' AND local_id=d.id),
        (SELECT has_attachment FROM shine_imports  WHERE local_type='depense' AND local_id=d.id),
        0
      ) AS has_attachment,
      CASE
        WHEN (SELECT 1 FROM qonto_imports WHERE local_type='depense' AND local_id=d.id) THEN 'qonto'
        WHEN (SELECT 1 FROM shine_imports  WHERE local_type='depense' AND local_id=d.id) THEN 'shine'
        ELSE NULL
      END AS bank_source
    FROM depenses d WHERE d.date >= ? AND d.date <= ? ORDER BY d.date
  `).all(debut, fin);

  const detailFactures = decryptRows(rawFactures, FACTURE_FIELDS, workspaceId);
  const detailDepenses = decryptRows(rawDepenses, DEPENSE_FIELDS, workspaceId);

  const collecteParTaux   = ventilerParTaux(detailFactures);
  const deductibleParTaux = ventilerParTaux(detailDepenses);

  const totalCollectee  = round2(detailFactures.reduce((s, r) => s + r.montant_tva, 0));
  const totalDeductible = round2(detailDepenses.reduce((s, r) => s + r.montant_tva, 0));
  const solde           = round2(totalCollectee - totalDeductible);

  return {
    debut,
    fin,
    collectee: {
      par_taux:      collecteParTaux,
      total_base_ht: round2(detailFactures.reduce((s, r) => s + r.montant_ht, 0)),
      total_tva:     totalCollectee,
    },
    deductible: {
      par_taux:      deductibleParTaux,
      total_base_ht: round2(detailDepenses.reduce((s, r) => s + r.montant_ht, 0)),
      total_tva:     totalDeductible,
    },
    tva_a_reverser: Math.max(0, solde),
    credit_tva:     Math.max(0, -solde),
    detail_factures: detailFactures,
    detail_depenses: detailDepenses,
  };
}

function getTvaReport(db, mois, workspaceId) {
  const [y, m] = mois.split('-');
  const debut  = `${y}-${m}-01`;
  const lastDay = new Date(Number(y), Number(m), 0).getDate();
  const fin    = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
  return { ...getTvaReportRange(db, debut, fin, workspaceId), mois };
}

module.exports = { getTvaReport, getTvaReportRange };
