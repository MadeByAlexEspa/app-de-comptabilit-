import { useState, useEffect } from 'react'
import { api, formatEur } from '../lib/api.js'
import styles from './Bilan.module.css'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function BilanRow({ label, compte, montant }) {
  if (montant === 0) return null
  return (
    <tr>
      <td className={styles.rowLabel}>
        {label}
        {compte && <span className={styles.compte}>{compte}</span>}
      </td>
      <td className={styles.right}>{formatEur(montant)}</td>
    </tr>
  )
}

function ImmoCatRows({ par_categorie }) {
  return Object.entries(par_categorie).map(([cat, montant]) => (
    <tr key={cat} className={styles.subRow}>
      <td className={styles.subLabel}>{cat}</td>
      <td className={styles.right}>{formatEur(montant)}</td>
    </tr>
  ))
}

function GroupHeader({ label }) {
  return <tr className={styles.groupHeader}><td colSpan={2}>{label}</td></tr>
}

function SubTotal({ label, montant }) {
  if (montant === 0) return null
  return (
    <tr className={styles.subTotal}>
      <td>{label}</td>
      <td className={styles.right}>{formatEur(montant)}</td>
    </tr>
  )
}

export default function Bilan() {
  const [date, setDate]   = useState(todayStr())
  const [data, setData]   = useState(null)
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

  const equilibre = data
    ? Math.abs(data.actif.total - data.passif.total) < 0.02
    : false

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Bilan</h1>
          <p className={styles.pageSubtitle}>
            Conforme PCG — règlement ANC n°2014-03, art. 821-1
          </p>
        </div>
        <div className={styles.datePicker}>
          <label className={styles.label}>Date d'arrêté</label>
          <input
            type="date" value={date}
            onChange={e => setDate(e.target.value)}
            className={styles.input}
          />
        </div>
      </div>

      {loading && (
        <div className={styles.loading}><div className={styles.spinner} /><p>Calcul du bilan…</p></div>
      )}
      {error && <div className={styles.error}>⚠️ {error}</div>}

      {data && !loading && (
        <>
          <div className={styles.bilanGrid}>

            {/* ════════════════════════════════════════════
                ACTIF
            ════════════════════════════════════════════ */}
            <div className={styles.bilanCard}>
              <h2 className={styles.bilanCardTitle}>ACTIF</h2>
              <table className={styles.table}>
                <tbody>

                  {/* Actif immobilisé */}
                  {data.actif.immobilise.total > 0 && (
                    <>
                      <GroupHeader label="Actif immobilisé" />

                      {data.actif.immobilise.incorporelles.total > 0 && (
                        <>
                          <tr className={styles.subGroupHeader}>
                            <td colSpan={2}>Immobilisations incorporelles (Cl. 2)</td>
                          </tr>
                          <ImmoCatRows par_categorie={data.actif.immobilise.incorporelles.par_categorie} />
                          <SubTotal
                            label="Sous-total incorporelles"
                            montant={data.actif.immobilise.incorporelles.total}
                          />
                        </>
                      )}

                      {data.actif.immobilise.corporelles.total > 0 && (
                        <>
                          <tr className={styles.subGroupHeader}>
                            <td colSpan={2}>Immobilisations corporelles (Cl. 2)</td>
                          </tr>
                          <ImmoCatRows par_categorie={data.actif.immobilise.corporelles.par_categorie} />
                          <SubTotal
                            label="Sous-total corporelles"
                            montant={data.actif.immobilise.corporelles.total}
                          />
                        </>
                      )}

                      <tr className={styles.groupTotal}>
                        <td>Total actif immobilisé</td>
                        <td className={styles.right}>{formatEur(data.actif.immobilise.total)}</td>
                      </tr>
                    </>
                  )}

                  {/* Actif circulant */}
                  <GroupHeader label="Actif circulant" />
                  <BilanRow
                    label="Créances clients"
                    compte="(41)"
                    montant={data.actif.circulant.creances_clients}
                  />
                  <BilanRow
                    label="Crédit de TVA"
                    compte="(44567)"
                    montant={data.actif.circulant.credit_tva}
                  />
                  <BilanRow
                    label="Disponibilités – Banque"
                    compte="(512)"
                    montant={data.actif.circulant.disponibilites}
                  />
                  <tr className={styles.groupTotal}>
                    <td>Total actif circulant</td>
                    <td className={styles.right}>{formatEur(data.actif.circulant.total)}</td>
                  </tr>

                </tbody>
                <tfoot>
                  <tr className={styles.total}>
                    <td><strong>TOTAL ACTIF</strong></td>
                    <td className={styles.right}><strong>{formatEur(data.actif.total)}</strong></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* ════════════════════════════════════════════
                PASSIF
            ════════════════════════════════════════════ */}
            <div className={styles.bilanCard}>
              <h2 className={styles.bilanCardTitle}>PASSIF</h2>
              <table className={styles.table}>
                <tbody>

                  {/* Capitaux propres */}
                  <GroupHeader label="Capitaux propres" />
                  <BilanRow
                    label="Capital social"
                    compte="(101)"
                    montant={data.passif.capitaux_propres.capital_social}
                  />
                  <BilanRow
                    label={data.passif.capitaux_propres.compte_exploitant >= 0
                      ? 'Compte exploitant (apports nets)'
                      : 'Compte exploitant (prélèvements nets)'}
                    compte="(108)"
                    montant={data.passif.capitaux_propres.compte_exploitant}
                  />
                  <tr className={`${styles.rowResultat} ${data.passif.capitaux_propres.resultat_exercice >= 0 ? styles.resultatPos : styles.resultatNeg}`}>
                    <td className={styles.rowLabel}>
                      Résultat de l'exercice
                      <span className={styles.compte}>(12)</span>
                    </td>
                    <td className={styles.right}>
                      {formatEur(data.passif.capitaux_propres.resultat_exercice)}
                    </td>
                  </tr>
                  <tr className={styles.groupTotal}>
                    <td>Total capitaux propres</td>
                    <td className={styles.right}>{formatEur(data.passif.capitaux_propres.total)}</td>
                  </tr>

                  {/* Dettes financières */}
                  {data.passif.dettes_financieres.total > 0 && (
                    <>
                      <GroupHeader label="Dettes financières" />
                      <BilanRow
                        label="Emprunts bancaires (net)"
                        compte="(164)"
                        montant={data.passif.dettes_financieres.emprunts}
                      />
                      <BilanRow
                        label="Comptes courants associés (net)"
                        compte="(455)"
                        montant={data.passif.dettes_financieres.comptes_courants}
                      />
                      <tr className={styles.groupTotal}>
                        <td>Total dettes financières</td>
                        <td className={styles.right}>{formatEur(data.passif.dettes_financieres.total)}</td>
                      </tr>
                    </>
                  )}

                  {/* Dettes d'exploitation */}
                  <GroupHeader label="Dettes d'exploitation" />
                  <BilanRow
                    label="Dettes fournisseurs"
                    compte="(40)"
                    montant={data.passif.dettes_exploitation.dettes_fournisseurs}
                  />
                  <BilanRow
                    label="TVA à décaisser"
                    compte="(44551)"
                    montant={data.passif.dettes_exploitation.tva_a_decaisser}
                  />
                  <BilanRow
                    label="Découvert bancaire"
                    compte="(564)"
                    montant={data.passif.dettes_exploitation.decouvert}
                  />
                  <tr className={styles.groupTotal}>
                    <td>Total dettes d'exploitation</td>
                    <td className={styles.right}>{formatEur(data.passif.dettes_exploitation.total)}</td>
                  </tr>

                </tbody>
                <tfoot>
                  <tr className={styles.total}>
                    <td><strong>TOTAL PASSIF</strong></td>
                    <td className={styles.right}><strong>{formatEur(data.passif.total)}</strong></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className={`${styles.equilibre} ${equilibre ? styles.equilibreOk : styles.equilibreWarn}`}>
            {equilibre
              ? '✓ Bilan équilibré — Actif = Passif'
              : `⚠️ Écart de ${formatEur(Math.abs(data.actif.total - data.passif.total))} — vérifiez les catégories de vos transactions`}
          </div>

          <p className={styles.hint}>
            Résultat calculé depuis le 1er janvier {date.slice(0, 4)} (catégories Cl. 6 &amp; 7 uniquement).
            Les immobilisations sont à leur coût d'acquisition brut, sans amortissement.
            Capital, emprunts et C/C associés sont cumulés depuis l'origine de l'entreprise.
          </p>
        </>
      )}
    </div>
  )
}
