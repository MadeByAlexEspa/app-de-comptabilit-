import { useState, useEffect } from 'react'
import { api, formatEur } from '../lib/api.js'
import styles from './PnL.module.css'

function currentYear() {
  const y = new Date().getFullYear()
  return { debut: `${y}-01-01`, fin: new Date().toISOString().slice(0, 10) }
}

export default function PnL() {
  const { debut: defaultDebut, fin: defaultFin } = currentYear()
  const [debut, setDebut] = useState(defaultDebut)
  const [fin, setFin] = useState(defaultFin)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!debut || !fin) return
    setLoading(true)
    setError(null)
    api.getPnL(debut, fin)
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [debut, fin])

  const resultat = data ? data.resultat_net : 0
  const isPositif = resultat >= 0

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Compte de résultat (P&L)</h1>
          <p className={styles.pageSubtitle}>Résultat sur la période sélectionnée</p>
        </div>
        <div className={styles.periodPicker}>
          <div className={styles.pickerGroup}>
            <label className={styles.label}>Du</label>
            <input type="date" value={debut} onChange={e => setDebut(e.target.value)} className={styles.input} />
          </div>
          <div className={styles.pickerGroup}>
            <label className={styles.label}>Au</label>
            <input type="date" value={fin} onChange={e => setFin(e.target.value)} className={styles.input} />
          </div>
        </div>
      </div>

      {loading && (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Calcul du P&L…</p>
        </div>
      )}

      {error && <div className={styles.error}>⚠️ {error}</div>}

      {data && !loading && (
        <div className={styles.tableCard}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Libellé</th>
                <th className={styles.right}>Montant HT</th>
              </tr>
            </thead>
            <tbody>
              {/* REVENUS */}
              <tr className={styles.sectionHeader}>
                <td colSpan={2}>PRODUITS (REVENUS)</td>
              </tr>
              {Object.entries(data.revenus.par_categorie).map(([cat, montant]) => (
                <tr key={cat}>
                  <td className={styles.indent}>{cat}</td>
                  <td className={styles.right}>{formatEur(montant)}</td>
                </tr>
              ))}
              <tr className={styles.subtotal}>
                <td><strong>Total Produits</strong></td>
                <td className={styles.right}><strong>{formatEur(data.revenus.total_ht)}</strong></td>
              </tr>

              <tr className={styles.spacer}><td colSpan={2} /></tr>

              {/* CHARGES */}
              <tr className={styles.sectionHeader}>
                <td colSpan={2}>CHARGES (DÉPENSES)</td>
              </tr>
              {Object.entries(data.charges.par_categorie).map(([cat, montant]) => (
                <tr key={cat}>
                  <td className={styles.indent}>{cat}</td>
                  <td className={`${styles.right} ${styles.chargeValue}`}>{formatEur(montant)}</td>
                </tr>
              ))}
              <tr className={styles.subtotal}>
                <td><strong>Total Charges</strong></td>
                <td className={`${styles.right} ${styles.chargeValue}`}>
                  <strong>{formatEur(data.charges.total_ht)}</strong>
                </td>
              </tr>

              <tr className={styles.spacer}><td colSpan={2} /></tr>

              {/* RÉSULTAT */}
              <tr className={`${styles.resultat} ${isPositif ? styles.resultatPositif : styles.resultatNegatif}`}>
                <td><strong>RÉSULTAT NET</strong></td>
                <td className={styles.right}>
                  <strong>{formatEur(resultat)}</strong>
                </td>
              </tr>
            </tbody>
          </table>

          <div className={styles.footer}>
            <span className={styles.footerLabel}>Période :</span>
            {new Date(debut).toLocaleDateString('fr-FR')} → {new Date(fin).toLocaleDateString('fr-FR')}
          </div>
        </div>
      )}

      {data && !loading && Object.keys(data.revenus.par_categorie).length === 0 && Object.keys(data.charges.par_categorie).length === 0 && (
        <p className={styles.empty}>Aucune donnée sur cette période.</p>
      )}
    </div>
  )
}
