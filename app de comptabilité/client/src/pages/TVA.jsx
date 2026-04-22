import { useState, useEffect, useMemo, useRef } from 'react'
import { api, formatEur, formatDate } from '../lib/api.js'
import Spinner from '../components/Spinner/Spinner.jsx'
import styles from './TVA.module.css'

// ── Helpers ───────────────────────────────────────────────────────────────────

const LABEL_TAUX = {
  '20':  '20 % — Taux normal (art. 278 CGI)',
  '10':  '10 % — Taux intermédiaire (art. 278 bis CGI)',
  '5.5': '5,5 % — Taux réduit (art. 278-0 bis CGI)',
  '2.1': '2,1 % — Taux particulier (art. 281 nonies CGI)',
  '0':   '0 % — Exonéré (art. 261 CGI)',
}

function pad(n) { return String(n).padStart(2, '0') }
function round2(n) { return Math.round(n * 100) / 100 }

// Recalcule les champs dépendants selon le champ modifié (TTC est la valeur de référence)
function computePatch(field, newValue, row) {
  if (field === 'taux_tva') {
    // TTC est la valeur de référence (montant bancaire réel) ; HT est déduit du taux
    const ttc = row.montant_ttc
    const ht  = round2(ttc / (1 + newValue / 100))
    const tva = round2(ttc - ht)
    return { taux_tva: newValue, montant_ht: ht, montant_tva: tva }
  }
  if (field === 'montant_ttc') {
    const ttc = newValue
    const ht  = round2(ttc / (1 + row.taux_tva / 100))
    const tva = round2(ttc - ht)
    return { montant_ht: ht, montant_tva: tva, montant_ttc: ttc }
  }
  return {}
}

function lastDayOfMonth(year, month) {
  return new Date(Number(year), Number(month), 0).getDate()
}

function currentYear() { return new Date().getFullYear() }
function currentMonth() { return new Date().getMonth() + 1 } // 1-12

// Compute debut/fin from mode + selection
function getRange(mode, year, sub) {
  const y = Number(year)
  if (mode === 'mois') {
    const [yr, mo] = sub.split('-')
    return {
      debut: `${yr}-${mo}-01`,
      fin:   `${yr}-${mo}-${pad(lastDayOfMonth(yr, mo))}`,
    }
  }
  if (mode === 'trimestre') {
    const q = Number(sub) // 1-4
    const startM = (q - 1) * 3 + 1
    const endM   = q * 3
    return {
      debut: `${y}-${pad(startM)}-01`,
      fin:   `${y}-${pad(endM)}-${pad(lastDayOfMonth(y, endM))}`,
    }
  }
  if (mode === 'semestre') {
    return Number(sub) === 1
      ? { debut: `${y}-01-01`, fin: `${y}-06-30` }
      : { debut: `${y}-07-01`, fin: `${y}-12-31` }
  }
  // année
  return { debut: `${y}-01-01`, fin: `${y}-12-31` }
}

function periodLabel(mode, year, sub) {
  if (mode === 'mois') {
    const [yr, mo] = sub.split('-')
    return new Date(Number(yr), Number(mo) - 1, 1)
      .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  }
  if (mode === 'trimestre') return `T${sub} ${year}`
  if (mode === 'semestre')  return `S${sub} ${year}`
  return String(year)
}

const TAUX_EDIT_OPTIONS = [20, 10, 5.5, 2.1, 0]

// ── EditableCell ──────────────────────────────────────────────────────────────

