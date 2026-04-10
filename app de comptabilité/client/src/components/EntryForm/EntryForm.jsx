import { useState, useEffect } from 'react'
import styles from './EntryForm.module.css'
import { formatEur } from '../../lib/api.js'

const TAUX_TVA = [0, 5.5, 10, 20]

const CATEGORIES_REVENUS = [
  'Prestations de services',
  'Vente de produits',
  'Conseil',
  'Formation',
  'Autre recette',
]

const CATEGORIES_CHARGES = [
  'Loyer & charges locatives',
  'Matériel & équipement',
  'Logiciels & abonnements',
  'Déplacements & transport',
  'Repas & réception',
  'Frais bancaires',
  'Sous-traitance',
  'Salaires & charges sociales',
  'Assurances',
  'Fournitures de bureau',
  'Autre charge',
]

const STATUTS = [
  { value: 'payee', label: 'Payée' },
  { value: 'en_attente', label: 'En attente' },
]

function defaultValues(type) {
  const today = new Date().toISOString().split('T')[0]
  if (type === 'facture') {
    return {
      numero: '',
      date: today,
      client: '',
      description: '',
      montant_ht: '',
      taux_tva: 20,
      categorie: CATEGORIES_REVENUS[0],
      statut: 'en_attente',
    }
  }
  return {
    date: today,
    fournisseur: '',
    description: '',
    montant_ht: '',
    taux_tva: 20,
    categorie: CATEGORIES_CHARGES[0],
    statut: 'en_attente',
  }
}

export default function EntryForm({ type, initialData, onSubmit, onCancel }) {
  const [form, setForm] = useState(() => ({
    ...defaultValues(type),
    ...initialData,
  }))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    setForm({ ...defaultValues(type), ...initialData })
  }, [type, initialData])

  const montantHt = parseFloat(form.montant_ht) || 0
  const tauxTva = parseFloat(form.taux_tva) || 0
  const montantTva = +(montantHt * tauxTva / 100).toFixed(2)
  const montantTtc = +(montantHt + montantTva).toFixed(2)

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const payload = {
        ...form,
        montant_ht: parseFloat(form.montant_ht),
        taux_tva: parseFloat(form.taux_tva),
      }
      await onSubmit(payload)
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  const categories = type === 'facture' ? CATEGORIES_REVENUS : CATEGORIES_CHARGES

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {type === 'facture' && (
        <div className={styles.field}>
          <label className={styles.label} htmlFor="numero">Numéro de facture</label>
          <input
            id="numero"
            name="numero"
            type="text"
            className={styles.input}
            value={form.numero}
            onChange={handleChange}
            placeholder="F-2024-001"
            required
          />
        </div>
      )}

      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="date">Date</label>
          <input
            id="date"
            name="date"
            type="date"
            className={styles.input}
            value={form.date}
            onChange={handleChange}
            required
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="statut">Statut</label>
          <select
            id="statut"
            name="statut"
            className={styles.select}
            value={form.statut}
            onChange={handleChange}
          >
            {STATUTS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {type === 'facture' ? (
        <div className={styles.field}>
          <label className={styles.label} htmlFor="client">Client</label>
          <input
            id="client"
            name="client"
            type="text"
            className={styles.input}
            value={form.client}
            onChange={handleChange}
            placeholder="Nom du client"
            required
          />
        </div>
      ) : (
        <div className={styles.field}>
          <label className={styles.label} htmlFor="fournisseur">Fournisseur</label>
          <input
            id="fournisseur"
            name="fournisseur"
            type="text"
            className={styles.input}
            value={form.fournisseur}
            onChange={handleChange}
            placeholder="Nom du fournisseur"
            required
          />
        </div>
      )}

      <div className={styles.field}>
        <label className={styles.label} htmlFor="description">Description</label>
        <textarea
          id="description"
          name="description"
          className={`${styles.input} ${styles.textarea}`}
          value={form.description}
          onChange={handleChange}
          placeholder="Description de la prestation ou du service"
          rows={2}
        />
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="montant_ht">Montant HT (€)</label>
          <input
            id="montant_ht"
            name="montant_ht"
            type="number"
            min="0"
            step="0.01"
            className={styles.input}
            value={form.montant_ht}
            onChange={handleChange}
            placeholder="0.00"
            required
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="taux_tva">Taux TVA</label>
          <select
            id="taux_tva"
            name="taux_tva"
            className={styles.select}
            value={form.taux_tva}
            onChange={handleChange}
          >
            {TAUX_TVA.map(t => (
              <option key={t} value={t}>{t}%</option>
            ))}
          </select>
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

      <div className={styles.field}>
        <label className={styles.label} htmlFor="categorie">Catégorie</label>
        <select
          id="categorie"
          name="categorie"
          className={styles.select}
          value={form.categorie}
          onChange={handleChange}
        >
          {categories.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

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
