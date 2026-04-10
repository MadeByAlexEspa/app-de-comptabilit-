import { useState, useEffect } from 'react'
import { api, formatEur } from '../lib/api.js'
import styles from './Bilan.module.css'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export default function Bilan() {
  const [date, setDate] = useState(todayStr())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!date) return
    setLoading(true)
    setError(null)
    api.getBilan(date)
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [date])

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Bilan</h1>
          <p className={styles.pageSubtitle}>Situation patrimoniale à une date donnée</p>
        </div>
        <div className={styles.datePicker}>
          <label className={styles.label}>Date d'arrêté</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className={styles.input}
          />
        </div>
      </div>

      {loading && (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Calcul du bilan…</p>
        </div>
      )}

      {error && <div className={styles.error}>⚠️ {error}</div>}

      {data && !loading && (
        <>
          <div className={styles.bilanGrid}>
            {/* ACTIF */}
            <div className={styles.bilanCard}>
              <h2 className={styles.bilanCardTitle}>ACTIF</h2>
              <table className={styles.table}>
                <tbody>
                  <tr>
                    <td>Créances clients</td>
                    <td className={styles.right}>{formatEur(data.actif.creances_clients)}</td>
                  </tr>
                  <tr>
                    <td>Trésorerie</td>
                    <td className={styles.right}>{formatEur(data.actif.tresorerie)}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className={styles.total}>
                    <td><strong>Total Actif</strong></td>
                    <td className={styles.right}><strong>{formatEur(data.actif.total)}</strong></td>
                  </tr>
                </tfoot>
              </table>
              <p className={styles.hint}>
                Créances = factures en attente (TTC) · Trésorerie = encaissements − décaissements
              </p>
            </div>

            {/* PASSIF */}
            <div className={styles.bilanCard}>
              <h2 className={styles.bilanCardTitle}>PASSIF</h2>
              <table className={styles.table}>
                <tbody>
                  <tr>
                    <td>Dettes fournisseurs</td>
                    <td className={styles.right}>{formatEur(data.passif.dettes_fournisseurs)}</td>
                  </tr>
                  <tr>
                    <td>TVA à payer</td>
                    <td className={styles.right}>{formatEur(data.passif.tva_a_payer)}</td>
                  </tr>
                  <tr>
                    <td>Capitaux propres</td>
                    <td className={styles.right}>{formatEur(data.passif.capital)}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className={styles.total}>
                    <td><strong>Total Passif</strong></td>
                    <td className={styles.right}><strong>{formatEur(data.passif.total)}</strong></td>
                  </tr>
                </tfoot>
              </table>
              <p className={styles.hint}>
                Dettes = dépenses en attente (TTC) · Capitaux = Actif − Dettes − TVA
              </p>
            </div>
          </div>

          <div className={`${styles.equilibre} ${Math.abs(data.actif.total - data.passif.total) < 0.01 ? styles.equilibreOk : styles.equilibreWarn}`}>
            {Math.abs(data.actif.total - data.passif.total) < 0.01
              ? '✓ Le bilan est équilibré'
              : `⚠️ Écart de ${formatEur(Math.abs(data.actif.total - data.passif.total))}`}
          </div>
        </>
      )}
    </div>
  )
}
