import { useState, useEffect } from 'react'
import { api, formatEur } from '../lib/api.js'
import styles from './Exercice.module.css'
import pnlStyles from './PnL.module.css'
import bilanStyles from './Bilan.module.css'
import TransactionDrilldown from '../components/TransactionDrilldown/TransactionDrilldown.jsx'

// ── Helpers ───────────────────────────────────────────────────────────────────

function today() { return new Date().toISOString().slice(0, 10) }

function exercicePresets() {
  const now = new Date()
  const y = now.getFullYear()
  return [
    { label: 'Cette année',      debut: `${y}-01-01`,     fin: today() },
    { label: 'Année complète',   debut: `${y}-01-01`,     fin: `${y}-12-31` },
    { label: 'Année précédente', debut: `${y - 1}-01-01`, fin: `${y - 1}-12-31` },
    { label: 'S1',               debut: `${y}-01-01`,     fin: `${y}-06-30` },
    { label: 'S2',               debut: `${y}-07-01`,     fin: `${y}-12-31` },
  ]
}

// ── Liasse reference badge ────────────────────────────────────────────────────

function LR({ v, css }) {
  return <span className={css}>{v}</span>
}

// ── P&L tab ───────────────────────────────────────────────────────────────────

function BucketRows({ bucket, onCategoryClick }) {
  return Object.entries(bucket.par_categorie).map(([cat, montant]) => (
    <tr key={cat} className={pnlStyles.clickableRow} onClick={() => onCategoryClick(cat)}>
      <td className={pnlStyles.indent}>{cat}</td>
      <td className={pnlStyles.right}>{formatEur(montant)}</td>
    </tr>
  ))
}

function SubtotalRow({ label, total, isCharge, liasse }) {
  return (
    <tr className={pnlStyles.subtotal}>
      <td>
        {label}
        {liasse && <LR v={liasse} css={pnlStyles.liasseRef} />}
      </td>
      <td className={`${pnlStyles.right} ${isCharge ? pnlStyles.chargeValue : ''}`}>
        {formatEur(total)}
      </td>
    </tr>
  )
}

function SigRow({ label, montant, note, liasse }) {
  return (
    <tr className={pnlStyles.sigRow}>
      <td>
        <strong>{label}</strong>
        {note && <span className={pnlStyles.sigNote}> {note}</span>}
        {liasse && <LR v={liasse} css={pnlStyles.liasseRef} />}
      </td>
      <td className={pnlStyles.right}>
        <strong className={montant >= 0 ? pnlStyles.positif : pnlStyles.negatif}>
          {formatEur(montant)}
        </strong>
      </td>
    </tr>
  )
}

function ResultatRow({ label, montant, className, liasse }) {
  return (
    <tr className={className}>
      <td>
        <strong>{label}</strong>
        {liasse && <LR v={liasse} css={pnlStyles.liasseRef} />}
      </td>
      <td className={pnlStyles.right}>
        <strong className={montant >= 0 ? pnlStyles.positif : pnlStyles.negatif}>
          {formatEur(montant)}
        </strong>
      </td>
    </tr>
  )
}

function PnlSpacer() {
  return <tr className={pnlStyles.spacer}><td colSpan={2} /></tr>
}

// Section header with optional right-aligned liasse form ref
function PnlSectionHeader({ children, liasse }) {
  return (
    <tr className={pnlStyles.sectionHeader}>
      <td colSpan={2} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{children}</span>
        {liasse && <LR v={liasse} css={pnlStyles.liasseRef} />}
      </td>
    </tr>
  )
}

