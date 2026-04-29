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
    id: 'shine',
    name: 'Shine',
    description: 'Synchronisation des transactions bancaires Shine vers les comptes PCG',
    logo: 'S',
    color: '#6c3fc5',
    available: true,
  },
]

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

// ── Shine account form ────────────────────────────────────────────────────────

function ShineAccountForm({ initial, accountId, onSaved, onCancel }) {
  const isEdit = !!accountId

  const [name,      setName]      = useState(initial?.name              || '')
  const [token,     setToken]     = useState(initial?.access_token_masked || '')
  const [accId,     setAccId]     = useState(initial?.shine_account_id  || '')
  const [iban,      setIban]      = useState(initial?.iban              || '')
  const [autoSync,  setAutoSync]  = useState(initial?.auto_sync_enabled || false)
  const [bankAccts, setBankAccts] = useState([])
  const [fetching,  setFetching]  = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState(null)

  async function fetchBankAccounts() {
    if (!isEdit) { setError('Enregistrez le compte d\'abord pour récupérer les comptes bancaires.'); return }
    setFetching(true); setError(null)
    try {
      const d = await api.getShineBankAccounts(accountId)
      setBankAccts(d.accounts || [])
      if (!d.accounts?.length) setError('Aucun compte trouvé.')
    } catch (e) { setError(e.message) }
    finally { setFetching(false) }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      const payload = { name, access_token: token, shine_account_id: accId, iban, auto_sync_enabled: autoSync }
      if (isEdit) await api.updateShineConfig(accountId, payload)
      else        await api.createShineConfig(payload)
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
        {isEdit ? 'Modifier le compte' : 'Ajouter un compte Shine'}
      </div>

      <div className={qStyles.formGrid}>
        <div className={qStyles.field}>
          <label className={qStyles.label}>Nom du compte</label>
          <input className={qStyles.input} type="text" value={name}
            onChange={e => setName(e.target.value)} placeholder="Ex : Compte courant Shine" required />
        </div>
        <div className={qStyles.field}>
          <label className={qStyles.label}>Token d'accès (Personal Access Token)</label>
          <input className={qStyles.input} type="password" value={token}
            onChange={e => setToken(e.target.value)} placeholder="••••••••••••••••" required />
        </div>
      </div>

      <div className={qStyles.accountRow}>
        <div className={qStyles.field} style={{ flex: 1 }}>
          <label className={qStyles.label}>Compte bancaire Shine</label>
          {bankAccts.length > 0 ? (
            <select className={qStyles.select} value={accId}
              onChange={e => {
                const a = bankAccts.find(x => x.id === e.target.value)
                setAccId(e.target.value)
                if (a?.iban) setIban(a.iban)
              }}>
              <option value="">— Sélectionner un compte —</option>
              {bankAccts.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name} — {a.iban} ({new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(a.balance ?? 0)})
                </option>
              ))}
            </select>
          ) : (
            <input className={qStyles.input} type="text" value={accId}
              onChange={e => setAccId(e.target.value)} placeholder="acc_xxxxxxxxxx" />
          )}
        </div>
        <button type="button" className={qStyles.btnSecondary}
          onClick={fetchBankAccounts} disabled={fetching || !token}>
          {fetching ? 'Connexion…' : 'Récupérer les comptes'}
        </button>
      </div>

      <div className={qStyles.field}>
        <label className={qStyles.label}>IBAN (affiché uniquement)</label>
        <input className={qStyles.input} type="text" value={iban}
          onChange={e => setIban(e.target.value)} placeholder="FR76 XXXX XXXX XXXX XXXX XXXX XXX" />
      </div>

      <label className={qStyles.checkboxRow}>
        <input type="checkbox" checked={autoSync} onChange={e => setAutoSync(e.target.checked)} />
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

// ── Shine account row ─────────────────────────────────────────────────────────

