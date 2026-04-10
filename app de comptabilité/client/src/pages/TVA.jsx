import { useState, useEffect } from 'react'
import { api, formatEur, formatDate } from '../lib/api.js'
import styles from './TVA.module.css'

function today() {
  return new Date().toISOString().slice(0, 7) // YYYY-MM
}

export default function TVA() {
  const [mois, setMois] = useState(today())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!mois) return
    setLoading(true)
    setError(null)
    api.getTVA(mois)
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [mois])

  const solde = data ? data.tva_a_reverser : 0
  const soldePositif = solde >= 0

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>TVA</h1>
          <p className={styles.pageSubtitle}>Déclaration mensuelle de TVA</p>
        </div>
        <div className={styles.monthPicker}>
          <label htmlFor="mois" className={styles.label}>Mois</label>
          <input
            id="mois"
            type="month"
            value={mois}
            onChange={e => setMois(e.target.value)}
            className={styles.input}
          />
        </div>
      </div>

      {loading && (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Calcul de la TVA…</p>
        </div>
      )}

      {error && <div className={styles.error}>⚠️ {error}</div>}

      {data && !loading && (
        <>
          <div className={styles.kpiRow}>
            <div className={styles.kpiCard}>
              <p className={styles.kpiLabel}>TVA Collectée</p>
              <p className={styles.kpiValue}>{formatEur(data.tva_collectee)}</p>
              <p className={styles.kpiSub}>Sur les ventes du mois</p>
            </div>
            <div className={styles.kpiCard}>
              <p className={styles.kpiLabel}>TVA Déductible</p>
              <p className={styles.kpiValue}>{formatEur(data.tva_deductible)}</p>
              <p className={styles.kpiSub}>Sur les achats du mois</p>
            </div>
            <div className={`${styles.kpiCard} ${soldePositif ? styles.kpiCardDue : styles.kpiCardCredit}`}>
              <p className={styles.kpiLabel}>TVA à Reverser</p>
              <p className={`${styles.kpiValue} ${soldePositif ? styles.valueDanger : styles.valueSuccess}`}>
                {formatEur(Math.abs(solde))}
              </p>
              <p className={styles.kpiSub}>
                {soldePositif ? 'Montant à reverser à l\'État' : 'Crédit de TVA'}
              </p>
            </div>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>
              Factures du mois
              <span className={styles.sectionCount}>{data.detail_factures.length}</span>
            </h2>
            {data.detail_factures.length === 0 ? (
              <p className={styles.empty}>Aucune facture ce mois-ci.</p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Numéro</th>
                    <th>Date</th>
                    <th>Client</th>
                    <th className={styles.right}>HT</th>
                    <th className={styles.right}>Taux TVA</th>
                    <th className={styles.right}>TVA</th>
                    <th className={styles.right}>TTC</th>
                  </tr>
                </thead>
                <tbody>
                  {data.detail_factures.map(f => (
                    <tr key={f.id}>
                      <td>{f.numero}</td>
                      <td>{formatDate(f.date)}</td>
                      <td>{f.client}</td>
                      <td className={styles.right}>{formatEur(f.montant_ht)}</td>
                      <td className={styles.right}>{f.taux_tva}%</td>
                      <td className={styles.right}>{formatEur(f.montant_tva)}</td>
                      <td className={styles.right}><strong>{formatEur(f.montant_ttc)}</strong></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}><strong>Total</strong></td>
                    <td className={styles.right}>
                      <strong>{formatEur(data.detail_factures.reduce((s, f) => s + f.montant_ht, 0))}</strong>
                    </td>
                    <td />
                    <td className={styles.right}>
                      <strong>{formatEur(data.tva_collectee)}</strong>
                    </td>
                    <td className={styles.right}>
                      <strong>{formatEur(data.detail_factures.reduce((s, f) => s + f.montant_ttc, 0))}</strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>
              Dépenses du mois
              <span className={styles.sectionCount}>{data.detail_depenses.length}</span>
            </h2>
            {data.detail_depenses.length === 0 ? (
              <p className={styles.empty}>Aucune dépense ce mois-ci.</p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Fournisseur</th>
                    <th>Description</th>
                    <th className={styles.right}>HT</th>
                    <th className={styles.right}>Taux TVA</th>
                    <th className={styles.right}>TVA</th>
                    <th className={styles.right}>TTC</th>
                  </tr>
                </thead>
                <tbody>
                  {data.detail_depenses.map(d => (
                    <tr key={d.id}>
                      <td>{formatDate(d.date)}</td>
                      <td>{d.fournisseur}</td>
                      <td>{d.description}</td>
                      <td className={styles.right}>{formatEur(d.montant_ht)}</td>
                      <td className={styles.right}>{d.taux_tva}%</td>
                      <td className={styles.right}>{formatEur(d.montant_tva)}</td>
                      <td className={styles.right}><strong>{formatEur(d.montant_ttc)}</strong></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}><strong>Total</strong></td>
                    <td className={styles.right}>
                      <strong>{formatEur(data.detail_depenses.reduce((s, d) => s + d.montant_ht, 0))}</strong>
                    </td>
                    <td />
                    <td className={styles.right}>
                      <strong>{formatEur(data.tva_deductible)}</strong>
                    </td>
                    <td className={styles.right}>
                      <strong>{formatEur(data.detail_depenses.reduce((s, d) => s + d.montant_ttc, 0))}</strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}