function PnLTab({ debut, fin }) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const [drilldown, setDrilldown] = useState(null)

  useEffect(() => {
    if (!debut || !fin) return
    let ignore = false
    setLoading(true); setError(null)
    api.getPnL(debut, fin)
      .then(d => { if (!ignore) { setData(d); setLoading(false) } })
      .catch(e => { if (!ignore) { setError(e.message); setLoading(false) } })
    return () => { ignore = true }
  }, [debut, fin])

  if (loading) return <div className={pnlStyles.loading}><div className={pnlStyles.spinner} /><p>Calcul…</p></div>
  if (error)   return <div className={pnlStyles.error}>⚠️ {error}</div>
  if (!data)   return null

  const isEmpty = data.ca.total === 0 && data.total_charges_expl === 0
    && data.produits_financiers.total === 0 && data.produits_exceptionnels.total === 0

  if (isEmpty) return (
    <p className={pnlStyles.empty}>
      Aucune donnée P&L sur cette période. Les entrées de capital, emprunts et immobilisations sont au Bilan.
    </p>
  )

  return (
    <>
      <div className={pnlStyles.tableCard}>
        <table className={pnlStyles.table}>
          <thead>
            <tr>
              <th>Libellé</th>
              <th className={pnlStyles.right}>Montant HT</th>
            </tr>
          </thead>
          <tbody>

            {/* ── I. Produits d'exploitation ── */}
            <PnlSectionHeader liasse="Formulaire 2052">I – PRODUITS D'EXPLOITATION</PnlSectionHeader>

            {data.ca.total > 0 && (
              <>
                <tr className={pnlStyles.subSectionHeader}><td colSpan={2}>Chiffre d'affaires</td></tr>
                <BucketRows bucket={data.ca} onCategoryClick={c => setDrilldown({ categorie: c, titre: c })} />
                <SubtotalRow label="Total chiffre d'affaires" total={data.ca.total} liasse="2052 · FD" />
              </>
            )}

            {data.autres_produits_expl.total > 0 && (
              <>
                <tr className={pnlStyles.subSectionHeader}><td colSpan={2}>Autres produits d'exploitation</td></tr>
                <BucketRows bucket={data.autres_produits_expl} onCategoryClick={c => setDrilldown({ categorie: c, titre: c })} />
                <SubtotalRow label="Total autres produits" total={data.autres_produits_expl.total} liasse="2052 · FG–FI" />
              </>
            )}

            <tr className={pnlStyles.subtotal}>
              <td>
                <strong>Total produits d'exploitation</strong>
                <LR v="2052 · FJ" css={pnlStyles.liasseRef} />
              </td>
              <td className={pnlStyles.right}><strong>{formatEur(data.total_produits_expl)}</strong></td>
            </tr>

            <PnlSpacer />

            {/* ── II. Charges d'exploitation ── */}
            <PnlSectionHeader liasse="Formulaire 2052">II – CHARGES D'EXPLOITATION</PnlSectionHeader>

            {data.achats.total > 0 && (
              <>
                <tr className={pnlStyles.subSectionHeader}><td colSpan={2}>Achats consommés</td></tr>
                <BucketRows bucket={data.achats} onCategoryClick={c => setDrilldown({ categorie: c, titre: c })} />
                <SubtotalRow label="Total achats consommés" total={data.achats.total} isCharge liasse="2052 · GA–GD" />
              </>
            )}

            {data.charges_externes.total > 0 && (
              <>
                <tr className={pnlStyles.subSectionHeader}><td colSpan={2}>Charges externes</td></tr>
                <BucketRows bucket={data.charges_externes} onCategoryClick={c => setDrilldown({ categorie: c, titre: c })} />
                <SubtotalRow label="Total charges externes" total={data.charges_externes.total} isCharge liasse="2052 · GE" />
              </>
            )}

            <SigRow
              label="= VALEUR AJOUTÉE"
              montant={data.valeur_ajoutee}
              note="(CA + autres produits – achats – charges ext.)"
              liasse="PCG – SIG"
            />

            {data.impots_taxes.total > 0 && (
              <>
                <tr className={pnlStyles.subSectionHeader}><td colSpan={2}>Impôts, taxes et versements assimilés</td></tr>
                <BucketRows bucket={data.impots_taxes} onCategoryClick={c => setDrilldown({ categorie: c, titre: c })} />
                <SubtotalRow label="Total impôts et taxes" total={data.impots_taxes.total} isCharge liasse="2052 · GF" />
              </>
            )}

            {data.charges_personnel.total > 0 && (
              <>
                <tr className={pnlStyles.subSectionHeader}><td colSpan={2}>Charges de personnel</td></tr>
                <BucketRows bucket={data.charges_personnel} onCategoryClick={c => setDrilldown({ categorie: c, titre: c })} />
                <SubtotalRow label="Total charges de personnel" total={data.charges_personnel.total} isCharge liasse="2052 · GG–GH" />
              </>
            )}

            <SigRow
              label="= EXCÉDENT BRUT D'EXPLOITATION (EBE)"
              montant={data.ebe}
              note="(VA – impôts taxes – charges personnel)"
              liasse="PCG – SIG"
            />

            {data.dotations.total > 0 && (
              <>
                <tr className={pnlStyles.subSectionHeader}><td colSpan={2}>Dotations aux amortissements</td></tr>
                <BucketRows bucket={data.dotations} onCategoryClick={c => setDrilldown({ categorie: c, titre: c })} />
                <SubtotalRow label="Total dotations" total={data.dotations.total} isCharge liasse="2052 · GI–GK" />
              </>
            )}

            <tr className={pnlStyles.subtotal}>
              <td>
                <strong>Total charges d'exploitation</strong>
                <LR v="2052 · GM" css={pnlStyles.liasseRef} />
              </td>
              <td className={`${pnlStyles.right} ${pnlStyles.chargeValue}`}>
                <strong>{formatEur(data.total_charges_expl)}</strong>
              </td>
            </tr>

            <PnlSpacer />

            {/* ── III. Résultat d'exploitation ── */}
            <ResultatRow
              label="III – RÉSULTAT D'EXPLOITATION"
              montant={data.resultat_exploitation}
              className={pnlStyles.resultatSection}
              liasse="2052 · GN/GO"
            />

            {/* ── IV. Résultat financier ── */}
            {(data.produits_financiers.total !== 0 || data.charges_financieres.total !== 0) && (
              <>
                <PnlSpacer />
                <PnlSectionHeader liasse="Formulaire 2052">IV – RÉSULTAT FINANCIER</PnlSectionHeader>
                {data.produits_financiers.total > 0 && (
                  <>
                    <BucketRows bucket={data.produits_financiers} onCategoryClick={c => setDrilldown({ categorie: c, titre: c })} />
                    <SubtotalRow label="Total produits financiers" total={data.produits_financiers.total} liasse="2052 · HG" />
                  </>
                )}
                {data.charges_financieres.total > 0 && (
                  <>
                    <BucketRows bucket={data.charges_financieres} onCategoryClick={c => setDrilldown({ categorie: c, titre: c })} />
                    <SubtotalRow label="Total charges financières" total={data.charges_financieres.total} isCharge liasse="2052 · IE" />
                  </>
                )}
                <ResultatRow
                  label="= Résultat financier"
                  montant={data.resultat_financier}
                  className={pnlStyles.resultatSection}
                  liasse="2052 · IF/IG"
                />
              </>
            )}

            <PnlSpacer />
            {/* ── V. Résultat courant ── */}
            <ResultatRow
              label="V – RÉSULTAT COURANT AVANT IMPÔT"
              montant={data.resultat_courant}
              className={pnlStyles.resultatCourant}
              liasse="2052 · IH/II"
            />

            {/* ── VI. Résultat exceptionnel ── */}
            {(data.produits_exceptionnels.total !== 0 || data.charges_exceptionnelles.total !== 0) && (
              <>
                <PnlSpacer />
                <PnlSectionHeader liasse="Formulaire 2053">VI – RÉSULTAT EXCEPTIONNEL</PnlSectionHeader>
                {data.produits_exceptionnels.total > 0 && (
                  <>
                    <BucketRows bucket={data.produits_exceptionnels} onCategoryClick={c => setDrilldown({ categorie: c, titre: c })} />
                    <SubtotalRow label="Total produits exceptionnels" total={data.produits_exceptionnels.total} liasse="2053 · JD" />
                  </>
                )}
                {data.charges_exceptionnelles.total > 0 && (
                  <>
                    <BucketRows bucket={data.charges_exceptionnelles} onCategoryClick={c => setDrilldown({ categorie: c, titre: c })} />
                    <SubtotalRow label="Total charges exceptionnelles" total={data.charges_exceptionnelles.total} isCharge liasse="2053 · JH" />
                  </>
                )}
                <ResultatRow
                  label="= Résultat exceptionnel"
                  montant={data.resultat_exceptionnel}
                  className={pnlStyles.resultatSection}
                  liasse="2053 · JI/JJ"
                />
              </>
            )}

            {/* ── VII. Impôt sur les bénéfices ── */}
            {data.impot_societes.total > 0 && (
              <>
                <PnlSpacer />
                <PnlSectionHeader liasse="Formulaire 2053">VII – IMPÔT SUR LES BÉNÉFICES</PnlSectionHeader>
                <BucketRows bucket={data.impot_societes} onCategoryClick={c => setDrilldown({ categorie: c, titre: c })} />
                <SubtotalRow label="Total IS" total={data.impot_societes.total} isCharge liasse="2053 · KE" />
              </>
            )}

            <PnlSpacer />
            {/* ── Résultat net ── */}
            <tr className={`${pnlStyles.resultatNet} ${data.resultat_net >= 0 ? pnlStyles.resultatPositif : pnlStyles.resultatNegatif}`}>
              <td>
                <strong>RÉSULTAT NET DE L'EXERCICE</strong>
                <LR v="2053 · KG/KH" css={pnlStyles.liasseRef} />
              </td>
              <td className={pnlStyles.right}><strong>{formatEur(data.resultat_net)}</strong></td>
            </tr>

          </tbody>
        </table>

        <div className={pnlStyles.footer}>
          <span>
            <span className={pnlStyles.footerLabel}>Période :</span>
            {new Date(debut).toLocaleDateString('fr-FR')} → {new Date(fin).toLocaleDateString('fr-FR')}
          </span>
          <span className={pnlStyles.footerNote}>
            Les mouvements de capitaux (Cl. 1) et immobilisations (Cl. 2) n'apparaissent pas dans le compte de résultat — ils figurent au Bilan.
          </span>
        </div>
      </div>

      {drilldown && (
        <TransactionDrilldown
          titre={drilldown.titre}
          params={{ categorie: drilldown.categorie, debut, fin }}
          onClose={() => setDrilldown(null)}
        />
      )}
    </>
  )
}

