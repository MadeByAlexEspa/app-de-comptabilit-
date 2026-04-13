import { useState, useEffect } from 'react'
import styles from './EntryForm.module.css'
import { formatEur } from '../../lib/api.js'

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
    ],
  },
  {
    label: 'Dotations aux amortissements (Classe 6)',
    options: [
      '681 \u2013 Dotations aux amortissements d\u2019exploitation',
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
      '205 \u2013 Concessions, brevets, licences, marques',
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
  const [form, setForm]         = useState(() => ({ ...defaultValues(type), ...initialData }))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]       = useState(null)

  useEffect(() => {
    setForm({ ...defaultValues(type), ...initialData })
  }, [type, initialData])

  const montantHt  = parseFloat(form.montant_ht) || 0
  const tauxTva    = parseFloat(form.taux_tva) || 0
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
      await onSubmit({
        ...form,
        montant_ht: parseFloat(form.montant_ht),
        taux_tva:   parseFloat(form.taux_tva),
      })
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  const groupes = type === 'facture' ? GROUPES_ENTREES : GROUPES_SORTIES

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
          <select id="taux_tva" name="taux_tva" className={styles.select} value={form.taux_tva} onChange={handleChange}>
            {TAUX_TVA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
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
