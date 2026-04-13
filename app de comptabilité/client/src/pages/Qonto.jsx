import { useState, useEffect, useCallback } from 'react'
import { api, formatEur, formatDate } from '../lib/api.js'
import styles from './Qonto.module.css'

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

// ── Tab: Configuration ────────────────────────────────────────────────────────

function ConfigTab({ config, onSaved }) {
  const [slug, setSlug]       = useState(config?.organization_slug || '')
  const [secret, setSecret]   = useState(config?.secret_key_masked || '')
  const [iban, setIban]       = useState(config?.iban || '')
  const [autoSync, setAutoSync] = useState(config?.auto_sync_enabled || false)
  const [accounts, setAccounts] = useState([])
  const [saving, setSaving]   = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError]     = useState(null)
  const [success, setSuccess] = useState(null)

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true); setError(null); setSuccess(null)
    try {
      await api.saveQontoConfig({ organization_slug: slug, secret_key: secret, iban, auto_sync_enabled: autoSync })
      setSuccess('Configuration enregistrée.')
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleFetchAccounts() {
    setTesting(true); setError(null)
    try {
      const data = await api.getQontoAccounts()
      setAccounts(data.accounts || [])
      if (data.accounts?.length === 0) setError('Aucun compte trouvé.')
    } catch (err) {
      setError(err.message)
    } finally {
      setTesting(false)
    }
  }

  return (
    <form className={styles.section} onSubmit={handleSave}>
      <h2 className={styles.sectionTitle}>Identifiants API Qonto</h2>
      <p className={styles.sectionDesc}>
        Trouvez ces informations dans votre espace Qonto → Paramètres → Intégrations → API.
      </p>

      <div className={styles.formGrid}>
        <div className={styles.field}>
          <label className={styles.label}>Organization slug</label>
          <input
            className={styles.input}
            type="text"
            value={slug}
            onChange={e => setSlug(e.target.value)}
            placeholder="mon-entreprise-abc123"
            required
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Clé secrète (secret key)</label>
          <input
            className={styles.input}
            type="password"
            value={secret}
            onChange={e => setSecret(e.target.value)}
            placeholder="••••••••••••••••"
            required
          />
        </div>
      </div>

      <div className={styles.accountRow}>
        <div className={styles.field} style={{ flex: 1 }}>
          <label className={styles.label}>IBAN du compte à synchroniser</label>
          {accounts.length > 0 ? (
            <select className={styles.select} value={iban} onChange={e => setIban(e.target.value)}>
              <option value="">— Sélectionner un compte —</option>
              {accounts.map(a => (
                <option key={a.iban} value={a.iban}>
                  {a.name} — {a.iban} ({formatEur(a.balance)})
                </option>
              ))}
            </select>
          ) : (
            <input
              className={styles.input}
              type="text"
              value={iban}
              onChange={e => setIban(e.target.value)}
              placeholder="FR76 XXXX XXXX XXXX XXXX XXXX XXX"
            />
          )}
        </div>
        <button
          type="button"
          className={styles.btnSecondary}
          onClick={handleFetchAccounts}
          disabled={testing || !slug || !secret}
        >
          {testing ? 'Connexion…' : 'Récupérer les comptes'}
        </button>
      </div>

      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={autoSync}
          onChange={e => setAutoSync(e.target.checked)}
        />
        <span>Synchronisation automatique quotidienne (une fois par jour)</span>
      </label>

      {error   && <div className={styles.error}>⚠️ {error}</div>}
      {success && <div className={styles.successMsg}>✓ {success}</div>}

      <div className={styles.formActions}>
        <button className={styles.btnPrimary} type="submit" disabled={saving}>
          {saving ? 'Enregistrement…' : 'Enregistrer la configuration'}
        </button>
      </div>
    </form>
  )
}

// ── Tab: Mapping ──────────────────────────────────────────────────────────────