function EditableCell({ value, field, row, align, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState('')
  const inputRef = useRef(null)

  function start() {
    setDraft(field === 'taux_tva' ? String(value) : String(value))
    setEditing(true)
  }

  function commit() {
    const parsed = parseFloat(String(draft).replace(',', '.'))
    if (!isNaN(parsed) && parsed !== value) onSave(field, parsed, row)
    setEditing(false)
  }

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus()
  }, [editing])

  if (editing && field === 'taux_tva') {
    return (
      <td className={`${align} ${styles.tdEditing}`}>
        <select
          ref={inputRef}
          className={styles.editSelect}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={() => { onSave(field, parseFloat(draft), row); setEditing(false) }}
          onKeyDown={e => { if (e.key === 'Escape') setEditing(false) }}
        >
          {TAUX_EDIT_OPTIONS.map(t => (
            <option key={t} value={t}>{t} %</option>
          ))}
        </select>
      </td>
    )
  }

  if (editing) {
    return (
      <td className={`${align} ${styles.tdEditing}`}>
        <input
          ref={inputRef}
          className={styles.editInput}
          type="number"
          step="0.01"
          min="0"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
        />
      </td>
    )
  }

  return (
    <td className={`${align} ${styles.editableCell}`} onClick={start} title="Cliquer pour modifier">
      {field === 'taux_tva' ? `${value} %` : formatEur(value)}
    </td>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

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
            <td>{LABEL_TAUX[taux] || `${taux} %`}</td>
            <td className={styles.right}>{formatEur(base_ht)}</td>
            <td className={styles.right}><strong>{formatEur(tva)}</strong></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Period picker ─────────────────────────────────────────────────────────────

function PeriodPicker({ mode, setMode, year, setYear, sub, setSub }) {
  const y = currentYear()
  const years = Array.from({ length: 6 }, (_, i) => y - i)

  return (
    <div className={styles.periodPicker}>
      {/* Mode buttons */}
      <div className={styles.modeRow}>
        {['mois', 'trimestre', 'semestre', 'année'].map(m => (
          <button
            key={m}
            className={`${styles.modeBtn} ${mode === m ? styles.modeBtnActive : ''}`}
            onClick={() => setMode(m)}
          >
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>

      {/* Sub-picker */}
      <div className={styles.subPicker}>
        {/* Year selector — shown for all modes except mois */}
        {mode !== 'mois' && (
          <select
            className={styles.yearSelect}
            value={year}
            onChange={e => setYear(Number(e.target.value))}
          >
            {years.map(yr => <option key={yr} value={yr}>{yr}</option>)}
          </select>
        )}

        {mode === 'mois' && (
          <input
            type="month"
            className={styles.input}
            value={sub}
            onChange={e => setSub(e.target.value)}
          />
        )}

        {mode === 'trimestre' && (
          <div className={styles.subBtns}>
            {[1, 2, 3, 4].map(q => (
              <button
                key={q}
                className={`${styles.subBtn} ${Number(sub) === q ? styles.subBtnActive : ''}`}
                onClick={() => setSub(q)}
              >
                T{q}
              </button>
            ))}
          </div>
        )}

        {mode === 'semestre' && (
          <div className={styles.subBtns}>
            {[1, 2].map(s => (
              <button
                key={s}
                className={`${styles.subBtn} ${Number(sub) === s ? styles.subBtnActive : ''}`}
                onClick={() => setSub(s)}
              >
                S{s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const LS_KEY = 'tva_periode'

function loadSaved() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_KEY))
    if (s?.mode) return s
  } catch (_) {}
  return {
    mode: 'mois',
    year: currentYear(),
    sub:  `${currentYear()}-${pad(currentMonth())}`,
  }
}

export default function TVA() {
  const saved = loadSaved()
  const [mode, setMode] = useState(saved.mode)
  const [year, setYear] = useState(saved.year)
  const [sub,  setSub]  = useState(saved.sub)

  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  // ── Filters for detail tables ──────────────────────────────────────────────
  const [fTiers, setFTiers] = useState('')
  const [fTaux,  setFTaux]  = useState('')
  const [dTiers, setDTiers] = useState('')
  const [dTaux,  setDTaux]  = useState('')

  // Persist on change
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify({ mode, year, sub }))
  }, [mode, year, sub])

  // Reset sub to sensible default when mode changes
  function handleModeChange(m) {
    setMode(m)
    if (m === 'mois') setSub(`${currentYear()}-${pad(currentMonth())}`)
    else if (m === 'trimestre') setSub(Math.ceil(currentMonth() / 3))
    else if (m === 'semestre')  setSub(currentMonth() <= 6 ? 1 : 2)
    // année: no sub needed
  }

  const { debut, fin } = useMemo(
    () => getRange(mode, year, sub),
    [mode, year, sub]
  )

  async function handleSave(type, id, field, newValue, row) {
    const patch = computePatch(field, newValue, row)
    if (!Object.keys(patch).length) return
    try {
      if (type === 'facture') await api.updateFacture(id, patch)
      else                    await api.updateDepense(id, patch)
      const d = await api.getTVA(debut, fin)
      setData(d)
    } catch (e) {
      console.error('Erreur enregistrement TVA :', e.message)
    }
  }

  const label = useMemo(() => periodLabel(mode, year, sub), [mode, year, sub])

  const filteredFactures = useMemo(() => {
    if (!data?.detail_factures) return []
    let rows = data.detail_factures
    if (fTiers) { const q = fTiers.toLowerCase(); rows = rows.filter(f => (f.client || '').toLowerCase().includes(q)) }
    if (fTaux)  rows = rows.filter(f => String(f.taux_tva) === fTaux)
    return rows
  }, [data, fTiers, fTaux])

  const filteredDepenses = useMemo(() => {
    if (!data?.detail_depenses) return []
    let rows = data.detail_depenses
    if (dTiers) { const q = dTiers.toLowerCase(); rows = rows.filter(d => (d.fournisseur || '').toLowerCase().includes(q)) }
    if (dTaux)  rows = rows.filter(d => String(d.taux_tva) === dTaux)
    return rows
  }, [data, dTiers, dTaux])

  const tauxOptions = useMemo(() => {
    if (!data) return []
    const all = [...(data.detail_factures || []), ...(data.detail_depenses || [])]
    return [...new Set(all.map(r => String(r.taux_tva)))].sort((a, b) => Number(b) - Number(a))
  }, [data])

  useEffect(() => {
    if (!debut || !fin) return
    setLoading(true); setError(null)
    api.getTVA(debut, fin)
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [debut, fin])

  const modeLabel = { mois: 'mensuelle', trimestre: 'trimestrielle', semestre: 'semestrielle', 'année': 'annuelle' }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>TVA</h1>
          <p className={styles.pageSubtitle}>
            Déclaration {modeLabel[mode]} — conforme CA3 (art. 287 CGI)
          </p>
        </div>
        <PeriodPicker
          mode={mode} setMode={handleModeChange}
          year={year} setYear={setYear}
          sub={sub}   setSub={setSub}
        />
      </div>

      {loading && (
        <div className={styles.loading}>
          <Spinner />
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
              <p className={styles.kpiSub}>Sur entrées — {label} (44571)</p>
            </div>
            <div className={styles.kpiCard}>
              <p className={styles.kpiLabel}>TVA Déductible</p>
              <p className={styles.kpiValue}>{formatEur(data.deductible.total_tva)}</p>
              <p className={styles.kpiSub}>Sur sorties — {label} (44566)</p>
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

          {/* ── Ventilation par taux ─────────────────────────────────── */}
          <div className={styles.ventilationGrid}>
            <div className={styles.ventilationCard}>
              <h2 className={styles.sectionTitle}>
                TVA Collectée (entrées) — Ventilation par taux
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
                TVA Déductible (sorties) — Ventilation par taux
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
              Entrées — {label}
              <span className={styles.sectionCount}>
                {fTiers || fTaux ? `${filteredFactures.length} / ${data.detail_factures.length}` : data.detail_factures.length}
              </span>
            </h2>
            {data.detail_factures.length === 0 ? (
              <p className={styles.empty}>Aucune entrée sur cette période.</p>
            ) : (
              <>
                <div className={styles.filterBar}>
                  <input
                    className={styles.filterInput}
                    type="text"
                    placeholder="Rechercher un client…"
                    value={fTiers}
                    onChange={e => setFTiers(e.target.value)}
                  />
                  <select
                    className={styles.filterSelect}
                    value={fTaux}
                    onChange={e => setFTaux(e.target.value)}
                  >
                    <option value="">Tous taux TVA</option>
                    {tauxOptions.map(t => <option key={t} value={t}>{t} %</option>)}
                  </select>
                  {(fTiers || fTaux) && (
                    <button className={styles.btnClearFilters} onClick={() => { setFTiers(''); setFTaux('') }}>
                      × Effacer
                    </button>
                  )}
                </div>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Date</th><th>Tiers</th>
                      <th className={styles.right}>HT</th>
                      <th className={styles.right}>Taux</th>
                      <th className={styles.right}>TVA</th>
                      <th className={styles.right}>TTC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFactures.length === 0 ? (
                      <tr><td colSpan={6} className={styles.emptyCell}>Aucun résultat.</td></tr>
                    ) : filteredFactures.map(f => (
                      <tr key={f.id}>
                        <td>{formatDate(f.date)}</td>
                        <td>{f.client}</td>
                        <td className={styles.right}>{formatEur(f.montant_ht)}</td>
                        <EditableCell value={f.taux_tva}    field="taux_tva"    row={f} align={styles.right} onSave={(field, val, row) => handleSave('facture', f.id, field, val, row)} />
                        <td className={styles.right}>{formatEur(f.montant_tva)}</td>
                        <EditableCell value={f.montant_ttc} field="montant_ttc" row={f} align={`${styles.right} ${styles.ttcCell}`} onSave={(field, val, row) => handleSave('facture', f.id, field, val, row)} />
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={2}><strong>Total{(fTiers || fTaux) ? ' (filtré)' : ''}</strong></td>
                      <td className={styles.right}><strong>{formatEur(filteredFactures.reduce((s, f) => s + f.montant_ht, 0))}</strong></td>
                      <td />
                      <td className={styles.right}><strong>{formatEur(filteredFactures.reduce((s, f) => s + f.montant_tva, 0))}</strong></td>
                      <td className={styles.right}><strong>{formatEur(filteredFactures.reduce((s, f) => s + f.montant_ttc, 0))}</strong></td>
                    </tr>
                  </tfoot>
                </table>
              </>
            )}
          </div>

          {/* ── Détail dépenses ──────────────────────────────────────── */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>
              Sorties — {label}
              <span className={styles.sectionCount}>
                {dTiers || dTaux ? `${filteredDepenses.length} / ${data.detail_depenses.length}` : data.detail_depenses.length}
              </span>
            </h2>
            {data.detail_depenses.length === 0 ? (
              <p className={styles.empty}>Aucune sortie sur cette période.</p>
            ) : (
              <>
                <div className={styles.filterBar}>
                  <input
                    className={styles.filterInput}
                    type="text"
                    placeholder="Rechercher un fournisseur…"
                    value={dTiers}
                    onChange={e => setDTiers(e.target.value)}
                  />
                  <select
                    className={styles.filterSelect}
                    value={dTaux}
                    onChange={e => setDTaux(e.target.value)}
                  >
                    <option value="">Tous taux TVA</option>
                    {tauxOptions.map(t => <option key={t} value={t}>{t} %</option>)}
                  </select>
                  {(dTiers || dTaux) && (
                    <button className={styles.btnClearFilters} onClick={() => { setDTiers(''); setDTaux('') }}>
                      × Effacer
                    </button>
                  )}
                </div>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Date</th><th>Tiers</th>
                      <th className={styles.right}>HT</th>
                      <th className={styles.right}>Taux</th>
                      <th className={styles.right}>TVA</th>
                      <th className={styles.right}>TTC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDepenses.length === 0 ? (
                      <tr><td colSpan={6} className={styles.emptyCell}>Aucun résultat.</td></tr>
                    ) : filteredDepenses.map(d => (
                      <tr key={d.id}>
                        <td>{formatDate(d.date)}</td>
                        <td>{d.fournisseur}</td>
                        <td className={styles.right}>{formatEur(d.montant_ht)}</td>
                        <EditableCell value={d.taux_tva}    field="taux_tva"    row={d} align={styles.right} onSave={(field, val, row) => handleSave('depense', d.id, field, val, row)} />
                        <td className={styles.right}>{formatEur(d.montant_tva)}</td>
                        <EditableCell value={d.montant_ttc} field="montant_ttc" row={d} align={`${styles.right} ${styles.ttcCell}`} onSave={(field, val, row) => handleSave('depense', d.id, field, val, row)} />
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={2}><strong>Total{(dTiers || dTaux) ? ' (filtré)' : ''}</strong></td>
                      <td className={styles.right}><strong>{formatEur(filteredDepenses.reduce((s, d) => s + d.montant_ht, 0))}</strong></td>
                      <td />
                      <td className={styles.right}><strong>{formatEur(filteredDepenses.reduce((s, d) => s + d.montant_tva, 0))}</strong></td>
                      <td className={styles.right}><strong>{formatEur(filteredDepenses.reduce((s, d) => s + d.montant_ttc, 0))}</strong></td>
                    </tr>
                  </tfoot>
                </table>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
