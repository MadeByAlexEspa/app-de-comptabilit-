import { useEffect, useState, useMemo } from 'react'
import { useFactures } from '../hooks/useFactures.js'
import { useDepenses } from '../hooks/useDepenses.js'
import DataTable from '../components/DataTable/DataTable.jsx'
import Modal from '../components/Modal/Modal.jsx'
import EntryForm from '../components/EntryForm/EntryForm.jsx'
import { formatEur, formatDate } from '../lib/api.js'
import styles from './Transactions.module.css'

const PAGE_SIZE = 20

function StatutBadge({ statut }) {
  const map = {
    payee: { label: 'Payée', className: styles.badgeGreen },
    en_attente: { label: 'En attente', className: styles.badgeOrange },
  }
  const { label, className } = map[statut] || { label: statut, className: styles.badgeGray }
  return <span className={`${styles.badge} ${className}`}>{label}</span>
}

function TypeBadge({ type }) {
  return (
    <span className={`${styles.badge} ${type === 'entree' ? styles.badgeGreen : styles.badgeRed}`}>
      {type === 'entree' ? '↑ Entrée' : '↓ Sortie'}
    </span>
  )
}

const COLUMNS_TOUS = [
  { key: '_type',       label: 'Type',        render: (_, row) => <TypeBadge type={row._type} />, sortable: false },
  { key: 'date',        label: 'Date',        render: v => formatDate(v) },
  { key: '_tiers',      label: 'Tiers',       render: (_, row) => row.client || row.fournisseur || '—' },
  { key: 'description', label: 'Description' },
  { key: 'montant_ht',  label: 'Montant HT',  render: v => formatEur(v) },
  { key: 'montant_tva', label: 'TVA',         render: v => formatEur(v) },
  { key: 'montant_ttc', label: 'TTC',         render: v => <strong>{formatEur(v)}</strong> },
  { key: 'categorie',   label: 'Catégorie' },
  { key: 'statut',      label: 'Statut',      render: v => <StatutBadge statut={v} />, sortable: false },
]

const COLUMNS_ENTREES = [
  { key: 'numero',      label: 'Numéro' },
  { key: 'date',        label: 'Date',        render: v => formatDate(v) },
  { key: 'client',      label: 'Client' },
  { key: 'montant_ht',  label: 'Montant HT',  render: v => formatEur(v) },
  { key: 'montant_tva', label: 'TVA',         render: v => formatEur(v) },
  { key: 'montant_ttc', label: 'TTC',         render: v => <strong>{formatEur(v)}</strong> },
  { key: 'categorie',   label: 'Catégorie' },
  { key: 'statut',      label: 'Statut',      render: v => <StatutBadge statut={v} />, sortable: false },
]

const COLUMNS_SORTIES = [
  { key: 'date',        label: 'Date',        render: v => formatDate(v) },
  { key: 'fournisseur', label: 'Fournisseur' },
  { key: 'description', label: 'Description' },
  { key: 'montant_ht',  label: 'Montant HT',  render: v => formatEur(v) },
  { key: 'montant_tva', label: 'TVA',         render: v => formatEur(v) },
  { key: 'montant_ttc', label: 'TTC',         render: v => <strong>{formatEur(v)}</strong> },
  { key: 'categorie',   label: 'Catégorie' },
  { key: 'statut',      label: 'Statut',      render: v => <StatutBadge statut={v} />, sortable: false },
]

function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null
  return (
    <div className={styles.pagination}>
      <button
        className={styles.pageBtn}
        onClick={() => onChange(1)}
        disabled={page === 1}
        title="Première page"
      >
        «
      </button>
      <button
        className={styles.pageBtn}
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        title="Page précédente"
      >
        ‹
      </button>

      {Array.from({ length: totalPages }, (_, i) => i + 1)
        .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
        .reduce((acc, p, idx, arr) => {
          if (idx > 0 && p - arr[idx - 1] > 1) {
            acc.push('…')
          }
          acc.push(p)
          return acc
        }, [])
        .map((p, i) =>
          p === '…' ? (
            <span key={`ellipsis-${i}`} className={styles.pageEllipsis}>…</span>
          ) : (
            <button
              key={p}
              className={`${styles.pageBtn} ${p === page ? styles.pageBtnActive : ''}`}
              onClick={() => onChange(p)}
            >
              {p}
            </button>
          )
        )}

      <button
        className={styles.pageBtn}
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
        title="Page suivante"
      >
        ›
      </button>
      <button
        className={styles.pageBtn}
        onClick={() => onChange(totalPages)}
        disabled={page === totalPages}
        title="Dernière page"
      >
        »
      </button>
    </div>
  )
}

