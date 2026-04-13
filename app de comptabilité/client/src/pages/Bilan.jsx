import { useState, useEffect } from 'react'
import { api, formatEur } from '../lib/api.js'
import styles from './Bilan.module.css'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function BilanRow({ label, compte, montant, highlight }) {
  if (montant === 0) return null
  return (
    <tr className={highlight ? styles.highlight : ''}>
      <td>
        {label}
        {compte && <span className={styles.compte}>{compte}</span>}
      </td>
      <td className={styles.right}>{formatEur(montant)}</td>
    </tr>
  )
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

  const equilibre = data ? Math.abs(data.actif.total - data.passif.total) < 0.02 : false

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Bilan</h1>
          <p className={styles.pageSubtitle}>Conforme PCG — règlement ANC n°2014-03, art. 821-1</p>
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
                  <tr className={styles.groupHeader}><td colSpan={2}>Actif circulant</td></tr>
                  <BilanRow
                    label="Créances clients"
                    compte="(41)"
                    montant={data.actif.creances_clients}
                  />
                  <BilanRow
                    label="Crédit de TVA"
                    compte="(44567)"
                    montant={data.actif.credit_tva}
                  />
                  <BilanRow
                    label="Disponibilités"
                    compte="(512)"
                    montant={data.actif.disponibilites}
                  />
                </tbody>
                <tfoot>
                  <tr className={styles.total}>
                    <td><strong>Total Actif</strong></td>
                    <td className={styles.right}><strong>{formatEur(data.actif.total)}</strong></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* PASSIF */}
            <div className={styles.bilanCard}>
              <h2 className={styles.bilanCardTitle}>PASSIF</h2>
              <table className={styles.table}>
                <tbody>
                  <tr className={styles.groupHeader}><td colSpan={2}>Capitaux propres</td></tr>
                  <BilanRow
                    label="Résultat de l'exercice"
                    compte="(12)"
                    montant={data.passif.resultat_exercice}
                    highlight
                  />
                  <tr className={styles.groupHeader}><td colSpan={2}>Dettes</td></tr>
                  <BilanRow
                    label="Dettes fournisseurs"
                    compte="(40)"
                    montant={data.passif.dettes_fournisseurs}
                  />
                  <BilanRow
                    label="TVA à décaisser"
                    compte="(44551)"
                    montant={data.passif.tva_a_decaisser}
                  />
                  <BilanRow
                    label="Découvert bancaire"
                    compte="(564)"
                    montant={data.passif.decouvert}
                  />
                </tbody>
                <tfoot>
                  <tr className={styles.total}>
                    <td><strong>Total Passif</strong></td>
                    <td className={styles.right}><strong>{formatEur(data.passif.total)}</strong></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className={`${styles.equilibre} ${equilibre ? styles.equilibreOk : styles.equilibreWarn}`}>
            {equilibre
              ? '✓ Bilan équilibré (Actif = Passif)'
              : `⚠️ Écart de ${formatEur(Math.abs(data.actif.total - data.passif.total))}`}
          </div>

          <p className={styles.hint}>
            Actif circulant uniquement — les immobilisations (classe 2) ne sont pas suivies dans cette version simplifiée.
            Résultat calculé depuis le 1er janvier {date.slice(0, 4)}.
          </p>
        </>
      )}
    </div>
  )
}
