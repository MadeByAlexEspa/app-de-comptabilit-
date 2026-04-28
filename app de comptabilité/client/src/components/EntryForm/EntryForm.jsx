import { useState, useEffect, useMemo } from 'react'
import styles from './EntryForm.module.css'
import { formatEur } from '../../lib/api.js'
import { getTvaRegime } from '../../lib/tvaRules.js'
import { useWorkspace } from '../../context/WorkspaceContext.jsx'


// Taux légaux de TVA (CGI art. 278 à 281 nonies)
const TAUX_TVA = [
  { value: 20,  label: '20 % – Taux normal' },
  { value: 10,  label: '10 % – Taux intermédiaire' },
  { value: 5.5, label: '5,5 % – Taux réduit' },
  { value: 2.1, label: '2,1 % – Taux particulier' },
  { value: 0,   label: '0 % – Exonéré / hors TVA' },
]

// Catégories ENTRÉES — groupées par nature
const GROUPES_ENTREES = [
  {
    label: 'Chiffre d\'affaires (Classe 7)',
    options: [
      '706 \u2013 Prestations de services',
      '701 \u2013 Ventes de produits finis',
      '707 \u2013 Ventes de marchandises',
      '708 \u2013 Produits des activit\u00e9s annexes',
    ],
  },
  {
    label: 'Autres produits d\'exploitation',
    options: [
      '74 \u2013 Subventions d\u2019exploitation',
      '75 \u2013 Autres produits de gestion courante',
    ],
  },
  {
    label: 'Avoirs & remboursements reçus (Classe 4)',
    options: [
      '409 \u2013 Avoirs fournisseurs re\u00e7us',
    ],
  },
  {
    label: 'Produits financiers & exceptionnels',
    options: [
      '76 \u2013 Produits financiers',
      '77 \u2013 Produits exceptionnels',
    ],
  },
  {
    label: 'Capitaux propres & financement (Classe 1 — hors P&L)',
    options: [
      '101 \u2013 Capital social (apport)',
      '108 \u2013 Apport de l\u2019exploitant',
      '164 \u2013 Emprunts bancaires re\u00e7us',
      '455 \u2013 Avances en compte courant associ\u00e9',
    ],
  },
  {
    label: 'Virements internes (Classe 5 — hors P&L)',
    options: [
      '58 \u2013 Virement interne entre comptes',
    ],
  },
]

// Catégories SORTIES — groupées par nature
const GROUPES_SORTIES = [
  {
    label: 'Achats consommés (Classe 6)',
    options: [
      '604 \u2013 Achats de prestations de services',
      '606 \u2013 Fournitures et petits \u00e9quipements',
      '607 \u2013 Achats de marchandises',
    ],
  },
  {
    label: 'Charges externes (Classe 6)',
    options: [
      '611 \u2013 Sous-traitance g\u00e9n\u00e9rale',
      '613 \u2013 Locations & charges locatives',
      '615 \u2013 Entretien et r\u00e9parations',
      '616 \u2013 Primes d\u2019assurance',
      '618 \u2013 Abonnements & frais informatiques',
      '622 \u2013 Honoraires et r\u00e9mun\u00e9rations d\u2019interm\u00e9diaires',
      '623 \u2013 Publicit\u00e9 & communication',
      '624 \u2013 Transports de biens',
      '625 \u2013 D\u00e9placements, missions & r\u00e9ceptions',
      '626 \u2013 Frais postaux & t\u00e9l\u00e9communications',
      '627 \u2013 Services bancaires & assimil\u00e9s',
    ],
  },
  {
    label: 'Impôts et taxes (Classe 6)',
    options: [
      '631 \u2013 Imp\u00f4ts, taxes et versements assimil\u00e9s sur r\u00e9mun\u00e9rations',
      '635 \u2013 Autres imp\u00f4ts, taxes et versements assimil\u00e9s',
    ],
  },
  {
    label: 'Charges de personnel (Classe 6)',
    options: [
      '641 \u2013 R\u00e9mun\u00e9rations du personnel',
      '645 \u2013 Charges sociales & cotisations',
      '421 \u2013 Notes de frais du personnel',
    ],
  },
  {
    label: 'Dotations aux amortissements (Classe 6)',
    options: [
      '681 \u2013 Dotations aux amortissements d\u2019exploitation',
    ],
  },
  {
    label: 'Avoirs & remboursements clients (Classe 7)',
    options: [
      '709 \u2013 Avoirs & remboursements clients',
    ],
  },
  {
    label: 'Charges financières & exceptionnelles',
    options: [
      '661 \u2013 Charges d\u2019int\u00e9r\u00eats',
      '668 \u2013 Autres charges financi\u00e8res',
      '671 \u2013 Charges exceptionnelles sur op\u00e9rations de gestion',
      '675 \u2013 Valeurs comptables des \u00e9l\u00e9ments c\u00e9d\u00e9s',
    ],
  },
  {
    label: 'Impôt sur les bénéfices',
    options: [
      '695 \u2013 Imp\u00f4t sur les b\u00e9n\u00e9fices (IS)',
    ],
  },
  {
    label: 'Immobilisations (Classe 2 — hors P&L)',
    options: [
      '201 \u2013 Frais d\u2019\u00e9tablissement',
      '2052 \u2013 Logiciels (d\u00e9veloppement interne)',
      '2051 \u2013 Concessions, brevets, licences, marques',
      '211 \u2013 Terrains',
      '213 \u2013 Constructions',
      '215 \u2013 Mat\u00e9riel et outillage industriel',
      '218 \u2013 Autres immobilisations corporelles',
    ],
  },
  {
    label: 'Remboursements & prélèvements (Classe 1 — hors P&L)',
    options: [
      '108 \u2013 Pr\u00e9l\u00e8vements de l\u2019exploitant',
      '164 \u2013 Remboursement d\u2019emprunt',
      '455 \u2013 Remboursement compte courant associ\u00e9',
    ],
  },
  {
    label: 'Virements internes (Classe 5 — hors P&L)',
    options: [
      '58 \u2013 Virement interne entre comptes',
    ],
  },
]