export default function Transactions() {
  const [activeTab, setActiveTab]     = useState('tous')
  const [page, setPage]               = useState(1)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [modalOpen, setModalOpen]     = useState(false)
  const [editTarget, setEditTarget]   = useState(null)
  const [confirmDelete, setConfirmDelete]     = useState(null)
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [bulkDeleting, setBulkDeleting]       = useState(false)
  const [actionError, setActionError] = useState(null)

  const {
    factures, loading: loadingF, error: errorF,
    fetchFactures, createFacture, updateFacture, deleteFacture,
  } = useFactures()

  const {
    depenses, loading: loadingD, error: errorD,
    fetchDepenses, createDepense, updateDepense, deleteDepense,
  } = useDepenses()

  useEffect(() => { fetchFactures() }, [fetchFactures])
  useEffect(() => { fetchDepenses() }, [fetchDepenses])

  // Reset page + selection when tab changes
  function switchTab(tab) {
    setActiveTab(tab)
    setPage(1)
    setSelectedIds(new Set())
  }

  const allRows = useMemo(() => {
    const entries = factures.map(f => ({ ...f, _type: 'entree' }))
    const exits   = depenses.map(d => ({ ...d, _type: 'sortie' }))
    return [...entries, ...exits].sort((a, b) => {
      if (!a.date && !b.date) return 0
      if (!a.date) return 1
      if (!b.date) return -1
      return b.date.localeCompare(a.date)
    })
  }, [factures, depenses])

  const isEntrees = activeTab === 'entrees'
  const isSorties = activeTab === 'sorties'
  const isTous    = activeTab === 'tous'

  const loading = (loadingF || loadingD)
  const error   = isTous ? (errorF || errorD) : isEntrees ? errorF : errorD

  const fullData = isTous ? allRows : isEntrees ? factures : depenses
  const columns  = isTous ? COLUMNS_TOUS : isEntrees ? COLUMNS_ENTREES : COLUMNS_SORTIES

  const totalPages = Math.max(1, Math.ceil(fullData.length / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const pageData   = fullData.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  function openCreate() {
    setEditTarget(null)
    setModalOpen(true)
    setActionError(null)
  }

  function openEdit(row) {
    // In "Tous" view, route to the right type
    if (isTous) {
      setActiveTab(row._type === 'entree' ? 'entrees' : 'sorties')
    }
    setEditTarget(row)
    setModalOpen(true)
    setActionError(null)
  }

  function closeModal() {
    setModalOpen(false)
    setEditTarget(null)
  }

  const editIsEntree = isTous
    ? editTarget?._type === 'entree'
    : isEntrees

  async function handleSubmit(formData) {
    if (editIsEntree) {
      editTarget ? await updateFacture(editTarget.id, formData) : await createFacture(formData)
    } else {
      editTarget ? await updateDepense(editTarget.id, formData) : await createDepense(formData)
    }
    closeModal()
  }

  async function handleDeleteConfirm() {
    try {
      if (confirmDelete._type === 'entree' || isEntrees) {
        await deleteFacture(confirmDelete.id)
      } else {
        await deleteDepense(confirmDelete.id)
      }
      // Re-fetch to guarantee frontend/backend sync
      await Promise.all([fetchFactures(), fetchDepenses()])
      setConfirmDelete(null)
    } catch (e) {
      setActionError(e.message)
      setConfirmDelete(null)
    }
  }

  // ── Bulk delete ────────────────────────────────────────────────────────────

  // selectedIds are composite keys like "entree-12" or "sortie-5" (or plain number for single-type tabs)
  function parseKey(key) {
    const s = String(key)
    if (s.startsWith('entree-')) return { type: 'entree', id: Number(s.slice(7)) }
    if (s.startsWith('sortie-')) return { type: 'sortie', id: Number(s.slice(7)) }
    // single-type tab: no prefix — use current tab to determine type
    return { type: isEntrees ? 'entree' : 'sortie', id: Number(s) }
  }

  async function handleBulkDelete() {
    setBulkDeleting(true)
    setActionError(null)
    const errors = []
    for (const key of selectedIds) {
      const { type, id } = parseKey(key)
      try {
        if (type === 'entree') await deleteFacture(id)
        else                   await deleteDepense(id)
      } catch (e) {
        errors.push(e.message)
      }
    }
    // Re-fetch both lists to guarantee frontend/backend sync
    await Promise.all([fetchFactures(), fetchDepenses()])
    setSelectedIds(new Set())
    setConfirmBulkDelete(false)
    setBulkDeleting(false)
    if (errors.length) setActionError(`${errors.length} suppression(s) ont échoué.`)
  }

  const deleteLabel = (confirmDelete?._type === 'entree' || isEntrees)
    ? `l'entrée ${confirmDelete?.numero} — ${confirmDelete?.client}`
    : `la sortie chez ${confirmDelete?.fournisseur} (${formatEur(confirmDelete?.montant_ttc)})`

  const createLabel = isEntrees ? '+ Nouvelle entrée' : isSorties ? '+ Nouvelle sortie' : null

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Transactions</h1>
          <p className={styles.pageSubtitle}>
            {factures.length} entrée{factures.length !== 1 ? 's' : ''} · {depenses.length} sortie{depenses.length !== 1 ? 's' : ''}
          </p>
        </div>
        {!isTous && (
          <button className={styles.btnPrimary} onClick={openCreate}>
            {createLabel}
          </button>
        )}
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${isTous ? styles.tabActive : ''}`}
          onClick={() => switchTab('tous')}
        >
          Tous
          <span className={styles.tabCount}>{factures.length + depenses.length}</span>
        </button>
        <button
          className={`${styles.tab} ${isEntrees ? styles.tabActive : ''}`}
          onClick={() => switchTab('entrees')}
        >
          Entrées
          <span className={styles.tabCount}>{factures.length}</span>
        </button>
        <button
          className={`${styles.tab} ${isSorties ? styles.tabActive : ''}`}
          onClick={() => switchTab('sorties')}
        >
          Sorties
          <span className={styles.tabCount}>{depenses.length}</span>
        </button>
      </div>

      {actionError && <div className={styles.error}>⚠️ {actionError}</div>}

      {selectedIds.size > 0 && (
        <div className={styles.bulkBar}>
          <span className={styles.bulkCount}>
            {selectedIds.size} ligne{selectedIds.size > 1 ? 's' : ''} sélectionnée{selectedIds.size > 1 ? 's' : ''}
          </span>
          <div className={styles.bulkActions}>
            <button
              className={styles.btnBulkClear}
              onClick={() => setSelectedIds(new Set())}
            >
              Désélectionner
            </button>
            <button
              className={styles.btnBulkDelete}
              onClick={() => setConfirmBulkDelete(true)}
            >
              🗑️ Supprimer la sélection
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Chargement…</p>
        </div>
      ) : error ? (
        <div className={styles.error}>⚠️ {error}</div>
      ) : (
        <>
          <div className={styles.tableInfo}>
            <span className={styles.tableCount}>
              {fullData.length === 0
                ? 'Aucune transaction'
                : `${fullData.length} transaction${fullData.length > 1 ? 's' : ''} — page ${safePage} / ${totalPages}`}
            </span>
          </div>

          <DataTable
            columns={columns}
            data={pageData}
            onEdit={openEdit}
            onDelete={row => setConfirmDelete(row)}
            emptyMessage={
              isTous    ? 'Aucune transaction. Ajoutez une entrée ou une sortie !' :
              isEntrees ? 'Aucune entrée. Créez votre première entrée !' :
                          'Aucune sortie enregistrée.'
            }
            selectable
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
          />

          <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
        </>
      )}

      {modalOpen && (
        <Modal
          title={editTarget
            ? (editIsEntree ? 'Modifier l\'entrée' : 'Modifier la sortie')
            : (editIsEntree ? 'Nouvelle entrée'   : 'Nouvelle sortie')}
          onClose={closeModal}
          size="medium"
        >
          <EntryForm
            type={editIsEntree ? 'facture' : 'depense'}
            initialData={editTarget}
            onSubmit={handleSubmit}
            onCancel={closeModal}
          />
        </Modal>
      )}

      {confirmDelete && (
        <Modal
          title="Confirmer la suppression"
          onClose={() => setConfirmDelete(null)}
          size="small"
        >
          <div className={styles.confirmBody}>
            <p>Êtes-vous sûr de vouloir supprimer <strong>{deleteLabel}</strong> ?</p>
            <p className={styles.confirmWarn}>Cette action est irréversible.</p>
            <div className={styles.confirmActions}>
              <button className={styles.btnCancel} onClick={() => setConfirmDelete(null)}>
                Annuler
              </button>
              <button className={styles.btnDanger} onClick={handleDeleteConfirm}>
                Supprimer
              </button>
            </div>
          </div>
        </Modal>
      )}

      {confirmBulkDelete && (
        <Modal
          title="Confirmer la suppression en masse"
          onClose={() => setConfirmBulkDelete(false)}
          size="small"
        >
          <div className={styles.confirmBody}>
            <p>
              Êtes-vous sûr de vouloir supprimer{' '}
              <strong>{selectedIds.size} transaction{selectedIds.size > 1 ? 's' : ''}</strong> ?
            </p>
            <p className={styles.confirmWarn}>Cette action est irréversible.</p>
            <div className={styles.confirmActions}>
              <button
                className={styles.btnCancel}
                onClick={() => setConfirmBulkDelete(false)}
                disabled={bulkDeleting}
              >
                Annuler
              </button>
              <button
                className={styles.btnDanger}
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
              >
                {bulkDeleting ? 'Suppression…' : `Supprimer ${selectedIds.size} ligne${selectedIds.size > 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
