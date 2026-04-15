import { useState, useEffect, useCallback } from 'react'
import { api, formatEur } from '../lib/api.js'
import styles from './Integrations.module.css'
import qStyles from './Qonto.module.css'

// ── Connector registry ────────────────────────────────────────────────────────

const CONNECTORS = [
  {
    id: 'qonto',
    name: 'Qonto',
    description: 'Synchronisation des transactions bancaires vers les comptes PCG',
    logo: 'Q',
    color: '#ff5c35',
    available: true,
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Paiements en ligne, abonnements et factures',
    logo: 'S',
    color: '#635bff',
    available: false,
  },
  {
    id: 'paypal',
    name: 'PayPal',
    description: 'Paiements internationaux et marketplace',
    logo: 'PP',
    color: '#003087',
    available: false,
  },
  {
    id: 'pennylane',
    name: 'Pennylane',
    description: 'Synchronisation avec votre cabinet comptable',
    logo: '✦',
    color: '#10b981',
    available: false,
  },
]

// ── Qonto constants ───────────────────────────────────────────────────────────

const TAUX_OPTIONS = [
  { value: 20,  label: '20 %' },
  { value: 10,  label: '10 %' },
  { value: 5.5, label: '5,5 %' },
  { value: 2.1, label: '2,1 %' },
  { value: 0,   label: '0 %' },
]

const OP_TYPE_LABELS = {
  transfer:     'Virement (transfer)',
  card:         'Paiement carte (card)',
  direct_debit: 'Prélèvement SEPA (direct_debit)',
  qonto_fee:    'Frais Qonto (qonto_fee)',
  atm:          'Retrait DAB (atm)',
  cheque:       'Chèque (cheque)',
  payroll:      'Paie (payroll)',
  recall:       'Rappel de virement (recall)',
  card_refund:  'Remboursement carte (card_refund)',
  other:        'Autre (other)',
}

// ── Account form (add / edit) ─────────────────────────────────────────────────

