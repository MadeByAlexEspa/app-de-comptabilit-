import { useEffect, useState, useMemo } from 'react'
import { Trash2 } from 'lucide-react'
import { buildCategoriePatch } from '../lib/tvaRules.js'
import { useFactures } from '../hooks/useFactures.js'
import { useDepenses } from '../hooks/useDepenses.js'
import DataTable from '../components/DataTable/DataTable.jsx'
import Modal from '../components/Modal/Modal.jsx'
import EntryForm from '../components/EntryForm/EntryForm.jsx'
import Spinner from '../components/Spinner/Spinner.jsx'
import { formatEur, formatDate } from '../lib/api.js'
import styles from './Transactions.module.css'

const PAGE_SIZE = 20

// ── Options pour l'édition inline ─────────────────────────────────────────

const STATUT_OPTIONS = [
  { value: 'payee',      label: 'Payée' },
  { value: 'en_attente', label: 'En attente' },
]

const CAT_ENTREES_OPTIONS = [
  '706 \u2013 Prestations de services',
  '701 \u2013 Ventes de produits finis',
  '707 \u2013 Ventes de marchandises',
  '708 \u2013 Produits des activit\u00e9s annexes',
  '409 \u2013 Avoirs fournisseurs re\u00e7us',
  '74 \u2013 Subventions d\u2019exploitation',
  '75 \u2013 Autres produits de gestion courante',
  '76 \u2013 Produits financiers',
  '77 \u2013 Produits exceptionnels',
  '101 \u2013 Capital social (apport)',
  '108 \u2013 Apport de l\u2019exploitant',
  '164 \u2013 Emprunts bancaires re\u00e7us',
  '455 \u2013 Avances en compte courant associ\u00e9',
  '58 \u2013 Virement interne entre comptes',
].map(v => ({ value: v, label: v }))

const CAT_SORTIES_OPTIONS = [
  '604 \u2013 Achats de prestations de services',
  '606 \u2013 Fournitures et petits \u00e9quipements',
  '607 \u2013 Achats de marchandises',
  '611 \u2013 Sous-traitance g\u00e9n\u00e9rale',
  '613 \u2013 Locations & charges locatives',
  '615 \u2013 Entretien et r\u00e9parations',
  '616 \u2013 Primes d\u2019assurance',
  '618 \u2013 Abonnements & frais informatiques',
  '622 \u2013 Honoraires et r\u00e9mun\u00e9rations d\u2019interm\u00e9diaires',
  '623 \u2013 Publicit\u00e9 & communication',
  '624 \u2013 Transports de biens',
  '625 \u2013 D\u00e9placements, missions & r\u00e9ceptions',
  '626 \u2013 Frais postaux & t\u00e9l\u00e9communications',
  '627 \u2013 Services bancaires & assimil\u00e9s',
  '631 \u2013 Imp\u00f4ts, taxes et versements assimil\u00e9s sur r\u00e9mun\u00e9rations',
  '635 \u2013 Autres imp\u00f4ts, taxes et versements assimil\u00e9s',
  '641 \u2013 R\u00e9mun\u00e9rations du personnel',
  '645 \u2013 Charges sociales & cotisations',
  '421 \u2013 Notes de frais du personnel',
  '681 \u2013 Dotations aux amortissements d\u2019exploitation',
  '661 \u2013 Charges d\u2019int\u00e9r\u00eats',
  '668 \u2013 Autres charges financi\u00e8res',
  '709 \u2013 Avoirs & remboursements clients',
  '671 \u2013 Charges exceptionnelles sur op\u00e9rations de gestion',
  '675 \u2013 Valeurs comptables des \u00e9l\u00e9ments c\u00e9d\u00e9s',
  '695 \u2013 Imp\u00f4t sur les b\u00e9n\u00e9fices (IS)',
  '201 \u2013 Frais d\u2019\u00e9tablissement',
  '2052 \u2013 Logiciels (d\u00e9veloppement interne)',
  '2051 \u2013 Concessions, brevets, licences, marques',
  '211 \u2013 Terrains',
  '213 \u2013 Constructions',
  '215 \u2013 Mat\u00e9riel et outillage industriel',
  '218 \u2013 Autres immobilisations corporelles',
  '108 \u2013 Pr\u00e9l\u00e8vements de l\u2019exploitant',
  '164 \u2013 Remboursement d\u2019emprunt',
  '455 \u2013 Remboursement compte courant associ\u00e9',
  '58 \u2013 Virement interne entre comptes',
].map(v => ({ value: v, label: v }))

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
  { key: 'date',        label: 'Date',        render: v => formatDate(v),
    editable: { type: 'date' } },
  { key: '_tiers',      label: 'Tiers',       render: (_, row) => row.client || row.fournisseur || '—',
    sortable: false },
  { key: 'montant_ht',  label: 'Montant HT',  render: v => formatEur(v) },
  { key: 'montant_tva', label: 'TVA',         render: v => formatEur(v) },
  { key: 'montant_ttc', label: 'TTC',         render: v => <strong>{formatEur(v)}</strong>,
    editable: { type: 'number', step: '0.01', min: '0' } },
  { key: 'categorie',   label: 'Catégorie',
    editable: { type: 'select', options: row => row._type === 'entree' ? CAT_ENTREES_OPTIONS : CAT_SORTIES_OPTIONS } },
  { key: 'statut',      label: 'Statut',      render: v => <StatutBadge statut={v} />, sortable: false,
    editable: { type: 'select', options: STATUT_OPTIONS } },
]

