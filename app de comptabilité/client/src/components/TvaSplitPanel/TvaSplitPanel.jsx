import { useState } from 'react'
import Modal from '../Modal/Modal.jsx'
import { formatEur } from '../../lib/api.js'
import styles from './TvaSplitPanel.module.css'

const TVA_OPTIONS = [
  { value: '20',  label: '20 %' },
  { value: '10',  label: '10 %' },
  { value: '5.5', label: '5,5 %' },
  { value: '2.1', label: '2,1 %' },
  { value: '0',   label: '0 %' },
]

function round2(n) { return Math.round(n * 100) / 100 }

// row      : the facture/depense object
// onSave   : async (row, tvaLines) => void
//            tvaLines = [{ taux_tva, montant_ht, montant_tva }]
// onClose  : () => void
export default function TvaSplitPanel({ row, onSave, onClose }) {
  const ttcRef = row.montant_ttc

  const [lines, setLines] = useState(() => {
    if (row.taux_tva === -1 && row.tva_lines) {
      try {
        return JSON.parse(row.tva_lines).map(l => ({
          taux_tva:   String(l.taux_tva),
          montant_ht: String(l.montant_ht),
        }))
      } catch {}
    }
    const defaultTaux = row.taux_tva >= 0 ? String(row.taux_tva) : '20'
    return [{ taux_tva: defaultTaux, montant_ht: '' }]
  })

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)

  const computed = lines.map(l => {
    const ht   = round2(parseFloat(l.montant_ht) || 0)
    const taux = parseFloat(l.taux_tva) || 0
    const tva  = round2(ht * taux / 100)
    return { ...l, _ht: ht, _taux: taux, _tva: tva, _ttc: round2(ht + tva) }
  })

  const totalTtc = round2(computed.reduce((s, l) => s + l._ttc, 0))
  const diff     = round2(totalTtc - ttcRef)
  const valid    = lines.length >= 1
    && computed.every(l => l._ht > 0)
    && Math.abs(diff) < 0.02

  function addLine()           { setLines(l => [...l, { taux_tva: '20', montant_ht: '' }]) }
  function removeLine(i)       { setLines(l => l.filter((_, j) => j !== i)) }
  function update(i, key, val) { setLines(l => l.map((x, j) => j === i ? { ...x, [key]: val } : x)) }

  async function handleSave() {
    setSaving(true); setError(null)
    try {
      await onSave(row, computed.map(l => ({
        taux_tva: l._taux, montant_ht: l._ht, montant_tva: l._tva,
      })))
      onClose()
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  return (
    <Modal title="Ventiler la TVA" onClose={onClose} size="medium">
      <div className={styles.panel}>
        <div className={styles.ref}>
          TTC de référence : <strong>{formatEur(ttcRef)}</strong>
        </div>

        <div className={styles.lines}>
          {computed.map((line, i) => (
            <div key={i} className={styles.line}>
              <div className={styles.field}>
                <label className={styles.label}>Montant HT</label>
                <input
                  type="number" step="0.01" min="0"
                  className={styles.input}
                  value={line.montant_ht}
                  onChange={e => update(i, 'montant_ht', e.target.value)}
                  placeholder="0.00"
                  autoFocus={i === 0}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Taux TVA</label>
                <select
                  className={styles.select}
                  value={line.taux_tva}
                  onChange={e => update(i, 'taux_tva', e.target.value)}
                >
                  {TVA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className={styles.computed}>
                <span>TVA : {formatEur(line._tva)}</span>
                <span>TTC : <strong>{formatEur(line._ttc)}</strong></span>
              </div>
              {lines.length > 1 && (
                <button className={styles.remove} onClick={() => removeLine(i)} type="button" title="Supprimer">×</button>
              )}
            </div>
          ))}
        </div>

        <button className={styles.addLine} onClick={addLine} type="button">
          + Ajouter une ligne TVA
        </button>

        <div className={`${styles.total} ${Math.abs(diff) >= 0.02 ? styles.totalErr : styles.totalOk}`}>
          <span>Total lignes TTC : <strong>{formatEur(totalTtc)}</strong></span>
          {Math.abs(diff) >= 0.02 && (
            <span className={styles.diff}>
              Écart {diff > 0 ? '+' : ''}{formatEur(diff)} — ajustez les montants HT
            </span>
          )}
          {Math.abs(diff) < 0.02 && totalTtc > 0 && (
            <span className={styles.ok}>✓ Correspond au TTC</span>
          )}
        </div>

        {error && <div className={styles.err}>{error}</div>}

        <div className={styles.actions}>
          <button className={styles.btnCancel} onClick={onClose} type="button">Annuler</button>
          <button className={styles.btnSave} onClick={handleSave} disabled={!valid || saving} type="button">
            {saving ? 'Enregistrement…' : 'Enregistrer la ventilation'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