// ── Bilan tab ─────────────────────────────────────────────────────────────────

function BilanRow({ label, compte, liasse, montant, onClick }) {
  if (montant === 0) return null
  return (
    <tr className={onClick ? bilanStyles.clickableRow : undefined} onClick={onClick}>
      <td className={bilanStyles.rowLabel}>
        {label}
        {compte && <span className={bilanStyles.compte}>{compte}</span>}
        {liasse && <span className={bilanStyles.liasseRef}>{liasse}</span>}
      </td>
      <td className={bilanStyles.right}>{formatEur(montant)}</td>
    </tr>
  )
}

function ImmoCatRows({ par_categorie, onCategoryClick }) {
  return Object.entries(par_categorie).map(([cat, montant]) => (
    <tr key={cat} className={`${bilanStyles.subRow} ${bilanStyles.clickableRow}`} onClick={() => onCategoryClick(cat)}>
      <td className={bilanStyles.subLabel}>{cat}</td>
      <td className={bilanStyles.right}>{formatEur(montant)}</td>
    </tr>
  ))
}

function GroupHeader({ label, liasse }) {
  return (
    <tr className={bilanStyles.groupHeader}>
      <td colSpan={2} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{label}</span>
        {liasse && <span className={bilanStyles.liasseRef}>{liasse}</span>}
      </td>
    </tr>
  )
}

