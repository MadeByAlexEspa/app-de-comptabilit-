import { useState } from 'react'
import styles from './DataTable.module.css'

export default function DataTable({
  columns,
  data,
  onEdit,
  onDelete,
  emptyMessage = 'Aucune donnée',
  // selection
  selectable = false,
  selectedIds = new Set(),
  onSelectionChange,
}) {
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sorted = sortKey
    ? [...data].sort((a, b) => {
        const av = a[sortKey]
        const bv = b[sortKey]
        if (av == null) return 1
        if (bv == null) return -1
        const cmp = typeof av === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv), 'fr')
        return sortDir === 'asc' ? cmp : -cmp
      })
    : data

  // ── Selection helpers ──────────────────────────────────────────────────────

  function rowKey(row, i) {
    // use a composite key so factures and depenses with the same id don't clash
    return row._type ? `${row._type}-${row.id}` : (row.id ?? i)
  }

  const pageKeys  = sorted.map((row, i) => rowKey(row, i))
  const allOnPage = pageKeys.length > 0 && pageKeys.every(k => selectedIds.has(k))
  const someOnPage = !allOnPage && pageKeys.some(k => selectedIds.has(k))

  function toggleAll() {
    if (!onSelectionChange) return
    const next = new Set(selectedIds)
    if (allOnPage) {
      pageKeys.forEach(k => next.delete(k))
    } else {
      pageKeys.forEach(k => next.add(k))
    }
    onSelectionChange(next)
  }

  function toggleRow(key) {
    if (!onSelectionChange) return
    const next = new Set(selectedIds)
    next.has(key) ? next.delete(key) : next.add(key)
    onSelectionChange(next)
  }

  // ── Empty state ────────────────────────────────────────────────────────────

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
              <tr
                key={key}
                className={`${styles.tr} ${isSelected ? styles.trSelected : ''}`}
              >
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
                  <td key={col.key} className={styles.td}>
                    {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                  </td>
                ))}
                {(onEdit || onDelete) && (
                  <td className={`${styles.td} ${styles.tdActions}`}>
                    <div className={styles.actions}>
                      {onEdit && (
                        <button
                          className={`${styles.btn} ${styles.btnEdit}`}
                          onClick={() => onEdit(row)}
                          title="Modifier"
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
