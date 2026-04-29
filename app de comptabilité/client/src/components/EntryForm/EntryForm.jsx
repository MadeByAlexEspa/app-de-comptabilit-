import { useState, useEffect, useMemo } from 'react'
import styles from './EntryForm.module.css'
import { formatEur } from '../../lib/api.js'
import { getTvaRegime } from '../../lib/tvaRules.js'
import { getCatEntreesGroups, getCatSortiesGroups } from '../../lib/categories.js'
import { useWorkspace } from '../../context/WorkspaceContext.jsx'

// Taux légaux de TVA (CGI art. 278 à 281 nonies)
const TAUX_TVA = [
  { value: 20,  label: '20 % – Taux normal' },
  { value: 10,  label: '10 % – Taux intermédiaire' },
  { value: 5.5, label: '5,5 % – Taux réduit' },
  { value: 2.1, label: '2,1 % – Taux particulier' },
  { value: 0,   label: '0 % – Exonéré / hors TVA' },
]

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
      categorie:   '706 – Prestations de services',
      statut:      'en_attente',
    }
  }
  return {
    date:        today,
    fournisseur: '',
    description: '',
    montant_ht:  '',
    taux_tva:    20,
    categorie:   '604 – Achats de prestations de services',
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

  const groupes = useMemo(() =>
    type === 'facture'
      ? getCatEntreesGroups(profile?.activite_type)
      : getCatSortiesGroups(profile?.activite_type),
    [type, profile?.activite_type]
  )

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