function SubTotal({ label, montant, liasse }) {
  if (montant === 0) return null
  return (
    <tr className={bilanStyles.subTotal}>
      <td>
        {label}
        {liasse && <span className={bilanStyles.liasseRef}>{liasse}</span>}
      </td>
      <td className={bilanStyles.right}>{formatEur(montant)}</td>
    </tr>
  )
}

function BilanTab({ debut, fin }) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const [drilldown, setDrilldown] = useState(null)

  useEffect(() => {
    if (!fin) return
    let ignore = false
    setLoading(true); setError(null)
    api.getBilan(fin, debut)
      .then(d => { if (!ignore) { setData(d); setLoading(false) } })
      .catch(e => { if (!ignore) { setError(e.message); setLoading(false) } })
    return () => { ignore = true }
  }, [debut, fin])

  if (loading) return <div className={bilanStyles.loading}><div className={bilanStyles.spinner} /><p>Calcul du bilan…</p></div>
  if (error)   return <div className={bilanStyles.error}>⚠️ {error}</div>
  if (!data)   return null

  const equilibre = Math.abs(data.actif.total - data.passif.total) < 0.02

  function openCategorie(cat) {
    setDrilldown({ titre: cat, params: { categorie: cat, fin } })
  }
  function openFiltre(filtre, titre) {
    setDrilldown({ titre, params: { filtre, fin } })
  }

  return (
    <>
      <div className={bilanStyles.bilanGrid}>

        {/* ── ACTIF ── */}
        <div className={bilanStyles.bilanCard}>
          <h2 className={bilanStyles.bilanCardTitle}>ACTIF</h2>
          <table className={bilanStyles.table}>
            <tbody>
              {data.actif.immobilise.total > 0 && (
                <>
                  <GroupHeader label="Actif immobilisé" liasse="Formulaire 2050" />

                  {data.actif.immobilise.incorporelles.total > 0 && (
                    <>
                      <tr className={bilanStyles.subGroupHeader}>
                        <td colSpan={2} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>Immobilisations incorporelles (Cl. 2)</span>
                          <span className={bilanStyles.liasseRef}>2050 · AU (net)</span>
                        </td>
                      </tr>
                      <ImmoCatRows par_categorie={data.actif.immobilise.incorporelles.par_categorie} onCategoryClick={openCategorie} />
                      <SubTotal label="Sous-total incorporelles" montant={data.actif.immobilise.incorporelles.total} liasse="2050 · AU" />
                    </>
                  )}

                  {data.actif.immobilise.corporelles.total > 0 && (
                    <>
                      <tr className={bilanStyles.subGroupHeader}>
                        <td colSpan={2} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>Immobilisations corporelles (Cl. 2)</span>
                          <span className={bilanStyles.liasseRef}>2050 · BP (net)</span>
                        </td>
                      </tr>
                      <ImmoCatRows par_categorie={data.actif.immobilise.corporelles.par_categorie} onCategoryClick={openCategorie} />
                      <SubTotal label="Sous-total corporelles" montant={data.actif.immobilise.corporelles.total} liasse="2050 · BP" />
                    </>
                  )}

                  <tr className={bilanStyles.groupTotal}>
                    <td>
                      Total actif immobilisé
                      <span className={bilanStyles.liasseRef}>2050 · BV</span>
                    </td>
                    <td className={bilanStyles.right}>{formatEur(data.actif.immobilise.total)}</td>
                  </tr>
                </>
              )}

              <GroupHeader label="Actif circulant" liasse="Formulaire 2050" />
              <BilanRow label="Créances clients" compte="(41)" liasse="2050 · CT" montant={data.actif.circulant.creances_clients}
                onClick={() => openFiltre('creances_clients', 'Créances clients — factures en attente')} />
              <BilanRow label="Crédit de TVA" compte="(44567)" liasse="2050 · CW" montant={data.actif.circulant.credit_tva} />
              <BilanRow label="Disponibilités – Banque" compte="(512)" liasse="2050 · DB" montant={data.actif.circulant.disponibilites} />
              <tr className={bilanStyles.groupTotal}>
                <td>
                  Total actif circulant
                  <span className={bilanStyles.liasseRef}>2050 · DH</span>
                </td>
                <td className={bilanStyles.right}>{formatEur(data.actif.circulant.total)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr className={bilanStyles.total}>
                <td>
                  <strong>TOTAL ACTIF</strong>
                  <span className={bilanStyles.liasseRef}>2050 · DP</span>
                </td>
                <td className={bilanStyles.right}><strong>{formatEur(data.actif.total)}</strong></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ── PASSIF ── */}
        <div className={bilanStyles.bilanCard}>
          <h2 className={bilanStyles.bilanCardTitle}>PASSIF</h2>
          <table className={bilanStyles.table}>
            <tbody>
              <GroupHeader label="Capitaux propres" liasse="Formulaire 2051" />
              <BilanRow label="Capital social" compte="(101)" liasse="2051 · DA" montant={data.passif.capitaux_propres.capital_social} />
              <BilanRow
                label={data.passif.capitaux_propres.compte_exploitant >= 0 ? 'Compte exploitant (apports nets)' : 'Compte exploitant (prélèvements nets)'}
                compte="(108)"
                liasse="2051 · DH"
                montant={data.passif.capitaux_propres.compte_exploitant}
              />
              <BilanRow
                label={data.passif.capitaux_propres.report_a_nouveau >= 0 ? 'Report à nouveau (bénéficiaire)' : 'Report à nouveau (déficitaire)'}
                compte="(11)"
                liasse="2051 · DG"
                montant={data.passif.capitaux_propres.report_a_nouveau}
              />
              <tr className={`${bilanStyles.rowResultat} ${data.passif.capitaux_propres.resultat_exercice >= 0 ? bilanStyles.resultatPos : bilanStyles.resultatNeg}`}>
                <td className={bilanStyles.rowLabel}>
                  Résultat de l'exercice
                  <span className={bilanStyles.compte}>(12)</span>
                  <span className={bilanStyles.liasseRef}>2051 · DI/DJ</span>
                </td>
                <td className={bilanStyles.right}>{formatEur(data.passif.capitaux_propres.resultat_exercice)}</td>
              </tr>
              <tr className={bilanStyles.groupTotal}>
                <td>
                  Total capitaux propres
                  <span className={bilanStyles.liasseRef}>2051 · DM</span>
                </td>
                <td className={bilanStyles.right}>{formatEur(data.passif.capitaux_propres.total)}</td>
              </tr>

              {data.passif.dettes_financieres.total > 0 && (
                <>
                  <GroupHeader label="Dettes financières" liasse="Formulaire 2051" />
                  <BilanRow label="Emprunts bancaires (net)" compte="(164)" liasse="2051 · FB" montant={data.passif.dettes_financieres.emprunts} />
                  <BilanRow label="Comptes courants associés (net)" compte="(455)" liasse="2051 · FC" montant={data.passif.dettes_financieres.comptes_courants} />
                  <tr className={bilanStyles.groupTotal}>
                    <td>
                      Total dettes financières
                      <span className={bilanStyles.liasseRef}>2051 · FJ</span>
                    </td>
                    <td className={bilanStyles.right}>{formatEur(data.passif.dettes_financieres.total)}</td>
                  </tr>
                </>
              )}

              <GroupHeader label="Dettes d'exploitation" liasse="Formulaire 2051" />
              <BilanRow label="Dettes fournisseurs" compte="(40)" liasse="2051 · FE" montant={data.passif.dettes_exploitation.dettes_fournisseurs}
                onClick={() => openFiltre('dettes_fournisseurs', 'Dettes fournisseurs — dépenses en attente')} />
              <BilanRow label="TVA à décaisser" compte="(44551)" liasse="2051 · FF" montant={data.passif.dettes_exploitation.tva_a_decaisser} />
              <BilanRow label="Découvert bancaire" compte="(564)" liasse="2051 · FB" montant={data.passif.dettes_exploitation.decouvert} />
              <tr className={bilanStyles.groupTotal}>
                <td>
                  Total dettes d'exploitation
                  <span className={bilanStyles.liasseRef}>2051 · FJ</span>
                </td>
                <td className={bilanStyles.right}>{formatEur(data.passif.dettes_exploitation.total)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr className={bilanStyles.total}>
                <td>
                  <strong>TOTAL PASSIF</strong>
                  <span className={bilanStyles.liasseRef}>2051 · FL</span>
                </td>
                <td className={bilanStyles.right}><strong>{formatEur(data.passif.total)}</strong></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className={`${bilanStyles.equilibre} ${equilibre ? bilanStyles.equilibreOk : bilanStyles.equilibreWarn}`}>
        {equilibre
          ? '✓ Bilan équilibré — Actif = Passif'
          : `⚠️ Écart de ${formatEur(Math.abs(data.actif.total - data.passif.total))} — vérifiez les catégories de vos transactions`}
      </div>

      <p className={bilanStyles.hint}>
        Résultat calculé du {new Date(debut).toLocaleDateString('fr-FR')} au {new Date(fin).toLocaleDateString('fr-FR')} (catégories Cl. 6 &amp; 7 uniquement).
        Les immobilisations sont à leur coût d'acquisition brut, sans amortissement.
        Capital, emprunts et C/C associés sont cumulés depuis l'origine de l'entreprise.
      </p>

      {drilldown && (
        <TransactionDrilldown
          titre={drilldown.titre}
          params={drilldown.params}
          onClose={() => setDrilldown(null)}
        />
      )}
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const LS_KEY = 'exercice_params'

function loadSaved(presets) {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY))
    if (saved?.debut && saved?.fin) return saved
  } catch (_) {}
  return { debut: presets[0].debut, fin: presets[0].fin, activeTab: 'pnl', activePreset: 0 }
}