function MappingTab() {
  const [mappings, setMappings]     = useState([])
  const [pcgProduits, setPcgProduits] = useState([])
  const [pcgCharges, setPcgCharges]   = useState([])
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState(null)
  const [success, setSuccess]       = useState(null)
  const [loading, setLoading]       = useState(true)

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
          <span className={`${styles.sideBadge} ${m.side === 'credit' ? styles.sideCredit : styles.sideDebit}`}>
            {m.side === 'credit' ? 'Crédit ↑' : 'Débit ↓'}
          </span>
        </td>
        <td className={styles.opType}>{OP_TYPE_LABELS[m.qonto_operation_type] || m.qonto_operation_type}</td>
        <td>
          <select
            className={styles.selectSm}
            value={m.pcg_category}
            onChange={e => updateMapping(m.id, 'pcg_category', e.target.value)}
          >
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </td>
        <td>
          <select
            className={styles.selectXs}
            value={m.default_taux_tva}
            onChange={e => updateMapping(m.id, 'default_taux_tva', Number(e.target.value))}
          >
            {TAUX_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </td>
      </tr>
    )
  }

  if (loading) return <div className={styles.loading}><div className={styles.spinner} /></div>

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Correspondances Qonto → PCG</h2>
      <p className={styles.sectionDesc}>
        Associez chaque type d'opération Qonto à un compte PCG et un taux TVA par défaut.
        Les transactions importées utilisent ces règles — vous pouvez les modifier ensuite dans Transactions.
      </p>

      {error   && <div className={styles.error}>⚠️ {error}</div>}
      {success && <div className={styles.successMsg}>✓ {success}</div>}

      <div className={styles.tableWrapper}>
        <table className={styles.mappingTable}>
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
              <tr className={styles.mappingDivider}><td colSpan={4} /></tr>
            )}
            {debits.map(m => <MappingRow key={m.id} m={m} />)}
          </tbody>
        </table>
      </div>

      <div className={styles.formActions}>
        <button className={styles.btnPrimary} onClick={handleSave} disabled={saving || mappings.length === 0}>
          {saving ? 'Enregistrement…' : 'Enregistrer les mappings'}
        </button>
      </div>
    </div>
  )
}

// ── Tab: Synchronisation ──────────────────────────────────────────────────────