// Recommandées — codes PCG → options exactes depuis les GROUPES ci-dessus
function pick(groupes, ...codes) {
  const all = groupes.flatMap(g => g.options)
  return codes.map(c => all.find(o => o.startsWith(c + ' '))).filter(Boolean)
}

const RECOMMANDEES_ENTREES = {
  saas:         pick(GROUPES_ENTREES, '706', '708'),
  conseil:      pick(GROUPES_ENTREES, '706', '708'),
  evenementiel: pick(GROUPES_ENTREES, '706', '707', '708'),
  commerce:     pick(GROUPES_ENTREES, '707', '701', '708'),
  formation:    pick(GROUPES_ENTREES, '706', '74',  '708'),
  immobilier:   pick(GROUPES_ENTREES, '706', '708'),
}

const RECOMMANDEES_SORTIES = {
  saas:         pick(GROUPES_SORTIES, '618', '611', '623', '641', '645', '627'),
  conseil:      pick(GROUPES_SORTIES, '625', '618', '622', '627', '616', '626'),
  evenementiel: pick(GROUPES_SORTIES, '613', '611', '623', '625', '627'),
  commerce:     pick(GROUPES_SORTIES, '607', '606', '613', '641', '645', '623', '627'),
  formation:    pick(GROUPES_SORTIES, '625', '618', '622', '613', '627'),
  immobilier:   pick(GROUPES_SORTIES, '615', '613', '616', '627'),
}

const STATUTS = [
  { value: 'payee',      label: 'Payée' },
  { value: 'en_attente', label: 'En attente' },
]

function defaultValues(type) {
  const today = new Date().toISOString().split('T')[0]
  if (type === 'facture') {
    return {
      numero:      '',
      date:        today,
      client:      '',
      description: '',
      montant_ht:  '',
      taux_tva:    20,
      categorie:   GROUPES_ENTREES[0].options[0],
      statut:      'en_attente',
    }
  }
  return {
    date:        today,
    fournisseur: '',
    description: '',
    montant_ht:  '',
    taux_tva:    20,
    categorie:   GROUPES_SORTIES[0].options[0],
    statut:      'en_attente',
  }
}