export default function Exercice() {
  const presets = exercicePresets()
  const saved   = loadSaved(presets)

  const [debut,        setDebut]        = useState(saved.debut)
  const [fin,          setFin]          = useState(saved.fin)
  const [activeTab,    setActiveTab]    = useState(saved.activeTab ?? 'pnl')
  const [activePreset, setActivePreset] = useState(saved.activePreset ?? null)

  function persist(next) {
    localStorage.setItem(LS_KEY, JSON.stringify(next))
  }

  function applyPreset(index) {
    const next = { debut: presets[index].debut, fin: presets[index].fin, activeTab, activePreset: index }
    setActivePreset(index)
    setDebut(next.debut)
    setFin(next.fin)
    persist(next)
  }

  function handleDebutChange(val) {
    setDebut(val)
    setActivePreset(null)
    persist({ debut: val, fin, activeTab, activePreset: null })
  }
  function handleFinChange(val) {
    setFin(val)
    setActivePreset(null)
    persist({ debut, fin: val, activeTab, activePreset: null })
  }
  function handleTabChange(tab) {
    setActiveTab(tab)
    persist({ debut, fin, activeTab: tab, activePreset })
  }

  return (
    <div className={styles.page}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Comptes annuels</h1>
          <p className={styles.pageSubtitle}>
            Compte de résultat &amp; Bilan — PCG règlement ANC n°2014-03
          </p>
        </div>
      </div>

      {/* ── Exercice picker ─────────────────────────────────────────────── */}
      <div className={styles.exerciceBar}>
        <div className={styles.exerciceLabel}>Exercice comptable</div>
        <div className={styles.presets}>
          {presets.map((p, i) => (
            <button
              key={p.label}
              className={`${styles.presetBtn} ${activePreset === i ? styles.presetActive : ''}`}
              onClick={() => applyPreset(i)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className={styles.datePicker}>
          <div className={styles.dateGroup}>
            <label className={styles.dateLabel}>Du</label>
            <input
              type="date"
              className={styles.dateInput}
              value={debut}
              onChange={e => handleDebutChange(e.target.value)}
            />
          </div>
          <span className={styles.dateSep}>→</span>
          <div className={styles.dateGroup}>
            <label className={styles.dateLabel}>Au</label>
            <input
              type="date"
              className={styles.dateInput}
              value={fin}
              onChange={e => handleFinChange(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'pnl' ? styles.tabActive : ''}`}
          onClick={() => handleTabChange('pnl')}
        >
          Compte de résultat
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'bilan' ? styles.tabActive : ''}`}
          onClick={() => handleTabChange('bilan')}
        >
          Bilan
        </button>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      {activeTab === 'pnl'   && <PnLTab   debut={debut} fin={fin} />}
      {activeTab === 'bilan' && <BilanTab debut={debut} fin={fin} />}

    </div>
  )
}
