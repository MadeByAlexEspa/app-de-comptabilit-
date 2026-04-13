import { useState, useEffect } from 'react'
import { api, formatEur } from '../lib/api.js'
import styles from './PnL.module.css'

function currentYear() {
  const y = new Date().getFullYear()
  return { debut: `${y}-01-01`, fin: new Date().toISOString().slice(0, 10) }
}

function SectionRows({ par_categorie }) {
  const entries = Object.entries(par_categorie)
  if (entries.length === 0) return null
  return entries.map(([cat, montant]) => (
    <tr key={cat}>
      <td className={styles.indent}>{cat}</td>
      <td className={styles.right}>{formatEur(montant)}</td>
    </tr>
  ))
}

function ResultatRow({ label, montant, className }) {
  return (
    <tr className={className}>
      <td><strong>{label}</strong></td>
      <td className={styles.right}>
        <strong className={montant >= 0 ? styles.positif : styles.negatif}>
          {formatEur(montant)}
        </strong>
      </td>
    </tr>
  )
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

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Compte de résultat (P&amp;L)</h1>
          <p className={styles.pageSubtitle}>Conforme PCG — règlement ANC n°2014-03, art. 823-1</p>
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
          <p>Calcul du P&amp;L…</p>
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

              {/* ── PRODUITS D'EXPLOITATION ─────────────────────────────── */}
              <tr className={styles.sectionHeader}>
                <td colSpan={2}>PRODUITS D'EXPLOITATION (Classe 7)</td>
              </tr>
              <SectionRows par_categorie={data.produits.exploitation.par_categorie} />
              <tr className={styles.subtotal}>
                <td>Total produits d'exploitation</td>
                <td className={styles.right}>{formatEur(data.produits.exploitation.total)}</td>
              </tr>

              <tr className={styles.spacer}><td colSpan={2} /></tr>

              {/* ── CHARGES D'EXPLOITATION ──────────────────────────────── */}
              <tr className={styles.sectionHeader}>
                <td colSpan={2}>CHARGES D'EXPLOITATION (Classe 6)</td>
              </tr>
              <SectionRows par_categorie={data.charges.exploitation.par_categorie} />
              <tr className={styles.subtotal}>
                <td>Total charges d'exploitation</td>
                <td className={`${styles.right} ${styles.chargeValue}`}>{formatEur(data.charges.exploitation.total)}</td>
              </tr>

              <tr className={styles.spacer}><td colSpan={2} /></tr>
              <ResultatRow
                label="RÉSULTAT D'EXPLOITATION"
                montant={data.resultat_exploitation}
                className={styles.resultatSection}
              />

              {/* ── RÉSULTAT FINANCIER ──────────────────────────────────── */}
              {(data.produits.financier.total !== 0 || data.charges.financier.total !== 0) && (
                <>
                  <tr className={styles.spacer}><td colSpan={2} /></tr>
                  <tr className={styles.sectionHeader}>
                    <td colSpan={2}>RÉSULTAT FINANCIER</td>
                  </tr>
                  {data.produits.financier.total !== 0 && (
                    <>
                      <SectionRows par_categorie={data.produits.financier.par_categorie} />
                      <tr className={styles.subtotal}>
                        <td>Total produits financiers</td>
                        <td className={styles.right}>{formatEur(data.produits.financier.total)}</td>
                      </tr>
                    </>
                  )}
                  {data.charges.financier.total !== 0 && (
                    <>
                      <SectionRows par_categorie={data.charges.financier.par_categorie} />
                      <tr className={styles.subtotal}>
                        <td>Total charges financières</td>
                        <td className={`${styles.right} ${styles.chargeValue}`}>{formatEur(data.charges.financier.total)}</td>
                      </tr>
                    </>
                  )}
                  <ResultatRow
                    label="RÉSULTAT FINANCIER"
                    montant={data.resultat_financier}
                    className={styles.resultatSection}
                  />
                </>
              )}

              {/* ── RÉSULTAT COURANT ────────────────────────────────────── */}
              <tr className={styles.spacer}><td colSpan={2} /></tr>
              <ResultatRow
                label="RÉSULTAT COURANT AVANT IMPÔT"
                montant={data.resultat_courant}
                className={styles.resultatCourant}
              />

              {/* ── RÉSULTAT EXCEPTIONNEL ───────────────────────────────── */}
              {(data.produits.exceptionnel.total !== 0 || data.charges.exceptionnel.total !== 0) && (
                <>
                  <tr className={styles.spacer}><td colSpan={2} /></tr>
                  <tr className={styles.sectionHeader}>
                    <td colSpan={2}>RÉSULTAT EXCEPTIONNEL</td>
                  </tr>
                  {data.produits.exceptionnel.total !== 0 && (
                    <>
                      <SectionRows par_categorie={data.produits.exceptionnel.par_categorie} />
                      <tr className={styles.subtotal}>
                        <td>Total produits exceptionnels</td>
                        <td className={styles.right}>{formatEur(data.produits.exceptionnel.total)}</td>
                      </tr>
                    </>
                  )}
                  {data.charges.exceptionnel.total !== 0 && (
                    <>
                      <SectionRows par_categorie={data.charges.exceptionnel.par_categorie} />
                      <tr className={styles.subtotal}>
                        <td>Total charges exceptionnelles</td>
                        <td className={`${styles.right} ${styles.chargeValue}`}>{formatEur(data.charges.exceptionnel.total)}</td>
                      </tr>
                    </>
                  )}
                  <ResultatRow
                    label="RÉSULTAT EXCEPTIONNEL"
                    montant={data.resultat_exceptionnel}
                    className={styles.resultatSection}
                  />
                </>
              )}

              {/* ── RÉSULTAT NET ────────────────────────────────────────── */}
              <tr className={styles.spacer}><td colSpan={2} /></tr>
              <tr className={`${styles.resultatNet} ${data.resultat_net >= 0 ? styles.resultatPositif : styles.resultatNegatif}`}>
                <td><strong>RÉSULTAT NET (avant IS)</strong></td>
                <td className={styles.right}>
                  <strong>{formatEur(data.resultat_net)}</strong>
                </td>
              </tr>

            </tbody>
          </table>

          <div className={styles.footer}>
            <span className={styles.footerLabel}>Période :</span>
            {new Date(debut).toLocaleDateString('fr-FR')} → {new Date(fin).toLocaleDateString('fr-FR')}
            <span className={styles.footerNote}>
              IS non inclus — calculé en fin d'exercice selon le régime fiscal
            </span>
          </div>
        </div>
      )}

      {data && !loading && data.produits.total === 0 && data.charges.total === 0 && (
        <p className={styles.empty}>Aucune donnée sur cette période.</p>
      )}
    </div>
  )
}
