import { useState } from 'react'
import styles from './DataTable.module.css'

export default function DataTable({ columns, data, onEdit, onDelete, emptyMessage = 'Aucune donnée' }) {
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
          {sorted.map((row, i) => (
            <tr key={row.id ?? i} className={styles.tr}>
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
          ))}
        </tbody>
      </table>
    </div>
  )
}