const COLUMNS_ENTREES = [
  { key: 'date',        label: 'Date',        render: v => formatDate(v),
    editable: { type: 'date' } },
  { key: 'client',      label: 'Client',
    editable: { type: 'text' } },
  { key: 'montant_ht',  label: 'Montant HT',  render: v => formatEur(v) },
  { key: 'montant_tva', label: 'TVA',         render: v => formatEur(v) },
  { key: 'montant_ttc', label: 'TTC',         render: v => <strong>{formatEur(v)}</strong>,
    editable: { type: 'number', step: '0.01', min: '0' } },
  { key: 'categorie',   label: 'Catégorie',
    editable: { type: 'select', options: CAT_ENTREES_OPTIONS } },
  { key: 'statut',      label: 'Statut',      render: v => <StatutBadge statut={v} />, sortable: false,
    editable: { type: 'select', options: STATUT_OPTIONS } },
]

const COLUMNS_SORTIES = [
  { key: 'date',        label: 'Date',        render: v => formatDate(v),
    editable: { type: 'date' } },
  { key: 'fournisseur', label: 'Fournisseur',
    editable: { type: 'text' } },
  { key: 'montant_ht',  label: 'Montant HT',  render: v => formatEur(v) },
  { key: 'montant_tva', label: 'TVA',         render: v => formatEur(v) },
  { key: 'montant_ttc', label: 'TTC',         render: v => <strong>{formatEur(v)}</strong>,
    editable: { type: 'number', step: '0.01', min: '0' } },
  { key: 'categorie',   label: 'Catégorie',
    editable: { type: 'select', options: CAT_SORTIES_OPTIONS } },
  { key: 'statut',      label: 'Statut',      render: v => <StatutBadge statut={v} />, sortable: false,
    editable: { type: 'select', options: STATUT_OPTIONS } },
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
  const [confirmDelete, setConfirmDelete]         = useState(null)
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [bulkDeleting, setBulkDeleting]           = useState(false)
  const [actionError, setActionError]             = useState(null)
  const [pendingCatChange, setPendingCatChange]   = useState(null)
  // pendingCatChange: { row, newCategory, matchingRows, isEntree }

  // ── Filters ────────────────────────────────────────────────────────────────
  const [filterTiers,     setFilterTiers]     = useState('')
  const [filterDateFrom,  setFilterDateFrom]  = useState('')
  const [filterDateTo,    setFilterDateTo]    = useState('')
  const [filterCategorie, setFilterCategorie] = useState('')
  const [filterStatut,    setFilterStatut]    = useState('')

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

  // Reset page + selection + filters when tab changes
  function switchTab(tab) {
    setActiveTab(tab)
    setPage(1)
    setSelectedIds(new Set())
    setFilterTiers('')
    setFilterDateFrom('')
    setFilterDateTo('')
    setFilterCategorie('')
    setFilterStatut('')
  }

  function clearFilters() {
    setFilterTiers('')
    setFilterDateFrom('')
    setFilterDateTo('')
    setFilterCategorie('')
    setFilterStatut('')
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

  const hasFilters = !!(filterTiers || filterDateFrom || filterDateTo || filterCategorie || filterStatut)

  const categorieOptions = useMemo(() =>
    [...new Set(fullData.map(r => r.categorie).filter(Boolean))].sort()
  , [fullData])

  const filteredData = useMemo(() => {
    let rows = fullData
    if (filterTiers) {
      const q = filterTiers.toLowerCase()
      rows = rows.filter(r => (r.client || r.fournisseur || '').toLowerCase().includes(q))
    }
    if (filterDateFrom) rows = rows.filter(r => r.date >= filterDateFrom)
    if (filterDateTo)   rows = rows.filter(r => r.date <= filterDateTo)
    if (filterCategorie) rows = rows.filter(r => r.categorie === filterCategorie)
    if (filterStatut)    rows = rows.filter(r => r.statut === filterStatut)
    return rows
  }, [fullData, filterTiers, filterDateFrom, filterDateTo, filterCategorie, filterStatut])

  // Reset page when filters change
  useEffect(() => { setPage(1) }, [filterTiers, filterDateFrom, filterDateTo, filterCategorie, filterStatut])

  const totalPages = Math.max(1, Math.ceil(filteredData.length / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const pageData   = filteredData.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  // ── Propagation de catégorie par tiers ────────────────────────────────────

  function findMatchingRows(row, newCategory, isEntree) {
    const tiers = isEntree ? row.client : row.fournisseur
    if (!tiers) return []
    const pool = isEntree ? factures : depenses
    const tiersKey = isEntree ? 'client' : 'fournisseur'
    return pool.filter(r => r[tiersKey] === tiers && r.id !== row.id && r.categorie !== newCategory)
  }

  async function saveCategoryChange(row, patch, isEntree) {
    if (isEntree) await updateFacture(row.id, patch)
    else          await updateDepense(row.id, patch)
  }

  async function applyOnce() {
    const { row, patch, isEntree } = pendingCatChange
    setPendingCatChange(null)
    try {
      await saveCategoryChange(row, patch, isEntree)
    } catch (e) {
      setActionError(e.message)
    }
  }

  async function applyToAll() {
    const { row, patch, matchingRows, isEntree } = pendingCatChange
    setPendingCatChange(null)
    try {
      await saveCategoryChange(row, patch, isEntree)
      for (const r of matchingRows) {
        // Recalcule le patch TVA par rapport à la catégorie de chaque ligne
        const rowPatch = buildCategoriePatch(r.categorie, patch.categorie)
        await saveCategoryChange(r, rowPatch, isEntree)
      }
    } catch (e) {
      setActionError(e.message)
    }
  }

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
    const oldCategory = editTarget?.categorie
    const newCategory = formData.categorie
    if (editIsEntree) {
      editTarget ? await updateFacture(editTarget.id, formData) : await createFacture(formData)
    } else {
      editTarget ? await updateDepense(editTarget.id, formData) : await createDepense(formData)
    }
    closeModal()
    // Après sauvegarde, proposer la propagation si la catégorie a changé
    if (editTarget && oldCategory && oldCategory !== newCategory) {
      const matches = findMatchingRows(editTarget, newCategory, editIsEntree)
      if (matches.length > 0) {
        // Le formulaire a déjà appliqué le bon taux_tva — on le réutilise pour la propagation
        const patch = { categorie: newCategory, taux_tva: formData.taux_tva }
        setPendingCatChange({ row: editTarget, newCategory, patch, matchingRows: matches, isEntree: editIsEntree })
      }
    }
  }

  async function handleCellSave(row, field, newValue) {
    const isEntree = row._type ? row._type === 'entree' : isEntrees
    if (field === 'categorie') {
      const patch = buildCategoriePatch(row.categorie, newValue)
      const matches = findMatchingRows(row, newValue, isEntree)
      if (matches.length > 0) {
        setPendingCatChange({ row, newCategory: newValue, patch, matchingRows: matches, isEntree })
        return
      }
      try {
        if (isEntree) await updateFacture(row.id, patch)
        else          await updateDepense(row.id, patch)
      } catch (e) {
        setActionError(e.message)
      }
      return
    }
    try {
      let patch
      if (field === 'montant_ttc') {
        const ttc  = Math.round(newValue * 100) / 100
        const taux = row.taux_tva ?? 0
        const ht   = Math.round(ttc / (1 + taux / 100) * 100) / 100
        const tva  = Math.round((ttc - ht) * 100) / 100
        patch = { montant_ttc: ttc, montant_ht: ht, montant_tva: tva }
      } else {
        patch = { [field]: newValue }
      }
      if (isEntree) await updateFacture(row.id, patch)
      else          await updateDepense(row.id, patch)
    } catch (e) {
      setActionError(e.message)
    }
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
    ? `l'entrée de ${confirmDelete?.client} (${formatEur(confirmDelete?.montant_ttc)})`
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

      <div className={styles.filterBar}>
        <input
          className={styles.filterInput}
          type="text"
          placeholder="Rechercher un tiers…"
          value={filterTiers}
          onChange={e => setFilterTiers(e.target.value)}
        />
        <input
          className={styles.filterInput}
          type="date"
          value={filterDateFrom}
          onChange={e => setFilterDateFrom(e.target.value)}
          title="Date de début"
          aria-label="Date de début"
        />
        <span className={styles.filterSep} aria-hidden="true">→</span>
        <input
          className={styles.filterInput}
          type="date"
          value={filterDateTo}
          onChange={e => setFilterDateTo(e.target.value)}
          title="Date de fin"
          aria-label="Date de fin"
        />
        <select
          className={styles.filterSelect}
          value={filterCategorie}
          onChange={e => setFilterCategorie(e.target.value)}
        >
          <option value="">Toutes catégories</option>
          {categorieOptions.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          className={styles.filterSelect}
          value={filterStatut}
          onChange={e => setFilterStatut(e.target.value)}
        >
          <option value="">Tous statuts</option>
          <option value="payee">Payée</option>
          <option value="en_attente">En attente</option>
        </select>
        {hasFilters && (
          <button className={styles.btnClearFilters} onClick={clearFilters}>
            × Effacer
          </button>
        )}
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
              <Trash2 size={14} aria-hidden="true" /> Supprimer la sélection
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className={styles.loading}>
          <Spinner />
          <p>Chargement…</p>
        </div>
      ) : error ? (
        <div className={styles.error}>⚠️ {error}</div>
      ) : (
        <>
          <div className={styles.tableInfo}>
            <span className={styles.tableCount}>
              {filteredData.length === 0
                ? (hasFilters ? 'Aucun résultat' : 'Aucune transaction')
                : hasFilters
                  ? `${filteredData.length} sur ${fullData.length} — page ${safePage} / ${totalPages}`
                  : `${fullData.length} transaction${fullData.length > 1 ? 's' : ''} — page ${safePage} / ${totalPages}`}
            </span>
          </div>

          <DataTable
            columns={columns}
            data={pageData}
            onEdit={openEdit}
            onDelete={row => setConfirmDelete(row)}
            onCellSave={handleCellSave}
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

      {pendingCatChange && (() => {
        const { newCategory, matchingRows, isEntree } = pendingCatChange
        const tiersLabel = isEntree
          ? pendingCatChange.row.client
          : pendingCatChange.row.fournisseur
        const count = matchingRows.length
        return (
          <Modal
            title="Appliquer à toutes les transactions ?"
            onClose={applyOnce}
            size="small"
          >
            <div className={styles.confirmBody}>
              <p>
                Vous changez la catégorie en{' '}
                <strong>{newCategory}</strong>.
              </p>
              <p>
                {count} autre{count > 1 ? 's' : ''} transaction{count > 1 ? 's' : ''} liée{count > 1 ? 's' : ''} à{' '}
                <strong>{tiersLabel}</strong> {count > 1 ? 'ont' : 'a'} une catégorie différente.
              </p>
              <ul className={styles.matchList}>
                {matchingRows.slice(0, 5).map(r => (
                  <li key={r.id} className={styles.matchItem}>
                    {r.date} — {formatEur(r.montant_ttc)}
                    <span className={styles.matchCat}>{r.categorie}</span>
                  </li>
                ))}
                {matchingRows.length > 5 && (
                  <li className={styles.matchMore}>…et {matchingRows.length - 5} autre{matchingRows.length - 5 > 1 ? 's' : ''}</li>
                )}
              </ul>
              <div className={styles.confirmActions}>
                <button className={styles.btnCancel} onClick={applyOnce}>
                  Juste cette fois
                </button>
                <button className={styles.btnPrimary} onClick={applyToAll}>
                  Appliquer à toutes ({count + 1})
                </button>
              </div>
            </div>
          </Modal>
        )
      })()}

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
