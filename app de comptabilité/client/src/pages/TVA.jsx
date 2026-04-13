import { useState, useEffect } from 'react'
import { api, formatEur, formatDate } from '../lib/api.js'
import styles from './TVA.module.css'

function today() {
  return new Date().toISOString().slice(0, 7) // YYYY-MM
}

const LABEL_TAUX = {
  '20':  '20 % — Taux normal (art. 278 CGI)',
  '10':  '10 % — Taux intermédiaire (art. 278 bis CGI)',
  '5.5': '5,5 % — Taux réduit (art. 278-0 bis CGI)',
  '2.1': '2,1 % — Taux particulier (art. 281 nonies CGI)',
  '0':   '0 % — Exonéré (art. 261 CGI)',
}

function TauxTable({ par_taux }) {
  const lignes = Object.entries(par_taux).filter(([, v]) => v.base_ht !== 0 || v.tva !== 0)
  if (lignes.length === 0) return <p className={styles.empty}>Aucune opération.</p>
  return (
    <table className={styles.tauxTable}>
      <thead>
        <tr>
          <th>Taux</th>
          <th className={styles.right}>Base HT</th>
          <th className={styles.right}>TVA</th>
        </tr>
      </thead>
      <tbody>
        {lignes.map(([taux, { base_ht, tva }]) => (
          <tr key={taux}>
            <td>{LABEL_TAUX[taux] || `${taux}%`}</td>
            <td className={styles.right}>{formatEur(base_ht)}</td>
            <td className={styles.right}><strong>{formatEur(tva)}</strong></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
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

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>TVA</h1>
          <p className={styles.pageSubtitle}>Déclaration mensuelle — conforme CA3 (art. 287 CGI)</p>
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
          {/* ── KPI ─────────────────────────────────────────────────────── */}
          <div className={styles.kpiRow}>
            <div className={styles.kpiCard}>
              <p className={styles.kpiLabel}>TVA Collectée</p>
              <p className={styles.kpiValue}>{formatEur(data.collectee.total_tva)}</p>
              <p className={styles.kpiSub}>Sur ventes du mois (44571)</p>
            </div>
            <div className={styles.kpiCard}>
              <p className={styles.kpiLabel}>TVA Déductible</p>
              <p className={styles.kpiValue}>{formatEur(data.deductible.total_tva)}</p>
              <p className={styles.kpiSub}>Sur achats du mois (44566)</p>
            </div>
            {data.tva_a_reverser > 0 ? (
              <div className={`${styles.kpiCard} ${styles.kpiCardDue}`}>
                <p className={styles.kpiLabel}>TVA à Reverser</p>
                <p className={`${styles.kpiValue} ${styles.valueDanger}`}>{formatEur(data.tva_a_reverser)}</p>
                <p className={styles.kpiSub}>À régler à l'État (44551)</p>
              </div>
            ) : (
              <div className={`${styles.kpiCard} ${styles.kpiCardCredit}`}>
                <p className={styles.kpiLabel}>Crédit de TVA</p>
                <p className={`${styles.kpiValue} ${styles.valueSuccess}`}>{formatEur(data.credit_tva)}</p>
                <p className={styles.kpiSub}>Remboursable ou reportable (44567)</p>
              </div>
            )}
          </div>

          {/* ── Ventilation par taux (structure CA3) ─────────────────── */}
          <div className={styles.ventilationGrid}>
            <div className={styles.ventilationCard}>
              <h2 className={styles.sectionTitle}>
                TVA Collectée — Ventilation par taux
                <span className={styles.sectionNote}>Lignes A1–A4 de la CA3</span>
              </h2>
              <TauxTable par_taux={data.collectee.par_taux} />
              {Object.keys(data.collectee.par_taux).length > 0 && (
                <div className={styles.ventilationTotal}>
                  Total base HT : <strong>{formatEur(data.collectee.total_base_ht)}</strong>
                  &nbsp;·&nbsp;
                  Total TVA : <strong>{formatEur(data.collectee.total_tva)}</strong>
                </div>
              )}
            </div>

            <div className={styles.ventilationCard}>
              <h2 className={styles.sectionTitle}>
                TVA Déductible — Ventilation par taux
                <span className={styles.sectionNote}>Ligne 20 de la CA3</span>
              </h2>
              <TauxTable par_taux={data.deductible.par_taux} />
              {Object.keys(data.deductible.par_taux).length > 0 && (
                <div className={styles.ventilationTotal}>
                  Total base HT : <strong>{formatEur(data.deductible.total_base_ht)}</strong>
                  &nbsp;·&nbsp;
                  Total TVA : <strong>{formatEur(data.deductible.total_tva)}</strong>
                </div>
              )}
            </div>
          </div>

          {/* ── Détail factures ──────────────────────────────────────── */}
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
                    <th className={styles.right}>Taux</th>
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
                    <td className={styles.right}><strong>{formatEur(data.collectee.total_base_ht)}</strong></td>
                    <td />
                    <td className={styles.right}><strong>{formatEur(data.collectee.total_tva)}</strong></td>
                    <td className={styles.right}><strong>{formatEur(data.detail_factures.reduce((s, f) => s + f.montant_ttc, 0))}</strong></td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          {/* ── Détail dépenses ──────────────────────────────────────── */}
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
                    <th className={styles.right}>Taux</th>
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
                    <td className={styles.right}><strong>{formatEur(data.deductible.total_base_ht)}</strong></td>
                    <td />
                    <td className={styles.right}><strong>{formatEur(data.deductible.total_tva)}</strong></td>
                    <td className={styles.right}><strong>{formatEur(data.detail_depenses.reduce((s, d) => s + d.montant_ttc, 0))}</strong></td>
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
