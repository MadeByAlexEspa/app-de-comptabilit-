import { useState, useEffect } from 'react'
import Modal from '../Modal/Modal.jsx'
import { api, formatEur } from '../../lib/api.js'
import styles from './TransactionDrilldown.module.css'

export default function TransactionDrilldown({ titre, params, onClose }) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    api.getTransactions(params)
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const rows = data
    ? [
        ...data.factures.map(r => ({ ...r, _type: 'facture' })),
        ...data.depenses.map(r => ({ ...r, _type: 'depense' })),
      ].sort((a, b) => b.date.localeCompare(a.date))
    : []

  const totalHT = rows.reduce((s, r) => s + r.montant_ht, 0)

  return (
    <Modal title={titre} onClose={onClose} size="large">
      {loading && <p className={styles.info}>Chargement…</p>}
      {error   && <p className={styles.error}>⚠️ {error}</p>}

      {data && rows.length === 0 && (
        <p className={styles.info}>Aucune transaction pour cette sélection.</p>
      )}

      {data && rows.length > 0 && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Tiers</th>
              <th>Description</th>
              <th className={styles.right}>Montant HT</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={`${r._type}-${r.id}`} className={r._type === 'depense' ? styles.depenseRow : styles.factureRow}>
                <td className={styles.date}>{new Date(r.date).toLocaleDateString('fr-FR')}</td>
                <td>{r.client ?? r.fournisseur}</td>
                <td className={styles.desc}>{r.description || '—'}</td>
                <td className={`${styles.right} ${r._type === 'depense' ? styles.charge : styles.produit}`}>
                  {formatEur(r.montant_ht)}
                </td>
                <td>
                  <span className={r.statut === 'payee' ? styles.tagPayee : styles.tagAttente}>
                    {r.statut === 'payee' ? 'Payée' : 'En attente'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className={styles.totalRow}>
              <td colSpan={3}><strong>Total HT</strong></td>
              <td className={styles.right}><strong>{formatEur(totalHT)}</strong></td>
              <td />
            </tr>
          </tfoot>
        </table>
      )}
    </Modal>
  )
}
