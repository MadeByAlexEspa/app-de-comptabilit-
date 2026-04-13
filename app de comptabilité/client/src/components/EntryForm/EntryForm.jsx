import { useState, useEffect } from 'react'
import styles from './EntryForm.module.css'
import { formatEur } from '../../lib/api.js'

// Taux légaux de TVA (CGI art. 278 à 281 nonies)
// 20%   : taux normal     (art. 278)
// 10%   : taux intermédiaire (art. 278 bis) — restauration, travaux, transport
// 5.5%  : taux réduit     (art. 278-0 bis) — alimentation, livres, spectacles
// 2.1%  : taux particulier (art. 281 nonies) — médicaments remboursables, presse
// 0%    : exonéré         (art. 261 à 261 E) — exports, formations agréées, médical
const TAUX_TVA = [
  { value: 20,  label: '20 % – Taux normal' },
  { value: 10,  label: '10 % – Taux intermédiaire' },
  { value: 5.5, label: '5,5 % – Taux réduit' },
  { value: 2.1, label: '2,1 % – Taux particulier' },
  { value: 0,   label: '0 % – Exonéré' },
]

// Classe 7 – Produits (comptes PCG)
const CATEGORIES_REVENUS = [
  '706 \u2013 Prestations de services',
  '701 \u2013 Ventes de produits finis',
  '707 \u2013 Ventes de marchandises',
  '708 \u2013 Produits des activités annexes',
  '74 \u2013 Subventions d\u2019exploitation',
  '75 \u2013 Autres produits de gestion courante',
  '76 \u2013 Produits financiers',
  '77 \u2013 Produits exceptionnels',
]

// Classe 6 – Charges (comptes PCG)
const CATEGORIES_CHARGES = [
  '604 \u2013 Achats de prestations de services',
  '606 \u2013 Fournitures et petits équipements',
  '607 \u2013 Achats de marchandises',
  '611 \u2013 Sous-traitance générale',
  '613 \u2013 Locations & charges locatives',
  '615 \u2013 Entretien et réparations',
  '616 \u2013 Primes d\u2019assurance',
  '622 \u2013 Honoraires et rémunérations d\u2019intermédiaires',
  '623 \u2013 Publicité & communication',
  '624 \u2013 Transports de biens',
  '625 \u2013 Déplacements, missions & réceptions',
  '626 \u2013 Frais postaux & télécommunications',
  '627 \u2013 Services bancaires & assimilés',
  '641 \u2013 Rémunérations du personnel',
  '645 \u2013 Charges sociales & cotisations',
  '681 \u2013 Dotations aux amortissements d\u2019exploitation',
  '661 \u2013 Charges d\u2019intérêts',
  '668 \u2013 Autres charges financières',
  '671 \u2013 Charges exceptionnelles sur opérations de gestion',
  '675 \u2013 Valeurs comptables des éléments cédés',
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
              <option key={t.value} value={t.value}>{t.label}</option>
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