function ShineAccountRow({ account, onEdit, onDelete, onSync }) {
  const [syncing,  setSyncing]  = useState(false)
  const [result,   setResult]   = useState(null)
  const [error,    setError]    = useState(null)
  const [deleting, setDeleting] = useState(false)

  async function handleSync() {
    setSyncing(true); setError(null); setResult(null)
    try {
      const r = await api.syncShineAccount(account.id)
      setResult(r)
      onSync()
    } catch (e) { setError(e.message) }
    finally { setSyncing(false) }
  }

  const configured = !!(account.shine_account_id)

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
          {account.auto_sync_enabled ? <span className={styles.autoSyncOn}>Auto-sync activé</span> : null}
        </div>
        {error  && <div className={styles.accountError}>⚠️ {error}</div>}
        {result && (
          <div className={styles.accountResult}>
            ✓ {result.imported} importées · {result.skipped} ignorées · {result.fetched} récupérées
          </div>
        )}
      </div>
      <div className={styles.accountActions}>
        <button className={qStyles.btnPrimary} onClick={handleSync}
          disabled={syncing || !configured}
          title={configured ? 'Synchroniser ce compte' : 'Configurez l\'identifiant de compte pour synchroniser'}>
          {syncing ? '…' : '↻ Sync'}
        </button>
        <button className={qStyles.btnSecondary} onClick={() => onEdit(account)}>Modifier</button>
        {!deleting ? (
          <button className={styles.btnDeleteSmall} onClick={() => setDeleting(true)}>Supprimer</button>
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

// ── Shine tab: Comptes ────────────────────────────────────────────────────────

function ShineCompteTab({ onAccountsChange }) {
  const [accounts,    setAccounts]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [showForm,    setShowForm]    = useState(false)
  const [editAccount, setEditAccount] = useState(null)
  const [error,       setError]       = useState(null)
  const [syncingAll,  setSyncingAll]  = useState(false)
  const [syncAllRes,  setSyncAllRes]  = useState(null)

  const loadAccounts = useCallback(() => {
    api.getShineConfigs()
      .then(d => setAccounts(d.accounts || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadAccounts() }, [loadAccounts])

  function handleSaved() { setShowForm(false); setEditAccount(null); loadAccounts(); onAccountsChange() }
  function handleEdit(account) { setEditAccount(account); setShowForm(true) }
  async function handleDelete(id) {
    try { await api.deleteShineConfig(id); loadAccounts(); onAccountsChange() }
    catch (e) { setError(e.message) }
  }
  async function handleSyncAll() {
    setSyncingAll(true); setSyncAllRes(null); setError(null)
    try {
      const d = await api.syncAllShine()
      setSyncAllRes(d.results || [])
      loadAccounts(); onAccountsChange()
    } catch (e) { setError(e.message) }
    finally { setSyncingAll(false) }
  }

  if (loading) return <div className={qStyles.loading}><div className={qStyles.spinner} /></div>

  return (
    <div className={qStyles.section}>
      <div className={styles.compteTabHeader}>
        <div>
          <h2 className={qStyles.sectionTitle}>Comptes Shine</h2>
          <p className={qStyles.sectionDesc}>
            Ajoutez un ou plusieurs comptes Shine pour synchroniser leurs transactions automatiquement.
          </p>
        </div>
        <div className={styles.compteTabHeaderActions}>
          {accounts.length > 1 && (
            <button className={qStyles.btnSecondary} onClick={handleSyncAll} disabled={syncingAll}>
              {syncingAll ? 'Sync en cours…' : '↻ Tout synchroniser'}
            </button>
          )}
          {!showForm && (
            <button className={qStyles.btnPrimary}
              onClick={() => { setEditAccount(null); setShowForm(true) }}>
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
        <ShineAccountForm
          initial={editAccount ? {
            name:             editAccount.name,
            shine_account_id: editAccount.shine_account_id,
            iban:             editAccount.iban,
            auto_sync_enabled: editAccount.auto_sync_enabled,
          } : null}
          accountId={editAccount?.id}
          onSaved={handleSaved}
          onCancel={() => { setShowForm(false); setEditAccount(null) }}
        />
      )}

      {accounts.length === 0 && !showForm && (
        <div className={styles.emptyState}>
          Aucun compte configuré. Ajoutez votre premier compte Shine pour commencer.
        </div>
      )}

      <div className={styles.accountList}>
        {accounts.map(acct => (
          <ShineAccountRow
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

// ── Shine tab: Historique ─────────────────────────────────────────────────────

function ShineSyncTab() {
  const [logs,         setLogs]         = useState([])
  const [error,        setError]        = useState(null)
  const [resetting,    setResetting]    = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(null)

  const loadLog = useCallback(() => {
    api.getShineSyncLog().then(d => setLogs(d.logs || [])).catch(() => {})
  }, [])

  useEffect(() => { loadLog() }, [loadLog])

  async function handleReset() {
    setResetting(true); setError(null); setResetSuccess(null)
    try { await api.resetShineData(); setResetSuccess('Historique Shine réinitialisé.'); loadLog() }
    catch (err) { setError(err.message) }
    finally { setResetting(false); setConfirmReset(false) }
  }

  return (
    <div className={qStyles.section}>
      <h2 className={qStyles.sectionTitle}>Historique des synchronisations</h2>
      <p className={qStyles.sectionDesc}>
        Retrouvez ici l'historique de toutes les synchronisations Shine, par compte.
      </p>
      {error        && <div className={qStyles.error}>⚠️ {error}</div>}
      {resetSuccess && <div className={qStyles.successMsg}>✓ {resetSuccess}</div>}
      {logs.length > 0 ? (
        <div className={qStyles.logSection}>
          <table className={qStyles.logTable}>
            <thead>
              <tr>
                <th>Date</th><th>Compte</th>
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
          <button className={qStyles.btnReset} onClick={() => setConfirmReset(true)} disabled={resetting}>
            🗑️ Réinitialiser l'historique Shine
          </button>
        ) : (
          <div className={qStyles.resetConfirm}>
            <span className={qStyles.resetConfirmText}>Supprimer tout l'historique Shine ?</span>
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

// ── Shine detail panel ────────────────────────────────────────────────────────

function ShineDetailPanel({ onClose, onAccountsChange }) {
  const [activeTab, setActiveTab] = useState('comptes')
  const tabs = [
    { id: 'comptes', label: 'Comptes' },
    { id: 'sync',    label: 'Historique' },
  ]
  const connector = CONNECTORS.find(c => c.id === 'shine')

  return (
    <div className={styles.detailPanel}>
      <div className={styles.detailHeader}>
        <div className={styles.detailHeaderLeft}>
          <div className={styles.detailLogoWrap} style={{ backgroundColor: connector.color }} aria-hidden="true">
            {connector.logo}
          </div>
          <h2 className={styles.detailTitle}>{connector.name}</h2>
        </div>
        <button className={styles.detailClose} onClick={onClose} aria-label="Fermer">×</button>
      </div>
      <div className={styles.tabs}>
        {tabs.map(t => (
          <button key={t.id}
            className={`${styles.tab} ${activeTab === t.id ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {activeTab === 'comptes' && <ShineCompteTab onAccountsChange={onAccountsChange} />}
      {activeTab === 'sync'    && <ShineSyncTab />}
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

      {activeTab === 'comptes'  && <CompteTab onAccountsChange={onAccountsChange} />}
      {activeTab === 'sync'     && <SyncTab />}
    </div>
  )
}

// ── AI Config Panel ───────────────────────────────────────────────────────────

const AI_PROVIDERS = [
  { id: 'anthropic', name: 'Anthropic', color: '#d97706', letter: 'A',
    models: [
      { id: 'claude-opus-4-7',           label: 'Claude Opus 4.7' },
      { id: 'claude-sonnet-4-6',         label: 'Claude Sonnet 4.6' },
      { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
    ],
  },
  { id: 'openai', name: 'OpenAI', color: '#10a37f', letter: 'O',
    models: [
      { id: 'gpt-4o',      label: 'GPT-4o' },
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    ],
  },
  { id: 'mistral', name: 'Mistral', color: '#ff7000', letter: 'M',
    models: [
      { id: 'mistral-large-latest',  label: 'Mistral Large' },
      { id: 'mistral-medium-latest', label: 'Mistral Medium' },
      { id: 'mistral-small-latest',  label: 'Mistral Small' },
    ],
  },
  { id: 'gemini', name: 'Gemini', color: '#1a73e8', letter: 'G',
    models: [
      { id: 'gemini-2.0-flash',      label: 'Gemini 2.0 Flash' },
      { id: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite' },
      { id: 'gemini-1.5-pro',        label: 'Gemini 1.5 Pro' },
      { id: 'gemini-1.5-flash',      label: 'Gemini 1.5 Flash' },
    ],
  },
]

function AIConfigPanel() {
  const [provider,     setProvider]     = useState('anthropic')
  const [apiKey,       setApiKey]       = useState('')
  const [model,        setModel]        = useState('claude-sonnet-4-6')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [saving,       setSaving]       = useState(false)
  const [deleting,     setDeleting]     = useState(false)
  const [confirmDel,   setConfirmDel]   = useState(false)
  const [editing,      setEditing]      = useState(false)
  const [error,        setError]        = useState(null)
  const [configured,   setConfigured]   = useState(false)

  useEffect(() => {
    api.getAIConfig()
      .then(d => {
        if (d.configured) {
          setConfigured(true)
          setProvider(d.provider || 'anthropic')
          setModel(d.model || 'claude-sonnet-4-6')
          setApiKey(d.api_key_masked || '')
          setSystemPrompt(d.system_prompt || '')
        }
      })
      .catch(() => {})
  }, [])

  function handleProviderChange(p) {
    setProvider(p)
    const def = AI_PROVIDERS.find(x => x.id === p)
    setModel(def?.models[0]?.id || '')
    if (!apiKey.startsWith('••••')) setApiKey('')
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      await api.saveAIConfig({ provider, api_key: apiKey, model, system_prompt: systemPrompt })
      setConfigured(true)
      setEditing(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true); setError(null)
    try {
      await api.deleteAIConfig()
      setConfigured(false)
      setEditing(false)
      setConfirmDel(false)
      setProvider('anthropic')
      setModel('claude-sonnet-4-6')
      setApiKey('')
      setSystemPrompt('')
    } catch (err) {
      setError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  const currentProvider = AI_PROVIDERS.find(p => p.id === provider)
  const currentModel    = currentProvider?.models.find(m => m.id === model)

  // ── Vue "connecté" ────────────────────────────────────────────────────────
  if (configured && !editing) {
    return (
      <div className={styles.aiPanel}>
        <div className={styles.aiPanelHeader}>
          <h2 className={styles.aiPanelTitle}>ComptIA</h2>
          <p className={styles.aiPanelDesc}>
            Agent expert en comptabilité française (PCG, CGI, TVA) — vos données comptables sont
            transmises automatiquement pour des réponses contextualisées.
          </p>
        </div>

        <div className={styles.aiConnectionCard} style={{ borderColor: currentProvider?.color }}>
          <div className={styles.aiConnectionLeft}>
            <span className={styles.providerLogo} style={{ background: currentProvider?.color }}>
              {currentProvider?.letter}
            </span>
            <div className={styles.aiConnectionInfo}>
              <span className={styles.aiConnectionProvider}>{currentProvider?.name}</span>
              <span className={styles.aiConnectionModel}>{currentModel?.label ?? model}</span>
            </div>
          </div>
          <span className={styles.aiConnectionBadge}>Connecté</span>
        </div>

        {error && <div className={styles.aiError}>⚠️ {error}</div>}

        <div className={styles.aiActions}>
          <button
            type="button"
            className={styles.aiBtnPrimary}
            onClick={() => { setEditing(true); setError(null) }}
          >
            Modifier
          </button>
          {confirmDel ? (
            <span className={styles.aiDeleteConfirm}>
              Supprimer la connexion ?
              <button
                type="button"
                className={styles.aiBtnDanger}
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Suppression…' : 'Confirmer'}
              </button>
              <button
                type="button"
                className={styles.aiBtnGhost}
                onClick={() => setConfirmDel(false)}
              >
                Annuler
              </button>
            </span>
          ) : (
            <button
              type="button"
              className={styles.aiBtnGhost}
              onClick={() => setConfirmDel(true)}
            >
              Supprimer
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Vue "formulaire" (nouvelle config ou modification) ────────────────────
  return (
    <div className={styles.aiPanel}>
      <div className={styles.aiPanelHeader}>
        <h2 className={styles.aiPanelTitle}>ComptIA</h2>
        <p className={styles.aiPanelDesc}>
          Connectez un modèle IA pour accéder à un agent expert en comptabilité française (PCG, CGI, TVA).
          Vos données comptables sont transmises automatiquement pour des réponses contextualisées.
        </p>
      </div>

      <form className={styles.aiForm} onSubmit={handleSave}>
        <div className={styles.aiSection}>
          <label className={styles.aiLabel}>Fournisseur</label>
          <div className={styles.providerCards}>
            {AI_PROVIDERS.map(p => (
              <button
                key={p.id}
                type="button"
                className={`${styles.providerCard} ${provider === p.id ? styles.providerCardActive : ''}`}
                onClick={() => handleProviderChange(p.id)}
                style={provider === p.id ? { borderColor: p.color } : {}}
              >
                <span className={styles.providerLogo} style={{ background: p.color }}>{p.letter}</span>
                <span className={styles.providerName}>{p.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.aiRow}>
          <div className={styles.aiField}>
            <label className={styles.aiLabel}>Modèle</label>
            <select
              className={styles.aiSelect}
              value={model}
              onChange={e => setModel(e.target.value)}
            >
              {currentProvider?.models.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>

          <div className={styles.aiField} style={{ flex: 2 }}>
            <label className={styles.aiLabel}>Clé API</label>
            <input
              type="password"
              className={styles.aiInput}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="Votre clé API…"
              required
            />
          </div>
        </div>

        <div className={styles.aiField}>
          <label className={styles.aiLabel}>
            Prompt système <span className={styles.aiOptional}>(optionnel)</span>
          </label>
          <textarea
            className={styles.aiTextarea}
            value={systemPrompt}
            onChange={e => setSystemPrompt(e.target.value)}
            placeholder="Instructions supplémentaires pour l'agent (ex : je suis en micro-BNC, réponds de façon concise…)"
            rows={3}
          />
        </div>

        {error && <div className={styles.aiError}>⚠️ {error}</div>}

        <div className={styles.aiActions}>
          <button type="submit" className={styles.aiBtnPrimary} disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          {editing && (
            <button
              type="button"
              className={styles.aiBtnGhost}
              onClick={() => { setEditing(false); setError(null) }}
            >
              Annuler
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Integrations() {
  const [mainTab,       setMainTab]       = useState('banque')
  const [selectedId,    setSelectedId]    = useState(null)
  const [qontoAccounts, setQontoAccounts] = useState([])
  const [shineAccounts, setShineAccounts] = useState([])

  const loadQontoAccounts = useCallback(() => {
    api.getQontoConfigs().then(d => setQontoAccounts(d.accounts || [])).catch(() => {})
  }, [])

  const loadShineAccounts = useCallback(() => {
    api.getShineConfigs().then(d => setShineAccounts(d.accounts || [])).catch(() => {})
  }, [])

  useEffect(() => { loadQontoAccounts(); loadShineAccounts() }, [loadQontoAccounts, loadShineAccounts])

  function handleCardClick(connector) {
    if (!connector.available) return
    setSelectedId(prev => (prev === connector.id ? null : connector.id))
  }

  function switchMainTab(tab) {
    setMainTab(tab)
    setSelectedId(null)
  }

  const isQontoConnected = qontoAccounts.some(a => a.iban)
  const isShineConnected = shineAccounts.some(a => a.shine_account_id)

  function isConnected(id) {
    if (id === 'qonto') return isQontoConnected
    if (id === 'shine') return isShineConnected
    return false
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Connexions API</h1>
        <p className={styles.pageSubtitle}>
          Connectez vos comptes bancaires et configurez votre agent comptable IA.
        </p>
      </div>

      <div className={styles.mainTabs}>
        <button
          className={`${styles.mainTab} ${mainTab === 'banque' ? styles.mainTabActive : ''}`}
          onClick={() => switchMainTab('banque')}
        >
          🏦 Banque
        </button>
        <button
          className={`${styles.mainTab} ${mainTab === 'ia' ? styles.mainTabActive : ''}`}
          onClick={() => switchMainTab('ia')}
        >
          ✦ Intelligence Artificielle
        </button>
      </div>

      {mainTab === 'banque' && (
        <>
          <div className={styles.grid}>
            {CONNECTORS.map(connector => (
              <ConnectorCard
                key={connector.id}
                connector={connector}
                isSelected={selectedId === connector.id}
                isConnected={isConnected(connector.id)}
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

          {selectedId === 'shine' && (
            <ShineDetailPanel
              onClose={() => setSelectedId(null)}
              onAccountsChange={loadShineAccounts}
            />
          )}
        </>
      )}

      {mainTab === 'ia' && <AIConfigPanel />}
    </div>
  )
}