function AccountForm({ initial, accountId, onSaved, onCancel }) {
  const isEdit = !!accountId

  const [name,      setName]      = useState(initial?.name      || '')
  const [slug,      setSlug]      = useState(initial?.organization_slug || '')
  const [secret,    setSecret]    = useState(initial?.secret_key_masked || '')
  const [iban,      setIban]      = useState(initial?.iban       || '')
  const [autoSync,  setAutoSync]  = useState(initial?.auto_sync_enabled || false)
  const [bankAccts, setBankAccts] = useState([])
  const [fetching,  setFetching]  = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState(null)

  async function fetchBankAccounts() {
    if (isEdit) {
      setFetching(true); setError(null)
      try {
        const d = await api.getQontoBankAccounts(accountId)
        setBankAccts(d.accounts || [])
        if (!d.accounts?.length) setError('Aucun compte trouvé.')
      } catch (e) { setError(e.message) }
      finally { setFetching(false) }
    } else {
      // For a new unsaved account we can't use the per-id endpoint yet;
      // save first then fetch, or ask user to save first.
      setError('Enregistrez le compte d\'abord pour récupérer les comptes bancaires.')
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      const payload = { name, organization_slug: slug, secret_key: secret, iban, auto_sync_enabled: autoSync }
      if (isEdit) {
        await api.updateQontoConfig(accountId, payload)
      } else {
        await api.createQontoConfig(payload)
      }
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className={styles.accountForm} onSubmit={handleSubmit}>
      <div className={styles.accountFormTitle}>
        {isEdit ? 'Modifier le compte' : 'Ajouter un compte Qonto'}
      </div>

      <div className={qStyles.formGrid}>
        <div className={qStyles.field}>
          <label className={qStyles.label}>Nom du compte</label>
          <input
            className={qStyles.input}
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ex : Compte courant principal"
            required
          />
        </div>
        <div className={qStyles.field}>
          <label className={qStyles.label}>Organization slug</label>
          <input
            className={qStyles.input}
            type="text"
            value={slug}
            onChange={e => setSlug(e.target.value)}
            placeholder="mon-entreprise-abc123"
            required
          />
        </div>
        <div className={qStyles.field}>
          <label className={qStyles.label}>Clé secrète (secret key)</label>
          <input
            className={qStyles.input}
            type="password"
            value={secret}
            onChange={e => setSecret(e.target.value)}
            placeholder="••••••••••••••••"
            required
          />
        </div>
      </div>

      <div className={qStyles.accountRow}>
        <div className={qStyles.field} style={{ flex: 1 }}>
          <label className={qStyles.label}>IBAN du compte à synchroniser</label>
          {bankAccts.length > 0 ? (
            <select className={qStyles.select} value={iban} onChange={e => setIban(e.target.value)}>
              <option value="">— Sélectionner un compte —</option>
              {bankAccts.map(a => (
                <option key={a.iban} value={a.iban}>
                  {a.name} — {a.iban} ({formatEur(a.balance)})
                </option>
              ))}
            </select>
          ) : (
            <input
              className={qStyles.input}
              type="text"
              value={iban}
              onChange={e => setIban(e.target.value)}
              placeholder="FR76 XXXX XXXX XXXX XXXX XXXX XXX"
            />
          )}
        </div>
        <button
          type="button"
          className={qStyles.btnSecondary}
          onClick={fetchBankAccounts}
          disabled={fetching || !slug || !secret}
        >
          {fetching ? 'Connexion…' : 'Récupérer les comptes'}
        </button>
      </div>

      <label className={qStyles.checkboxRow}>
        <input
          type="checkbox"
          checked={autoSync}
          onChange={e => setAutoSync(e.target.checked)}
        />
        <span>Synchronisation automatique quotidienne</span>
      </label>

      {error && <div className={qStyles.error}>⚠️ {error}</div>}

      <div className={styles.accountFormActions}>
        <button className={qStyles.btnPrimary} type="submit" disabled={saving}>
          {saving ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Ajouter le compte'}
        </button>
        <button type="button" className={qStyles.btnSecondary} onClick={onCancel} disabled={saving}>
          Annuler
        </button>
      </div>
    </form>
  )
}

// ── Account row ───────────────────────────────────────────────────────────────

function AccountRow({ account, onEdit, onDelete, onSync }) {
  const [syncing,  setSyncing]  = useState(false)
  const [result,   setResult]   = useState(null)
  const [error,    setError]    = useState(null)
  const [deleting, setDeleting] = useState(false)

  async function handleSync() {
    setSyncing(true); setError(null); setResult(null)
    try {
      const r = await api.syncQontoAccount(account.id)
      setResult(r)
      onSync()
    } catch (e) { setError(e.message) }
    finally { setSyncing(false) }
  }

  const configured = !!(account.organization_slug && account.iban)

  return (
    <div className={styles.accountRow}>
      <div className={styles.accountInfo}>
        <div className={styles.accountName}>{account.name}</div>
        <div className={styles.accountMeta}>
          {account.iban
            ? <span className={styles.accountIban}>{account.iban}</span>
            : <span className={styles.accountWarn}>IBAN non défini</span>}
          {account.last_sync_at && (
            <span className={styles.accountLastSync}>
              Dernier sync : {new Date(account.last_sync_at).toLocaleString('fr-FR')}
            </span>
          )}
          {account.auto_sync_enabled ? (
            <span className={styles.autoSyncOn}>Auto-sync activé</span>
          ) : null}
        </div>
        {error  && <div className={styles.accountError}>⚠️ {error}</div>}
        {result && (
          <div className={styles.accountResult}>
            ✓ {result.imported} importées · {result.skipped} ignorées · {result.fetched} récupérées
          </div>
        )}
      </div>
      <div className={styles.accountActions}>
        <button
          className={qStyles.btnPrimary}
          onClick={handleSync}
          disabled={syncing || !configured}
          title={configured ? 'Synchroniser ce compte' : 'Configurez l\'IBAN pour synchroniser'}
        >
          {syncing ? '…' : '↻ Sync'}
        </button>
        <button className={qStyles.btnSecondary} onClick={() => onEdit(account)}>
          Modifier
        </button>
        {!deleting ? (
          <button className={styles.btnDeleteSmall} onClick={() => setDeleting(true)}>
            Supprimer
          </button>
        ) : (
          <span className={styles.deleteConfirm}>
            <span>Confirmer ?</span>
            <button className={styles.btnDeleteConfirm} onClick={() => onDelete(account.id)}>Oui</button>
            <button className={qStyles.btnSecondary} onClick={() => setDeleting(false)}>Non</button>
          </span>
        )}
      </div>
    </div>
  )
}

// ── Tab: Comptes ──────────────────────────────────────────────────────────────

function CompteTab({ onAccountsChange }) {
  const [accounts,    setAccounts]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [showForm,    setShowForm]    = useState(false)
  const [editAccount, setEditAccount] = useState(null)
  const [error,       setError]       = useState(null)
  const [syncingAll,  setSyncingAll]  = useState(false)
  const [syncAllRes,  setSyncAllRes]  = useState(null)

  const loadAccounts = useCallback(() => {
    api.getQontoConfigs()
      .then(d => setAccounts(d.accounts || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadAccounts() }, [loadAccounts])

  function handleSaved() {
    setShowForm(false)
    setEditAccount(null)
    loadAccounts()
    onAccountsChange()
  }

  function handleEdit(account) {
    setEditAccount(account)
    setShowForm(true)
  }

  async function handleDelete(id) {
    try {
      await api.deleteQontoConfig(id)
      loadAccounts()
      onAccountsChange()
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleSyncAll() {
    setSyncingAll(true); setSyncAllRes(null); setError(null)
    try {
      const d = await api.syncAllQonto()
      setSyncAllRes(d.results || [])
      loadAccounts()
      onAccountsChange()
    } catch (e) {
      setError(e.message)
    } finally {
      setSyncingAll(false)
    }
  }

  if (loading) return <div className={qStyles.loading}><div className={qStyles.spinner} /></div>

  return (
    <div className={qStyles.section}>
      <div className={styles.compteTabHeader}>
        <div>
          <h2 className={qStyles.sectionTitle}>Comptes Qonto</h2>
          <p className={qStyles.sectionDesc}>
            Ajoutez un ou plusieurs comptes Qonto pour synchroniser leurs transactions automatiquement.
          </p>
        </div>
        <div className={styles.compteTabHeaderActions}>
          {accounts.length > 1 && (
            <button
              className={qStyles.btnSecondary}
              onClick={handleSyncAll}
              disabled={syncingAll}
            >
              {syncingAll ? 'Sync en cours…' : '↻ Tout synchroniser'}
            </button>
          )}
          {!showForm && (
            <button
              className={qStyles.btnPrimary}
              onClick={() => { setEditAccount(null); setShowForm(true) }}
            >
              + Ajouter un compte
            </button>
          )}
        </div>
      </div>

      {error && <div className={qStyles.error}>⚠️ {error}</div>}

      {syncAllRes && (
        <div className={styles.syncAllResults}>
          {syncAllRes.map(r => (
            <div key={r.id} className={styles.syncAllRow}>
              <strong>{r.name}</strong>
              {r.skipped && r.reason
                ? <span className={styles.syncAllSkip}> — Ignoré ({r.reason})</span>
                : r.error
                  ? <span className={styles.syncAllError}> — Erreur : {r.error}</span>
                  : <span className={styles.syncAllOk}> — {r.imported} importées, {r.skipped} ignorées</span>}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <AccountForm
          initial={editAccount ? {
            name: editAccount.name,
            organization_slug: editAccount.organization_slug,
            iban: editAccount.iban,
            auto_sync_enabled: editAccount.auto_sync_enabled,
          } : null}
          accountId={editAccount?.id}
          onSaved={handleSaved}
          onCancel={() => { setShowForm(false); setEditAccount(null) }}
        />
      )}

      {accounts.length === 0 && !showForm && (
        <div className={styles.emptyState}>
          Aucun compte configuré. Ajoutez votre premier compte Qonto pour commencer.
        </div>
      )}

      <div className={styles.accountList}>
        {accounts.map(acct => (
          <AccountRow
            key={acct.id}
            account={acct}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onSync={loadAccounts}
          />
        ))}
      </div>
    </div>
  )
}

// ── Tab: Mapping ──────────────────────────────────────────────────────────────

function MappingTab() {
  const [mappings, setMappings]       = useState([])
  const [pcgProduits, setPcgProduits] = useState([])
  const [pcgCharges, setPcgCharges]   = useState([])
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState(null)
  const [success, setSuccess]         = useState(null)
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    api.getQontoMappings()
      .then(d => {
        setMappings(d.mappings || [])
        setPcgProduits(d.pcg_produits || [])
        setPcgCharges(d.pcg_charges || [])
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  function updateMapping(id, field, value) {
    setMappings(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m))
  }

  async function handleSave() {
    setSaving(true); setError(null); setSuccess(null)
    try {
      await api.saveQontoMappings({ mappings })
      setSuccess('Mappings enregistrés.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const credits = mappings.filter(m => m.side === 'credit')
  const debits  = mappings.filter(m => m.side === 'debit')

  function MappingRow({ m }) {
    const categories = m.side === 'credit' ? pcgProduits : pcgCharges
    return (
      <tr>
        <td>
          <span className={`${qStyles.sideBadge} ${m.side === 'credit' ? qStyles.sideCredit : qStyles.sideDebit}`}>
            {m.side === 'credit' ? 'Crédit ↑' : 'Débit ↓'}
          </span>
        </td>
        <td className={qStyles.opType}>{OP_TYPE_LABELS[m.qonto_operation_type] || m.qonto_operation_type}</td>
        <td>
          <select
            className={qStyles.selectSm}
            value={m.pcg_category}
            onChange={e => updateMapping(m.id, 'pcg_category', e.target.value)}
          >
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </td>
        <td>
          <select
            className={qStyles.selectXs}
            value={m.default_taux_tva}
            onChange={e => updateMapping(m.id, 'default_taux_tva', Number(e.target.value))}
          >
            {TAUX_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </td>
      </tr>
    )
  }

  if (loading) return <div className={qStyles.loading}><div className={qStyles.spinner} /></div>

  return (
    <div className={qStyles.section}>
      <h2 className={qStyles.sectionTitle}>Correspondances Qonto → PCG</h2>
      <p className={qStyles.sectionDesc}>
        Associez chaque type d'opération Qonto à un compte PCG et un taux TVA par défaut.
        Ces règles s'appliquent à tous vos comptes Qonto.
      </p>

      {error   && <div className={qStyles.error}>⚠️ {error}</div>}
      {success && <div className={qStyles.successMsg}>✓ {success}</div>}

      <div className={qStyles.tableWrapper}>
        <table className={qStyles.mappingTable}>
          <thead>
            <tr>
              <th>Sens</th>
              <th>Type d'opération Qonto</th>
              <th>Compte PCG</th>
              <th>TVA</th>
            </tr>
          </thead>
          <tbody>
            {credits.map(m => <MappingRow key={m.id} m={m} />)}
            {credits.length > 0 && debits.length > 0 && (
              <tr className={qStyles.mappingDivider}><td colSpan={4} /></tr>
            )}
            {debits.map(m => <MappingRow key={m.id} m={m} />)}
          </tbody>
        </table>
      </div>

      <div className={qStyles.formActions}>
        <button className={qStyles.btnPrimary} onClick={handleSave} disabled={saving || mappings.length === 0}>
          {saving ? 'Enregistrement…' : 'Enregistrer les mappings'}
        </button>
      </div>
    </div>
  )
}

// ── Tab: Synchronisation ──────────────────────────────────────────────────────

function SyncTab() {
  const [logs,          setLogs]          = useState([])
  const [error,         setError]         = useState(null)
  const [resetting,     setResetting]     = useState(false)
  const [confirmReset,  setConfirmReset]  = useState(false)
  const [resetSuccess,  setResetSuccess]  = useState(null)

  const loadLog = useCallback(() => {
    api.getQontoSyncLog()
      .then(d => setLogs(d.logs || []))
      .catch(() => {})
  }, [])

  useEffect(() => { loadLog() }, [loadLog])

  async function handleReset() {
    setResetting(true); setError(null); setResetSuccess(null)
    try {
      await api.resetQontoData()
      setResetSuccess('Toutes les transactions ont été supprimées.')
      loadLog()
    } catch (err) {
      setError(err.message)
    } finally {
      setResetting(false)
      setConfirmReset(false)
    }
  }

  return (
    <div className={qStyles.section}>
      <h2 className={qStyles.sectionTitle}>Historique des synchronisations</h2>
      <p className={qStyles.sectionDesc}>
        Retrouvez ici l'historique de toutes les synchronisations, par compte.
        Pour lancer un sync, utilisez les boutons dans l'onglet Comptes.
      </p>

      {error        && <div className={qStyles.error}>⚠️ {error}</div>}
      {resetSuccess && <div className={qStyles.successMsg}>✓ {resetSuccess}</div>}

      {logs.length > 0 ? (
        <div className={qStyles.logSection}>
          <table className={qStyles.logTable}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Compte</th>
                <th className={qStyles.right}>Récupérées</th>
                <th className={qStyles.right}>Importées</th>
                <th className={qStyles.right}>Ignorées</th>
                <th>Erreurs</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td>{new Date(log.synced_at).toLocaleString('fr-FR')}</td>
                  <td>{log.account_name || '—'}</td>
                  <td className={qStyles.right}>{log.fetched}</td>
                  <td className={`${qStyles.right} ${log.imported > 0 ? qStyles.numGreen : ''}`}>{log.imported}</td>
                  <td className={qStyles.right}>{log.skipped}</td>
                  <td className={log.errors ? qStyles.errCell : ''}>
                    {log.errors ? '⚠️ ' + log.errors.split('\n')[0] : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={styles.emptyState}>Aucun historique de synchronisation.</div>
      )}

      <div className={qStyles.syncActions} style={{ marginTop: '24px' }}>
        {!confirmReset ? (
          <button
            className={qStyles.btnReset}
            onClick={() => setConfirmReset(true)}
            disabled={resetting}
          >
            🗑️ Réinitialiser toutes les données
          </button>
        ) : (
          <div className={qStyles.resetConfirm}>
            <span className={qStyles.resetConfirmText}>
              Supprimer toutes les transactions et l'historique sync ?
            </span>
            <button className={qStyles.btnResetConfirm} onClick={handleReset} disabled={resetting}>
              {resetting ? 'Suppression…' : 'Confirmer'}
            </button>
            <button className={qStyles.btnResetCancel} onClick={() => setConfirmReset(false)} disabled={resetting}>
              Annuler
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Connector card ────────────────────────────────────────────────────────────

function ConnectorCard({ connector, isSelected, isConnected, onClick }) {
  const { name, description, logo, color, available } = connector

  let statusEl
  if (!available) {
    statusEl = <span className={`${styles.cardStatus} ${styles.statusSoon}`}>Bientôt disponible</span>
  } else if (isConnected) {
    statusEl = <span className={`${styles.cardStatus} ${styles.statusConnected}`}>✓ Connecté</span>
  } else {
    statusEl = <span className={`${styles.cardStatus} ${styles.statusNotConfigured}`}>Non configuré</span>
  }

  const cardClass = [
    styles.card,
    isSelected ? styles.cardSelected : '',
    !available ? styles.cardDisabled : '',
  ].filter(Boolean).join(' ')

  return (
    <div
      className={cardClass}
      onClick={available ? onClick : undefined}
      role={available ? 'button' : undefined}
      tabIndex={available ? 0 : undefined}
      aria-pressed={available ? isSelected : undefined}
      onKeyDown={available ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } } : undefined}
    >
      <div className={styles.cardTop}>
        <div
          className={styles.cardLogoWrap}
          style={{ backgroundColor: color }}
          aria-hidden="true"
        >
          {logo}
        </div>
      </div>
      <p className={styles.cardName}>{name}</p>
      <p className={styles.cardDesc}>{description}</p>
      {statusEl}
    </div>
  )
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function QontoDetailPanel({ onClose, hasAccounts, onAccountsChange }) {
  const [activeTab, setActiveTab] = useState('comptes')

  const tabs = [
    { id: 'comptes',  label: 'Comptes' },
    { id: 'mapping',  label: 'Mapping catégories' },
    { id: 'sync',     label: 'Historique' },
  ]

  const connector = CONNECTORS.find(c => c.id === 'qonto')

  return (
    <div className={styles.detailPanel}>
      <div className={styles.detailHeader}>
        <div className={styles.detailHeaderLeft}>
          <div
            className={styles.detailLogoWrap}
            style={{ backgroundColor: connector.color }}
            aria-hidden="true"
          >
            {connector.logo}
          </div>
          <h2 className={styles.detailTitle}>{connector.name}</h2>
        </div>
        <button
          className={styles.detailClose}
          onClick={onClose}
          aria-label="Fermer le panneau de configuration"
        >
          ×
        </button>
      </div>

      <div className={styles.tabs}>
        {tabs.map(t => (
          <button
            key={t.id}
            className={`${styles.tab} ${activeTab === t.id ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'comptes'  && <CompteTab  onAccountsChange={onAccountsChange} />}
      {activeTab === 'mapping'  && <MappingTab />}
      {activeTab === 'sync'     && <SyncTab />}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Integrations() {
  const [selectedId,    setSelectedId]    = useState(null)
  const [qontoAccounts, setQontoAccounts] = useState([])

  const loadQontoAccounts = useCallback(() => {
    api.getQontoConfigs()
      .then(d => setQontoAccounts(d.accounts || []))
      .catch(() => {})
  }, [])

  useEffect(() => { loadQontoAccounts() }, [loadQontoAccounts])

  function handleCardClick(connector) {
    if (!connector.available) return
    setSelectedId(prev => (prev === connector.id ? null : connector.id))
  }

  const isQontoConnected = qontoAccounts.some(a => a.iban)

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Connexions API</h1>
        <p className={styles.pageSubtitle}>
          Connectez vos outils financiers pour synchroniser automatiquement vos données comptables.
        </p>
      </div>

      <div className={styles.grid}>
        {CONNECTORS.map(connector => (
          <ConnectorCard
            key={connector.id}
            connector={connector}
            isSelected={selectedId === connector.id}
            isConnected={connector.id === 'qonto' ? isQontoConnected : false}
            onClick={() => handleCardClick(connector)}
          />
        ))}
      </div>

      {selectedId === 'qonto' && (
        <QontoDetailPanel
          onClose={() => setSelectedId(null)}
          hasAccounts={qontoAccounts.length > 0}
          onAccountsChange={loadQontoAccounts}
        />
      )}
    </div>
  )
}
