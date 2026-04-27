import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import styles from './DataTable.module.css'

// ── InlineCombobox ────────────────────────────────────────────────────────────

function InlineCombobox({ col, row, initialValue, onCommit, onCancel }) {
  const [query, setQuery] = useState('')
  const [highlighted, setHighlighted] = useState(0)
  const [dropPos, setDropPos] = useState(null)
  const triggerRef = useRef(null)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  const rawOpts = typeof col.editable.options === 'function'
    ? col.editable.options(row)
    : (col.editable.options ?? [])
  const isGrouped = rawOpts.length > 0 && rawOpts[0]?.group !== undefined
  const flatAll = isGrouped ? rawOpts.flatMap(g => g.options) : rawOpts

  const q = query.trim().toLowerCase()
  const filtered = q ? flatAll.filter(o => o.label.toLowerCase().includes(q)) : null

  // Build display groups with stable flat indices
  let _idx = 0
  const displayGroups = filtered
    ? [{ group: null, options: filtered.map(o => ({ ...o, _idx: _idx++ })) }]
    : (isGrouped
        ? rawOpts.map(g => ({ group: g.group, options: g.options.map(o => ({ ...o, _idx: _idx++ })) }))
        : [{ group: null, options: rawOpts.map(o => ({ ...o, _idx: _idx++ })) }])
  const totalOptions = _idx

  // Position + initial highlight
  useEffect(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const dropW = Math.max(rect.width, 300)
      const dropH = Math.min(320, flatAll.length * 36 + 60)
      const spaceBelow = window.innerHeight - rect.bottom
      const above = spaceBelow < dropH && rect.top > dropH
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - dropW - 8))
      setDropPos({
        left, width: dropW,
        ...(above
          ? { bottom: window.innerHeight - rect.top + 2, top: 'auto' }
          : { top: rect.bottom + 2, bottom: 'auto' }),
      })
    }
    const curIdx = flatAll.findIndex(o => o.value === initialValue)
    setHighlighted(curIdx >= 0 ? curIdx : 0)
    inputRef.current?.focus({ preventScroll: true })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Close on scroll
  useEffect(() => {
    const fn = () => onCancel()
    document.addEventListener('scroll', fn, { passive: true, capture: true })
    return () => document.removeEventListener('scroll', fn, { capture: true })
  }, [onCancel])

  // Click outside
  useEffect(() => {
    const fn = (e) => {
      if (!triggerRef.current?.contains(e.target) && !listRef.current?.contains(e.target))
        onCancel()
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [onCancel])

  // Scroll highlighted into view
  useEffect(() => {
    if (!listRef.current) return
    listRef.current.querySelector(`[data-idx="${highlighted}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [highlighted])

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, totalOptions - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      const item = displayGroups.flatMap(g => g.options).find(o => o._idx === highlighted)
      if (item) onCommit(item.value)
    }
    else if (e.key === 'Escape') { e.preventDefault(); onCancel() }
  }

  return (
    <>
      <div ref={triggerRef} className={styles.comboboxTrigger}>
        <input
          ref={inputRef}
          className={styles.comboboxSearch}
          value={query}
          onChange={e => { setQuery(e.target.value); setHighlighted(0) }}
          onKeyDown={handleKeyDown}
          placeholder={initialValue || 'Rechercher…'}
          aria-label="Rechercher"
          aria-autocomplete="list"
        />
      </div>

      {dropPos && createPortal(
        <div
          ref={listRef}
          className={styles.comboboxDropdown}
          style={{ position: 'fixed', top: dropPos.top, bottom: dropPos.bottom, left: dropPos.left, width: dropPos.width, zIndex: 9999 }}
          onMouseDown={e => e.preventDefault()}
        >
          {totalOptions === 0 ? (
            <div className={styles.comboboxEmpty}>Aucun résultat pour « {query} »</div>
          ) : displayGroups.map((group, gi) => (
            <div key={gi}>
              {group.group && <div className={styles.comboboxGroupLabel}>{group.group}</div>}
              {group.options.map(opt => (
                <div
                  key={opt.value}
                  data-idx={opt._idx}
                  className={[
                    styles.comboboxOption,
                    opt._idx === highlighted ? styles.comboboxOptionHover : '',
                    opt.value === initialValue ? styles.comboboxOptionCurrent : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => onCommit(opt.value)}
                  onMouseEnter={() => setHighlighted(opt._idx)}
                >
                  <span className={styles.comboboxOptionCheck}>{opt.value === initialValue ? '✓' : ''}</span>
                  {opt.label}
                </div>
              ))}
            </div>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}

// ── InlinePills ───────────────────────────────────────────────────────────────

function InlinePills({ col, initialValue, onCommit, onCancel }) {
  const opts = col.editable.options ?? []

  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [onCancel])

  return (
    <div className={styles.pillsWrapper}>
      {opts.map(opt => (
        <button
          key={opt.value}
          type="button"
          className={`${styles.pill} ${String(initialValue) === String(opt.value) ? styles.pillActive : ''}`}
          onMouseDown={e => e.preventDefault()}
          onClick={() => onCommit(parseFloat(opt.value))}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ── InlineCell ────────────────────────────────────────────────────────────────

function InlineCell({ col, row, onSave }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [saveStatus, setSaveStatus] = useState(null) // null | 'saving' | 'saved' | 'error'
  const inputRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => () => clearTimeout(timerRef.current), [])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus({ preventScroll: true })
      if (col.editable.type !== 'select') inputRef.current.select?.()
    }
  }, [editing, col.editable.type])

  function startEdit(e) {
    e.stopPropagation()
    setValue(String(row[col.key] ?? ''))
    setEditing(true)
  }

  async function commit(overrideValue) {
    setEditing(false)
    const rawVal = overrideValue !== undefined ? overrideValue : value
    const orig = row[col.key]
    const finalVal = (col.editable.type === 'number' && typeof rawVal !== 'number')
      ? parseFloat(rawVal)
      : rawVal

    if (String(finalVal) !== String(orig ?? '')) {
      setSaveStatus('saving')
      clearTimeout(timerRef.current)
      try {
        await onSave(row, col.key, finalVal)
        setSaveStatus('saved')
        timerRef.current = setTimeout(() => setSaveStatus(null), 1500)
      } catch {
        setSaveStatus('error')
        timerRef.current = setTimeout(() => setSaveStatus(null), 2500)
      }
    }
  }

  function cancel() { setEditing(false) }

  function handleKeyDown(e) {
    if (e.key === 'Enter')  { e.preventDefault(); commit() }
    if (e.key === 'Escape') { e.stopPropagation(); cancel() }
  }

  const opts = typeof col.editable.options === 'function'
    ? col.editable.options(row)
    : (col.editable.options ?? [])
  const isGrouped = opts.length > 0 && opts[0]?.group !== undefined
  const type = col.editable.type

  const statusClass = saveStatus === 'saving' ? styles.editableCellSaving
    : saveStatus === 'saved'  ? styles.editableCellSaved
    : saveStatus === 'error'  ? styles.editableCellError
    : ''

  if (editing) {
    if (type === 'combobox') {
      return (
        <InlineCombobox
          col={col} row={row}
          initialValue={value}
          onCommit={v => commit(v)}
          onCancel={cancel}
        />
      )
    }
    if (type === 'pills') {
      return (
        <InlinePills
          col={col}
          initialValue={value}
          onCommit={v => commit(v)}
          onCancel={cancel}
        />
      )
    }
    if (type === 'select') {
      return (
        <select
          ref={inputRef}
          className={styles.inlineSelect}
          value={value}
          onChange={e => setValue(e.target.value)}
          onBlur={() => commit()}
          onKeyDown={handleKeyDown}
        >
          {isGrouped
            ? opts.map(g => (
                <optgroup key={g.group} label={g.group}>
                  {g.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </optgroup>
              ))
            : opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)
          }
        </select>
      )
    }
    return (
      <input
        ref={inputRef}
        type={type}
        className={styles.inlineInput}
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={() => commit()}
        onKeyDown={handleKeyDown}
        step={col.editable.step}
        min={col.editable.min}
      />
    )
  }

  return (
    <span
      className={`${styles.editableCell} ${statusClass}`}
      onClick={startEdit}
      title="Cliquer pour modifier"
    >
      <span className={styles.editableCellText}>
        {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
      </span>
      {saveStatus === 'saving' && <span className={styles.saveIndicator}>···</span>}
      {saveStatus === 'saved'  && <span className={`${styles.saveIndicator} ${styles.saveOk}`}>✓</span>}
      {saveStatus === 'error'  && <span className={`${styles.saveIndicator} ${styles.saveErr}`}>✕</span>}
    </span>
  )
}

// ── DataTable ─────────────────────────────────────────────────────────────────

export default function DataTable({
  columns,
  data,
  onEdit,
  onDelete,
  onCellSave,
  emptyMessage = 'Aucune donnée',
  selectable = false,
  selectedIds = new Set(),
  onSelectionChange,
}) {
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const sorted = sortKey
    ? [...data].sort((a, b) => {
        const av = a[sortKey], bv = b[sortKey]
        if (av == null) return 1
        if (bv == null) return -1
        const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv), 'fr')
        return sortDir === 'asc' ? cmp : -cmp
      })
    : data

  function rowKey(row, i) {
    return row._type ? `${row._type}-${row.id}` : (row.id ?? i)
  }

  const pageKeys   = sorted.map((row, i) => rowKey(row, i))
  const allOnPage  = pageKeys.length > 0 && pageKeys.every(k => selectedIds.has(k))
  const someOnPage = !allOnPage && pageKeys.some(k => selectedIds.has(k))

  function toggleAll() {
    if (!onSelectionChange) return
    const next = new Set(selectedIds)
    if (allOnPage) pageKeys.forEach(k => next.delete(k))
    else           pageKeys.forEach(k => next.add(k))
    onSelectionChange(next)
  }

  function toggleRow(key) {
    if (!onSelectionChange) return
    const next = new Set(selectedIds)
    next.has(key) ? next.delete(key) : next.add(key)
    onSelectionChange(next)
  }

  if (!data || data.length === 0) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon}>📭</span>
        <p>{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            {selectable && (
              <th className={`${styles.th} ${styles.thCheck}`}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={allOnPage}
                  ref={el => { if (el) el.indeterminate = someOnPage }}
                  onChange={toggleAll}
                  title={allOnPage ? 'Tout désélectionner' : 'Tout sélectionner'}
                />
              </th>
            )}
            {columns.map(col => (
              <th
                key={col.key}
                className={`${styles.th} ${col.sortable !== false ? styles.sortable : ''}`}
                onClick={col.sortable !== false ? () => handleSort(col.key) : undefined}
              >
                <span className={styles.thContent}>
                  {col.label}
                  {col.sortable !== false && (
                    <span className={styles.sortIcon}>
                      {sortKey === col.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
                    </span>
                  )}
                </span>
              </th>
            ))}
            {(onEdit || onDelete) && (
              <th className={`${styles.th} ${styles.thActions}`}>Actions</th>
            )}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => {
            const key = rowKey(row, i)
            const isSelected = selectedIds.has(key)
            return (
              <tr key={key} className={`${styles.tr} ${isSelected ? styles.trSelected : ''}`}>
                {selectable && (
                  <td className={`${styles.td} ${styles.tdCheck}`}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={isSelected}
                      onChange={() => toggleRow(key)}
                    />
                  </td>
                )}
                {columns.map(col => (
                  <td
                    key={col.key}
                    className={`${styles.td} ${col.editable && onCellSave ? styles.tdEditable : ''}`}
                  >
                    {col.editable && onCellSave
                      ? <InlineCell col={col} row={row} onSave={onCellSave} />
                      : col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')
                    }
                  </td>
                ))}
                {(onEdit || onDelete) && (
                  <td className={`${styles.td} ${styles.tdActions}`}>
                    <div className={styles.actions}>
                      {onEdit && (
                        <button
                          className={`${styles.btn} ${styles.btnEdit}`}
                          onClick={() => onEdit(row)}
                          title="Modifier (formulaire complet)"
                        >
                          ✏️
                        </button>
                      )}
                      {onDelete && (
                        <button
                          className={`${styles.btn} ${styles.btnDelete}`}
                          onClick={() => onDelete(row)}
                          title="Supprimer"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
