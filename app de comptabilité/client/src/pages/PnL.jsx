import { useState, useEffect } from 'react'
import { api, formatEur } from '../lib/api.js'
import styles from './PnL.module.css'
import TransactionDrilldown from '../components/TransactionDrilldown/TransactionDrilldown.jsx'

function currentYear() {
  const y = new Date().getFullYear()
  return { debut: `${y}-01-01`, fin: new Date().toISOString().slice(0, 10) }
}

// Affiche les lignes d'un bucket { par_categorie, total }
function BucketRows({ bucket, onCategoryClick }) {
  const entries = Object.entries(bucket.par_categorie)
  if (entries.length === 0) return null
  return entries.map(([cat, montant]) => (
    <tr key={cat} className={styles.clickableRow} onClick={() => onCategoryClick(cat)}>
      <td className={styles.indent}>{cat}</td>
      <td className={styles.right}>{formatEur(montant)}</td>
    </tr>
  ))
}

function SubtotalRow({ label, total, isCharge }) {
  return (
    <tr className={styles.subtotal}>
      <td>{label}</td>
      <td className={`${styles.right} ${isCharge ? styles.chargeValue : ''}`}>
        {formatEur(total)}
      </td>
    </tr>
  )
}

function SigRow({ label, montant, note }) {
  return (
    <tr className={styles.sigRow}>
      <td>
        <strong>{label}</strong>
        {note && <span className={styles.sigNote}> {note}</span>}
      </td>
      <td className={styles.right}>
        <strong className={montant >= 0 ? styles.positif : styles.negatif}>
          {formatEur(montant)}
        </strong>
      </td>
    </tr>
  )
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

function Spacer() {
  return <tr className={styles.spacer}><td colSpan={2} /></tr>
}

export default function PnL() {
  const { debut: defaultDebut, fin: defaultFin } = currentYear()
  const [debut, setDebut]   = useState(defaultDebut)
  const [fin, setFin]       = useState(defaultFin)
  const [data, setData]         = useState(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [drilldown, setDrilldown] = useState(null) // { categorie, titre }

  function handleCategoryClick(categorie) {
    setDrilldown({ categorie, titre: categorie })
  }

  useEffect(() => {
    if (!debut || !fin) return
    setLoading(true)
    setError(null)
    api.getPnL(debut, fin)
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [debut, fin])

  const isEmpty = data && data.ca.total === 0 && data.total_charges_expl === 0
    && data.produits_financiers.total === 0 && data.produits_exceptionnels.total === 0

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Compte de résultat (P&amp;L)</h1>
          <p className={styles.pageSubtitle}>
            Soldes intermédiaires de gestion — PCG règlement ANC n°2014-03, art. 823-1
          </p>
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
        <div className={styles.loading}><div className={styles.spinner} /><p>Calcul…</p></div>
      )}
      {error && <div className={styles.error}>⚠️ {error}</div>}

      {data && !loading && !isEmpty && (
        <div className={styles.tableCard}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Libellé</th>
                <th className={styles.right}>Montant HT</th>
              </tr>
            </thead>
            <tbody>

              {/* ══════════════════════════════════════════════════════════
                  PRODUITS D'EXPLOITATION
              ══════════════════════════════════════════════════════════ */}
              <tr className={styles.sectionHeader}>
                <td colSpan={2}>I – PRODUITS D'EXPLOITATION</td>
              </tr>

              {/* Chiffre d'affaires */}
              {data.ca.total > 0 && (
                <>
                  <tr className={styles.subSectionHeader}>
                    <td colSpan={2}>Chiffre d'affaires</td>
                  </tr>
                  <BucketRows bucket={data.ca} onCategoryClick={handleCategoryClick} />
                  <SubtotalRow label="Total chiffre d'affaires" total={data.ca.total} />
                </>
              )}

              {/* Autres produits d'exploitation */}
              {data.autres_produits_expl.total > 0 && (
                <>
                  <tr className={styles.subSectionHeader}>
                    <td colSpan={2}>Autres produits d'exploitation</td>
                  </tr>
                  <BucketRows bucket={data.autres_produits_expl} onCategoryClick={handleCategoryClick} />
                  <SubtotalRow label="Total autres produits" total={data.autres_produits_expl.total} />
                </>
              )}

              <tr className={styles.subtotal}>
                <td><strong>Total produits d'exploitation</strong></td>
                <td className={styles.right}><strong>{formatEur(data.total_produits_expl)}</strong></td>
              </tr>

              <Spacer />

              {/* ══════════════════════════════════════════════════════════
                  CHARGES D'EXPLOITATION
              ══════════════════════════════════════════════════════════ */}
              <tr className={styles.sectionHeader}>
                <td colSpan={2}>II – CHARGES D'EXPLOITATION</td>
              </tr>

              {/* Achats consommés */}
              {data.achats.total > 0 && (
                <>
                  <tr className={styles.subSectionHeader}>
                    <td colSpan={2}>Achats consommés</td>
                  </tr>
                  <BucketRows bucket={data.achats} onCategoryClick={handleCategoryClick} />
                  <SubtotalRow label="Total achats consommés" total={data.achats.total} isCharge />
                </>
              )}

              {/* Charges externes */}
              {data.charges_externes.total > 0 && (
                <>
                  <tr className={styles.subSectionHeader}>
                    <td colSpan={2}>Charges externes</td>
                  </tr>
                  <BucketRows bucket={data.charges_externes} onCategoryClick={handleCategoryClick} />
                  <SubtotalRow label="Total charges externes" total={data.charges_externes.total} isCharge />
                </>
              )}

              {/* SIG : Valeur ajoutée */}
              <SigRow
                label="= VALEUR AJOUTÉE"
                montant={data.valeur_ajoutee}
                note="(CA + autres produits – achats – charges ext.)"
              />

              {/* Impôts et taxes */}
              {data.impots_taxes.total > 0 && (
                <>
                  <tr className={styles.subSectionHeader}>
                    <td colSpan={2}>Impôts, taxes et versements assimilés</td>
                  </tr>
                  <BucketRows bucket={data.impots_taxes} onCategoryClick={handleCategoryClick} />
                  <SubtotalRow label="Total impôts et taxes" total={data.impots_taxes.total} isCharge />
                </>
              )}

              {/* Charges de personnel */}
              {data.charges_personnel.total > 0 && (
                <>
                  <tr className={styles.subSectionHeader}>
                    <td colSpan={2}>Charges de personnel</td>
                  </tr>
                  <BucketRows bucket={data.charges_personnel} onCategoryClick={handleCategoryClick} />
                  <SubtotalRow label="Total charges de personnel" total={data.charges_personnel.total} isCharge />
                </>
              )}

              {/* SIG : EBE */}
              <SigRow
                label="= EXCÉDENT BRUT D'EXPLOITATION (EBE)"
                montant={data.ebe}
                note="(VA – impôts taxes – charges personnel)"
              />

              {/* Dotations aux amortissements */}
              {data.dotations.total > 0 && (
                <>
                  <tr className={styles.subSectionHeader}>
                    <td colSpan={2}>Dotations aux amortissements</td>
                  </tr>
                  <BucketRows bucket={data.dotations} onCategoryClick={handleCategoryClick} />
                  <SubtotalRow label="Total dotations" total={data.dotations.total} isCharge />
                </>
              )}

              <tr className={styles.subtotal}>
                <td><strong>Total charges d'exploitation</strong></td>
                <td className={`${styles.right} ${styles.chargeValue}`}>
                  <strong>{formatEur(data.total_charges_expl)}</strong>
                </td>
              </tr>

              <Spacer />

              {/* SIG : Résultat d'exploitation */}
              <ResultatRow
                label="III – RÉSULTAT D'EXPLOITATION"
                montant={data.resultat_exploitation}
                className={styles.resultatSection}
              />

              {/* ══════════════════════════════════════════════════════════
                  RÉSULTAT FINANCIER
              ══════════════════════════════════════════════════════════ */}
              {(data.produits_financiers.total !== 0 || data.charges_financieres.total !== 0) && (
                <>
                  <Spacer />
                  <tr className={styles.sectionHeader}>
                    <td colSpan={2}>IV – RÉSULTAT FINANCIER</td>
                  </tr>
                  {data.produits_financiers.total > 0 && (
                    <>
                      <BucketRows bucket={data.produits_financiers} onCategoryClick={handleCategoryClick} />
                      <SubtotalRow label="Total produits financiers" total={data.produits_financiers.total} />
                    </>
                  )}
                  {data.charges_financieres.total > 0 && (
                    <>
                      <BucketRows bucket={data.charges_financieres} onCategoryClick={handleCategoryClick} />
                      <SubtotalRow label="Total charges financières" total={data.charges_financieres.total} isCharge />
                    </>
                  )}
                  <ResultatRow
                    label="= Résultat financier"
                    montant={data.resultat_financier}
                    className={styles.resultatSection}
                  />
                </>
              )}

              {/* SIG : Résultat courant */}
              <Spacer />
              <ResultatRow
                label="V – RÉSULTAT COURANT AVANT IMPÔT"
                montant={data.resultat_courant}
                className={styles.resultatCourant}
              />

              {/* ══════════════════════════════════════════════════════════
                  RÉSULTAT EXCEPTIONNEL
              ══════════════════════════════════════════════════════════ */}
              {(data.produits_exceptionnels.total !== 0 || data.charges_exceptionnelles.total !== 0) && (
                <>
                  <Spacer />
                  <tr className={styles.sectionHeader}>
                    <td colSpan={2}>VI – RÉSULTAT EXCEPTIONNEL</td>
                  </tr>
                  {data.produits_exceptionnels.total > 0 && (
                    <>
                      <BucketRows bucket={data.produits_exceptionnels} onCategoryClick={handleCategoryClick} />
                      <SubtotalRow label="Total produits exceptionnels" total={data.produits_exceptionnels.total} />
                    </>
                  )}
                  {data.charges_exceptionnelles.total > 0 && (
                    <>
                      <BucketRows bucket={data.charges_exceptionnelles} onCategoryClick={handleCategoryClick} />
                      <SubtotalRow label="Total charges exceptionnelles" total={data.charges_exceptionnelles.total} isCharge />
                    </>
                  )}
                  <ResultatRow
                    label="= Résultat exceptionnel"
                    montant={data.resultat_exceptionnel}
                    className={styles.resultatSection}
                  />
                </>
              )}

              {/* Impôt sur les bénéfices */}
              {data.impot_societes.total > 0 && (
                <>
                  <Spacer />
                  <tr className={styles.sectionHeader}>
                    <td colSpan={2}>VII – IMPÔT SUR LES BÉNÉFICES</td>
                  </tr>
                  <BucketRows bucket={data.impot_societes} onCategoryClick={handleCategoryClick} />
                  <SubtotalRow label="Total IS" total={data.impot_societes.total} isCharge />
                </>
              )}

              {/* Résultat net */}
              <Spacer />
              <tr className={`${styles.resultatNet} ${data.resultat_net >= 0 ? styles.resultatPositif : styles.resultatNegatif}`}>
                <td><strong>RÉSULTAT NET DE L'EXERCICE</strong></td>
                <td className={styles.right}>
                  <strong>{formatEur(data.resultat_net)}</strong>
                </td>
              </tr>

            </tbody>
          </table>

          <div className={styles.footer}>
            <span>
              <span className={styles.footerLabel}>Période :</span>
              {new Date(debut).toLocaleDateString('fr-FR')} → {new Date(fin).toLocaleDateString('fr-FR')}
            </span>
            <span className={styles.footerNote}>
              Les mouvements de capitaux (Cl. 1) et immobilisations (Cl. 2) n'apparaissent pas dans le P&L — ils figurent au Bilan.
            </span>
          </div>
        </div>
      )}

      {data && !loading && isEmpty && (
        <p className={styles.empty}>Aucune donnée P&L sur cette période. Les entrées de capital, emprunts et immobilisations sont au Bilan.</p>
      )}

      {drilldown && (
        <TransactionDrilldown
          titre={drilldown.titre}
          params={{ categorie: drilldown.categorie, debut, fin }}
          onClose={() => setDrilldown(null)}
        />
      )}
    </div>
  )
}
