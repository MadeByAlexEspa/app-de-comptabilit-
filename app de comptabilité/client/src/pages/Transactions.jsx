import { useEffect, useState } from 'react'
import { useFactures } from '../hooks/useFactures.js'
import { useDepenses } from '../hooks/useDepenses.js'
import DataTable from '../components/DataTable/DataTable.jsx'
import Modal from '../components/Modal/Modal.jsx'
import EntryForm from '../components/EntryForm/EntryForm.jsx'
import { formatEur, formatDate } from '../lib/api.js'
import styles from './Transactions.module.css'

function StatutBadge({ statut }) {
  const map = {
    payee: { label: 'Payée', className: styles.badgeGreen },
    en_attente: { label: 'En attente', className: styles.badgeOrange },
  }
  const { label, className } = map[statut] || { label: statut, className: styles.badgeGray }
  return <span className={`${styles.badge} ${className}`}>{label}</span>
}

const COLUMNS_FACTURES = [
  { key: 'numero', label: 'Numéro' },
  { key: 'date', label: 'Date', render: v => formatDate(v) },
  { key: 'client', label: 'Client' },
  { key: 'montant_ht', label: 'Montant HT', render: v => formatEur(v) },
  { key: 'montant_tva', label: 'TVA', render: v => formatEur(v) },
  { key: 'montant_ttc', label: 'TTC', render: v => <strong>{formatEur(v)}</strong> },
  { key: 'categorie', label: 'Catégorie' },
  { key: 'statut', label: 'Statut', render: v => <StatutBadge statut={v} />, sortable: false },
]

const COLUMNS_DEPENSES = [
  { key: 'date', label: 'Date', render: v => formatDate(v) },
  { key: 'fournisseur', label: 'Fournisseur' },
  { key: 'description', label: 'Description' },
  { key: 'montant_ht', label: 'Montant HT', render: v => formatEur(v) },
  { key: 'montant_tva', label: 'TVA', render: v => formatEur(v) },
  { key: 'montant_ttc', label: 'TTC', render: v => <strong>{formatEur(v)}</strong> },
  { key: 'categorie', label: 'Catégorie' },
  { key: 'statut', label: 'Statut', render: v => <StatutBadge statut={v} />, sortable: false },
]

export default function Transactions() {
  const [activeTab, setActiveTab] = useState('factures')
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
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

  const isFactures = activeTab === 'factures'
  const loading = isFactures ? loadingF : loadingD
  const error = isFactures ? errorF : errorD
  const data = isFactures ? factures : depenses
  const columns = isFactures ? COLUMNS_FACTURES : COLUMNS_DEPENSES

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

  async function handleSubmit(formData) {
    if (isFactures) {
      editTarget ? await updateFacture(editTarget.id, formData) : await createFacture(formData)
    } else {
      editTarget ? await updateDepense(editTarget.id, formData) : await createDepense(formData)
    }
    closeModal()
  }

  async function handleDeleteConfirm() {
    try {
      if (isFactures) {
        await deleteFacture(confirmDelete.id)
      } else {
        await deleteDepense(confirmDelete.id)
      }
      setConfirmDelete(null)
    } catch (e) {
      setActionError(e.message)
      setConfirmDelete(null)
    }
  }

  const deleteLabel = isFactures
    ? `la facture ${confirmDelete?.numero} pour ${confirmDelete?.client}`
    : `cette dépense chez ${confirmDelete?.fournisseur} (${formatEur(confirmDelete?.montant_ttc)})`

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Transactions</h1>
          <p className={styles.pageSubtitle}>
            {factures.length} facture{factures.length !== 1 ? 's' : ''} · {depenses.length} dépense{depenses.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button className={styles.btnPrimary} onClick={openCreate}>
          {isFactures ? '+ Nouvelle facture' : '+ Nouvelle dépense'}
        </button>
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${isFactures ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('factures')}
        >
          Factures
          <span className={styles.tabCount}>{factures.length}</span>
        </button>
        <button
          className={`${styles.tab} ${!isFactures ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('depenses')}
        >
          Dépenses
          <span className={styles.tabCount}>{depenses.length}</span>
        </button>
      </div>

      {actionError && <div className={styles.error}>⚠️ {actionError}</div>}

      {loading ? (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Chargement…</p>
        </div>
      ) : error ? (
        <div className={styles.error}>⚠️ {error}</div>
      ) : (
        <DataTable
          columns={columns}
          data={data}
          onEdit={openEdit}
          onDelete={row => setConfirmDelete(row)}
          emptyMessage={isFactures ? 'Aucune facture. Créez votre première facture !' : 'Aucune dépense enregistrée.'}
        />
      )}

      {modalOpen && (
        <Modal
          title={editTarget
            ? (isFactures ? 'Modifier la facture' : 'Modifier la dépense')
            : (isFactures ? 'Nouvelle facture' : 'Nouvelle dépense')}
          onClose={closeModal}
          size="medium"
        >
          <EntryForm
            type={isFactures ? 'facture' : 'depense'}
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
    </div>
  )
}