export default function EntryForm({ type, initialData, onSubmit, onCancel }) {
  const { profile } = useWorkspace() || { profile: {} }
  const [form, setForm]         = useState(() => ({ ...defaultValues(type), ...initialData }))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]       = useState(null)
  const [multiTva, setMultiTva] = useState(false)
  const [tvaLines, setTvaLines] = useState([{ taux_tva: 20, montant_ht: '' }])

  useEffect(() => {
    const newForm = { ...defaultValues(type), ...initialData }
    setForm(newForm)

    // Check if initialData has multi-TVA
    if (initialData?.taux_tva === -1 && initialData?.tva_lines) {
      setMultiTva(true)
      let lines
      try {
        lines = typeof initialData.tva_lines === 'string'
          ? JSON.parse(initialData.tva_lines)
          : initialData.tva_lines
      } catch (_) {
        lines = null
      }
      if (Array.isArray(lines) && lines.length > 0) {
        setTvaLines(lines.map(line => ({
          taux_tva: line.taux_tva,
          montant_ht: String(line.montant_ht || '')
        })))
      }
    } else {
      setMultiTva(false)
      setTvaLines([{ taux_tva: 20, montant_ht: '' }])
    }
  }, [type, initialData])

  const tvaRegime  = getTvaRegime(form.categorie)
  const montantHt  = parseFloat(form.montant_ht) || 0
  const tauxTva    = parseFloat(form.taux_tva) || 0
  const montantTva = +(montantHt * tauxTva / 100).toFixed(2)
  const montantTtc = +(montantHt + montantTva).toFixed(2)

  // Multi-TVA totals
  const multiTotalHt = multiTva
    ? tvaLines.reduce((sum, line) => sum + (parseFloat(line.montant_ht) || 0), 0)
    : 0
  const multiTotalTva = multiTva
    ? tvaLines.reduce((sum, line) => {
        const ht = parseFloat(line.montant_ht) || 0
        const taux = parseFloat(line.taux_tva) || 0
        return sum + (ht * taux / 100)
      }, 0)
    : 0
  const multiTotalTtc = multiTotalHt + multiTotalTva

  function handleChange(e) {
    const { name, value } = e.target
    if (name === 'categorie') {
      const regime = getTvaRegime(value)
      setForm(prev => ({ ...prev, categorie: value, taux_tva: regime.taux }))
    } else {
      setForm(prev => ({ ...prev, [name]: value }))
    }
  }

  function handleToggleMultiTva() {
    setMultiTva(prev => {
      if (!prev && form.montant_ht) {
        // Switching to multi: initialize with current single values
        setTvaLines([{ taux_tva: form.taux_tva, montant_ht: form.montant_ht }])
      }
      return !prev
    })
  }

  function handleLineChange(index, field, value) {
    setTvaLines(prev => prev.map((line, i) =>
      i === index ? { ...line, [field]: value } : line
    ))
  }

  function handleAddLine() {
    setTvaLines(prev => [...prev, { taux_tva: 20, montant_ht: '' }])
  }

  function handleRemoveLine(index) {
    if (tvaLines.length > 1) {
      setTvaLines(prev => prev.filter((_, i) => i !== index))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (multiTva) {
        // Multi-TVA mode: send tva_lines array, no single montant_ht/taux_tva
        const parsedLines = tvaLines.map(line => ({
          taux_tva: parseFloat(line.taux_tva),
          montant_ht: parseFloat(line.montant_ht)
        }))
        if (parsedLines.some(l => isNaN(l.montant_ht) || l.montant_ht <= 0)) {
          throw new Error('Chaque ligne TVA doit avoir un montant HT valide et positif.')
        }
        await onSubmit({
          ...form,
          tva_lines: parsedLines
        })
      } else {
        // Single TVA mode: send as before
        await onSubmit({
          ...form,
          montant_ht: parseFloat(form.montant_ht),
          taux_tva:   parseFloat(form.taux_tva),
        })
      }
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  const groupes = useMemo(() => {
    const base    = type === 'facture' ? GROUPES_ENTREES : GROUPES_SORTIES
    const reco    = type === 'facture'
      ? RECOMMANDEES_ENTREES[profile?.activite_type]
      : RECOMMANDEES_SORTIES[profile?.activite_type]
    if (!reco || reco.length === 0) return base
    return [{ label: '★ Recommandées pour votre activité', options: reco }, ...base]
  }, [type, profile?.activite_type])

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {type === 'facture' && (
        <div className={styles.field}>
          <label className={styles.label} htmlFor="numero">Numéro de facture</label>
          <input
            id="numero" name="numero" type="text"
            className={styles.input}
            value={form.numero} onChange={handleChange}
            placeholder="F-2024-001" required
          />
        </div>
      )}

      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="date">Date</label>
          <input
            id="date" name="date" type="date"
            className={styles.input}
            value={form.date} onChange={handleChange} required
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="statut">Statut</label>
          <select id="statut" name="statut" className={styles.select} value={form.statut} onChange={handleChange}>
            {STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {type === 'facture' ? (
        <div className={styles.field}>
          <label className={styles.label} htmlFor="client">Client / Tiers</label>
          <input
            id="client" name="client" type="text"
            className={styles.input}
            value={form.client} onChange={handleChange}
            placeholder="Nom du client ou de la contrepartie" required
          />
        </div>
      ) : (
        <div className={styles.field}>
          <label className={styles.label} htmlFor="fournisseur">Fournisseur / Tiers</label>
          <input
            id="fournisseur" name="fournisseur" type="text"
            className={styles.input}
            value={form.fournisseur} onChange={handleChange}
            placeholder="Nom du fournisseur ou de la contrepartie" required
          />
        </div>
      )}

      <div className={styles.field}>
        <label className={styles.label} htmlFor="description">Description</label>
        <textarea
          id="description" name="description"
          className={`${styles.input} ${styles.textarea}`}
          value={form.description} onChange={handleChange}
          placeholder="Description de l'opération" rows={2}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="categorie">Catégorie comptable</label>
        <select id="categorie" name="categorie" className={styles.select} value={form.categorie} onChange={handleChange}>
          {groupes.map(groupe => (
            <optgroup key={groupe.label} label={groupe.label}>
              {groupe.options.map(c => <option key={c} value={c}>{c}</option>)}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Multi-TVA toggle button - hidden when TVA is locked */}
      {!tvaRegime.locked && (
        <div className={styles.field}>
          <button
            type="button"
            className={`${styles.toggleMultiTva} ${multiTva ? styles.toggleMultiTvaActive : ''}`}
            onClick={handleToggleMultiTva}
          >
            {multiTva ? 'Revenir au taux unique' : 'Activer TVA multiple'}
          </button>
        </div>
      )}

      {multiTva ? (
        // Multi-TVA interface
        <div className={styles.tvaLinesSection}>
          {tvaLines.map((line, index) => (
            <div key={index} className={styles.tvaLineRow}>
              <input
                type="number"
                min="0"
                step="0.01"
                className={styles.input}
                value={line.montant_ht}
                onChange={e => handleLineChange(index, 'montant_ht', e.target.value)}
                placeholder="Montant HT"
              />
              <select
                className={styles.select}
                value={line.taux_tva}
                onChange={e => handleLineChange(index, 'taux_tva', e.target.value)}
              >
                {TAUX_TVA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <span className={styles.tvaLineComputed}>
                {formatEur((parseFloat(line.montant_ht) || 0) * (parseFloat(line.taux_tva) || 0) / 100)}
              </span>
              {tvaLines.length > 1 && (
                <button
                  type="button"
                  className={styles.btnDeleteLine}
                  onClick={() => handleRemoveLine(index)}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className={styles.btnAddLine}
            onClick={handleAddLine}
          >
            Ajouter une ligne TVA
          </button>
          <div className={styles.multiTvaSummary}>
            <span className={styles.previewItem}>
              <span className={styles.previewLabel}>Total HT :</span>
              <span className={styles.previewValue}>{formatEur(multiTotalHt)}</span>
            </span>
            <span className={styles.previewSep}>—</span>
            <span className={styles.previewItem}>
              <span className={styles.previewLabel}>Total TVA :</span>
              <span className={styles.previewValue}>{formatEur(multiTotalTva)}</span>
            </span>
            <span className={styles.previewSep}>—</span>
            <span className={styles.previewItem}>
              <span className={styles.previewLabel}>Total TTC :</span>
              <span className={styles.previewValueBold}>{formatEur(multiTotalTtc)}</span>
            </span>
          </div>
        </div>
      ) : (
        // Single TVA interface
        <>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="montant_ht">Montant HT (€)</label>
              <input
                id="montant_ht" name="montant_ht" type="number"
                min="0" step="0.01"
                className={styles.input}
                value={form.montant_ht} onChange={handleChange}
                placeholder="0.00" required
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="taux_tva">Taux TVA</label>
              <select
                id="taux_tva" name="taux_tva"
                className={styles.select}
                value={form.taux_tva}
                onChange={handleChange}
                disabled={tvaRegime.locked}
                title={tvaRegime.locked ? 'Cette catégorie est hors champ ou exonérée de TVA (CGI art. 261)' : undefined}
              >
                {TAUX_TVA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              {tvaRegime.locked && (
                <span className={styles.tvaNote}>
                  Hors champ / exonéré de TVA — taux forcé à 0 %
                </span>
              )}
            </div>
          </div>

          <div className={styles.preview}>
            <span className={styles.previewItem}>
              <span className={styles.previewLabel}>TVA :</span>
              <span className={styles.previewValue}>{formatEur(montantTva)}</span>
            </span>
            <span className={styles.previewSep}>—</span>
            <span className={styles.previewItem}>
              <span className={styles.previewLabel}>TTC :</span>
              <span className={styles.previewValueBold}>{formatEur(montantTtc)}</span>
            </span>
          </div>
        </>
      )}

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.actions}>
        <button type="button" className={styles.btnCancel} onClick={onCancel} disabled={submitting}>
          Annuler
        </button>
        <button type="submit" className={styles.btnSubmit} disabled={submitting}>
          {submitting ? 'Enregistrement…' : (initialData?.id ? 'Mettre à jour' : 'Enregistrer')}
        </button>
      </div>
    </form>
  )
}
