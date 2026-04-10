import { useEffect, useState } from 'react'
import { useDepenses } from '../hooks/useDepenses.js'
import DataTable from '../components/DataTable/DataTable.jsx'
import Modal from '../components/Modal/Modal.jsx'
import EntryForm from '../components/EntryForm/EntryForm.jsx'
import { formatEur, formatDate } from '../lib/api.js'
import styles from './Depenses.module.css'

function StatutBadge({ statut }) {
  const map = {
    payee: { label: 'Payée', className: styles.badgeGreen },
    en_attente: { label: 'En attente', className: styles.badgeOrange },
  }
  const { label, className } = map[statut] || { label: statut, className: styles.badgeGray }
  return <span className={`${styles.badge} ${className}`}>{label}</span>
}

const COLUMNS = [
  { key: 'date', label: 'Date', render: v => formatDate(v) },
  { key: 'fournisseur', label: 'Fournisseur' },
  { key: 'description', label: 'Description' },
  { key: 'montant_ht', label: 'Montant HT', render: v => formatEur(v) },
  { key: 'montant_tva', label: 'TVA', render: v => formatEur(v) },
  { key: 'montant_ttc', label: 'TTC', render: v => <strong>{formatEur(v)}</strong> },
  { key: 'categorie', label: 'Catégorie' },
  { key: 'statut', label: 'Statut', render: v => <StatutBadge statut={v} />, sortable: false },
]

export default function Depenses() {
  const { depenses, loading, error, fetchDepenses, createDepense, updateDepense, deleteDepense } = useDepenses()
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [actionError, setActionError] = useState(null)

  useEffect(() => {
    fetchDepenses()
  }, [fetchDepenses])

  function openCreate() {
    setEditTarget(null)
    setModalOpen(true)
    setActionError(null)
  }

  function openEdit(row) {
    setEditTarget(row)
    setModalOpen(true)
    setActionError(null)
  }

  function closeModal() {
    setModalOpen(false)
    setEditTarget(null)
  }

  async function handleSubmit(data) {
    if (editTarget) {
      await updateDepense(editTarget.id, data)
    } else {
      await createDepense(data)
    }
    closeModal()
  }

  async function handleDeleteConfirm() {
    try {
      await deleteDepense(confirmDelete.id)
      setConfirmDelete(null)
    } catch (e) {
      setActionError(e.message)
      setConfirmDelete(null)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Dépenses</h1>
          <p className={styles.pageSubtitle}>{depenses.length} dépense{depenses.length !== 1 ? 's' : ''} au total</p>
        </div>
        <button className={styles.btnPrimary} onClick={openCreate}>
          + Nouvelle dépense
        </button>
      </div>

      {actionError && (
        <div className={styles.error}>⚠️ {actionError}</div>
      )}

      {loading ? (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Chargement des dépenses…</p>
        </div>
      ) : error ? (
        <div className={styles.error}>⚠️ {error}</div>
      ) : (
        <DataTable
          columns={COLUMNS}
          data={depenses}
          onEdit={openEdit}
          onDelete={row => setConfirmDelete(row)}
          emptyMessage="Aucune dépense enregistrée."
        />
      )}

      {modalOpen && (
        <Modal
          title={editTarget ? 'Modifier la dépense' : 'Nouvelle dépense'}
          onClose={closeModal}
          size="medium"
        >
          <EntryForm
            type="depense"
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
            <p>
              Êtes-vous sûr de vouloir supprimer cette dépense chez{' '}
              <strong>{confirmDelete.fournisseur}</strong> ({formatEur(confirmDelete.montant_ttc)}) ?
            </p>
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
    </div>
  )
}