function SyncTab({ config, onSynced }) {
  const [syncing, setSyncing]     = useState(false)
  const [result, setResult]       = useState(null)
  const [logs, setLogs]           = useState([])
  const [error, setError]         = useState(null)
  const [resetting, setResetting] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(null)

  const loadLog = useCallback(() => {
    api.getQontoSyncLog()
      .then(d => setLogs(d.logs || []))
      .catch(() => {})
  }, [])

  useEffect(() => { loadLog() }, [loadLog])

  async function handleSync() {
    setSyncing(true); setError(null); setResult(null); setResetSuccess(null)
    try {
      const res = await api.runQontoSync()
      setResult(res)
      loadLog()
      onSynced()
    } catch (err) {
      setError(err.message)
    } finally {
      setSyncing(false)
    }
  }

  async function handleReset() {
    setResetting(true); setError(null); setResult(null); setResetSuccess(null)
    try {
      await api.resetQontoData()
      setResetSuccess('Toutes les transactions ont été supprimées. Vous pouvez relancer un sync.')
      loadLog()
      onSynced()
    } catch (err) {
      setError(err.message)
    } finally {
      setResetting(false)
      setConfirmReset(false)
    }
  }

  const isConfigured = config?.configured && config?.iban

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Synchronisation</h2>

      <div className={styles.syncStatusRow}>
        <div className={styles.syncStatus}>
          <span className={styles.syncStatusLabel}>Dernier sync :</span>
          <span className={styles.syncStatusValue}>
            {config?.last_sync_at
              ? new Date(config.last_sync_at).toLocaleString('fr-FR')
              : 'Jamais synchronisé'}
          </span>
        </div>
        <div className={styles.syncStatus}>
          <span className={styles.syncStatusLabel}>Auto-sync :</span>
          <span className={`${styles.syncStatusValue} ${config?.auto_sync_enabled ? styles.autoOn : styles.autoOff}`}>
            {config?.auto_sync_enabled ? 'Activé (quotidien)' : 'Désactivé'}
          </span>
        </div>
        {config?.iban && (
          <div className={styles.syncStatus}>
            <span className={styles.syncStatusLabel}>IBAN :</span>
            <span className={styles.syncStatusValue}>{config.iban}</span>
          </div>
        )}
      </div>

      {!isConfigured && (
        <div className={styles.warnBox}>
          ⚠️ Configurez vos identifiants Qonto et sélectionnez un IBAN dans l'onglet Configuration avant de synchroniser.
        </div>
      )}

      {error        && <div className={styles.error}>⚠️ {error}</div>}
      {resetSuccess && <div className={styles.successMsg}>✓ {resetSuccess}</div>}

      {result && (
        <div className={styles.resultBox}>
          <div className={styles.resultGrid}>
            <div className={styles.resultItem}>
              <span className={styles.resultNum}>{result.fetched}</span>
              <span className={styles.resultLabel}>Récupérées</span>
            </div>
            <div className={styles.resultItem}>
              <span className={`${styles.resultNum} ${styles.numGreen}`}>{result.imported}</span>
              <span className={styles.resultLabel}>Importées</span>
            </div>
            <div className={styles.resultItem}>
              <span className={styles.resultNum}>{result.skipped}</span>
              <span className={styles.resultLabel}>Déjà présentes</span>
            </div>
          </div>
          {result.errors?.length > 0 && (
            <div className={styles.syncErrors}>
              <strong>Erreurs :</strong>
              {result.errors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}
        </div>
      )}

      <div className={styles.syncActions}>
        <button
          className={styles.btnPrimary}
          onClick={handleSync}
          disabled={syncing || resetting || !isConfigured}
        >
          {syncing ? 'Synchronisation en cours…' : '↻ Synchroniser maintenant'}
        </button>

        {!confirmReset ? (
          <button
            className={styles.btnReset}
            onClick={() => setConfirmReset(true)}
            disabled={syncing || resetting}
          >
            🗑️ Réinitialiser les données
          </button>
        ) : (
          <div className={styles.resetConfirm}>
            <span className={styles.resetConfirmText}>
              Supprimer toutes les transactions et l'historique sync ?
            </span>
            <button
              className={styles.btnResetConfirm}
              onClick={handleReset}
              disabled={resetting}
            >
              {resetting ? 'Suppression…' : 'Confirmer'}
            </button>
            <button
              className={styles.btnResetCancel}
              onClick={() => setConfirmReset(false)}
              disabled={resetting}
            >
              Annuler
            </button>
          </div>
        )}
      </div>

      {logs.length > 0 && (
        <div className={styles.logSection}>
          <h3 className={styles.logTitle}>Historique des synchronisations</h3>
          <table className={styles.logTable}>
            <thead>
              <tr>
                <th>Date</th>
                <th className={styles.right}>Récupérées</th>
                <th className={styles.right}>Importées</th>
                <th className={styles.right}>Ignorées</th>
                <th>Erreurs</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td>{new Date(log.synced_at).toLocaleString('fr-FR')}</td>
                  <td className={styles.right}>{log.fetched}</td>
                  <td className={`${styles.right} ${log.imported > 0 ? styles.numGreen : ''}`}>{log.imported}</td>
                  <td className={styles.right}>{log.skipped}</td>
                  <td className={log.errors ? styles.errCell : ''}>
                    {log.errors ? '⚠️ ' + log.errors.split('\n')[0] : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Qonto() {
  const [activeTab, setActiveTab] = useState('config')
  const [config, setConfig]       = useState(null)

  const loadConfig = useCallback(() => {
    api.getQontoConfig().then(setConfig).catch(() => {})
  }, [])

  useEffect(() => { loadConfig() }, [loadConfig])

  const tabs = [
    { id: 'config', label: 'Configuration' },
    { id: 'mapping', label: 'Mapping catégories' },
    { id: 'sync', label: 'Synchronisation' },
  ]

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>
            <span className={styles.qontoLogo}>Q</span>
            Qonto
          </h1>
          <p className={styles.pageSubtitle}>
            Synchronisation des transactions bancaires vers les comptes PCG
          </p>
        </div>
        {config?.configured && (
          <span className={styles.connectedBadge}>✓ Connecté</span>
        )}
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

      {activeTab === 'config'  && <ConfigTab config={config} onSaved={loadConfig} />}
      {activeTab === 'mapping' && <MappingTab />}
      {activeTab === 'sync'    && <SyncTab config={config} onSynced={loadConfig} />}
    </div>
  )
}
