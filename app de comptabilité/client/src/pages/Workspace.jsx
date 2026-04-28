import { useState, useEffect, useCallback } from 'react'
import { api, formatDate } from '../lib/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useWorkspace } from '../context/WorkspaceContext.jsx'
import Modal from '../components/Modal/Modal.jsx'
import styles from './Workspace.module.css'

const ACTIVITE_OPTIONS = [
  { value: '',            label: '— Non renseigné —' },
  { value: 'saas',        label: 'SaaS / Logiciel' },
  { value: 'conseil',     label: 'Conseil' },
  { value: 'evenementiel',label: 'Événementiel' },
  { value: 'commerce',    label: 'Commerce / Retail' },
  { value: 'formation',   label: 'Formation' },
  { value: 'immobilier',  label: 'Immobilier' },
  { value: 'autre',       label: 'Autre' },
]

const STRUCTURE_OPTIONS = [
  { value: '',      label: '— Non renseigné —' },
  { value: 'micro', label: 'Micro-entreprise / Auto-entrepreneur' },
  { value: 'ei',    label: 'Entreprise individuelle (EI / EIRL)' },
  { value: 'eurl',  label: 'EURL' },
  { value: 'sarl',  label: 'SARL' },
  { value: 'sas',   label: 'SAS / SASU' },
  { value: 'sa',    label: 'SA' },
  { value: 'autre', label: 'Autre' },
]

function ActivityProfileSection({ workspace, onSaved }) {
  const { refreshProfile } = useWorkspace()
  const [activite,  setActivite]  = useState(workspace.activite_type  || '')
  const [structure, setStructure] = useState(workspace.structure_type || '')
  const [saving,    setSaving]    = useState(false)
  const [success,   setSuccess]   = useState(null)
  const [error,     setError]     = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setSuccess(null)
    setError(null)
    try {
      await api.updateWorkspaceProfile({
        activite_type:  activite  || null,
        structure_type: structure || null,
      })
      setSuccess('Profil enregistré.')
      refreshProfile()
      if (onSaved) onSaved({ activite_type: activite || null, structure_type: structure || null })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const unchanged = activite === (workspace.activite_type || '') && structure === (workspace.structure_type || '')

  return (
    <div className={styles.card} aria-labelledby="activity-title">
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle} id="activity-title">Profil d&apos;activité</h2>
        <p className={styles.cardSubtitle}>Adapte les catégories comptables à votre secteur.</p>
      </div>
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="activite-type">Type d&apos;activité</label>
          <select
            id="activite-type"
            className={styles.select}
            value={activite}
            onChange={e => { setActivite(e.target.value); setSuccess(null) }}
          >
            {ACTIVITE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="structure-type">Type de structure</label>
          <select
            id="structure-type"
            className={styles.select}
            value={structure}
            onChange={e => { setStructure(e.target.value); setSuccess(null) }}
          >
            {STRUCTURE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <button className={styles.btn} type="submit" disabled={saving || unchanged}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
        {success && <p className={styles.success} role="status">{success}</p>}
        {error   && <p className={styles.error}   role="alert">{error}</p>}
      </form>
    </div>
  )
}

// ── Section : Informations ────────────────────────────────────────────────────

function WorkspaceInfoSection({ workspace, onRenamed }) {
  const { login } = useAuth()
  const [name,    setName]    = useState(workspace.name)
  const [saving,  setSaving]  = useState(false)
  const [success, setSuccess] = useState(null)
  const [error,   setError]   = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setSuccess(false)
    setError(null)
    try {
      const result = await api.renameWorkspace(name)
      login(result.token)
      setSuccess('Nom mis à jour.')
      onRenamed(result.name)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.card} aria-labelledby="info-title">
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle} id="info-title">Informations</h2>
        <p className={styles.cardSubtitle}>Identifiant et nom de votre espace de travail.</p>
      </div>
      <div className={styles.infoRow}>
        <span className={styles.infoLabel}>Slug</span>
        <span className={styles.infoValue}>{workspace.slug}</span>
      </div>
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="workspace-name">Nom du workspace</label>
          <div className={styles.inputRow}>
            <input
              id="workspace-name"
              className={styles.input}
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setSuccess(false) }}
              required
              minLength={2}
            />
            <button
              className={styles.btn}
              type="submit"
              disabled={saving || name === workspace.name}
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
        {success && <p className={styles.success} role="status">{success}</p>}
        {error   && <p className={styles.error} role="alert">{error}</p>}
      </form>
    </div>
  )
}

// ── Section : Membres ─────────────────────────────────────────────────────────

function MembersSection({ users, currentUserId, onRemoved }) {
  const [removingId, setRemovingId] = useState(null)
  const [confirmId,  setConfirmId]  = useState(null)
  const [error,      setError]      = useState(null)

  async function handleRemove(id) {
    setRemovingId(id)
    setError(null)
    try {
      await api.removeWorkspaceUser(id)
      onRemoved()
    } catch (err) {
      setError(err.message)
    } finally {
      setRemovingId(null)
      setConfirmId(null)
    }
  }

  return (
    <section className={styles.section} aria-labelledby="members-title">
      <h2 className={styles.sectionTitle} id="members-title">Membres</h2>
      <div className={styles.card}>
        {error && <p className={styles.error}>{error}</p>}
        {users.length === 0 ? (
          <p className={styles.empty}>Aucun membre dans ce workspace.</p>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Rôle</th>
                  <th>Dernière connexion</th>
                  <th>Membre depuis</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className={styles.memberRow}>
                    <td>{u.email}</td>
                    <td>
                      <span className={`${styles.badge} ${u.role === 'admin' ? styles.badgeAdmin : styles.badgeUser}`}>
                        {u.role}
                      </span>
                    </td>
                    <td>{u.last_login_at ? formatDate(u.last_login_at) : '—'}</td>
                    <td>{formatDate(u.created_at)}</td>
                    <td>
                      <button
                        className={styles.btnDangerSmall}
                        onClick={() => setConfirmId(u.id)}
                        disabled={u.id === currentUserId || removingId === u.id}
                        aria-label={`Supprimer ${u.email}`}
                      >
                        {removingId === u.id ? '…' : 'Supprimer'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {confirmId && (
        <Modal title="Supprimer ce membre ?" onClose={() => setConfirmId(null)} size="small">
          <div className={styles.confirmBody}>
            <p>Supprimer ce membre du workspace ? Cette action est irréversible.</p>
            <div className={styles.confirmActions}>
              <button className={styles.btn} onClick={() => setConfirmId(null)}>Annuler</button>
              <button className={styles.btnDangerSmall} onClick={() => handleRemove(confirmId)} disabled={!!removingId}>
                {removingId ? '…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  )
}

// ── Formulaire d'invitation (utilisé dans les modales) ────────────────────────

function InviteForm({ onInvited }) {
  const [email,     setEmail]     = useState('')
  const [sending,   setSending]   = useState(false)
  const [inviteUrl, setInviteUrl] = useState(null)
  const [copied,    setCopied]    = useState(false)
  const [error,     setError]     = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setSending(true)
    setError(null)
    setInviteUrl(null)
    setCopied(false)
    try {
      const data = await api.createInvitation(email)
      setInviteUrl(data.inviteUrl)
      setEmail('')
      if (onInvited) onInvited()
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className={styles.card}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="invite-email">Adresse email</label>
          <div className={styles.inputRow}>
            <input
              id="invite-email"
              className={styles.input}
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setInviteUrl(null) }}
              placeholder="collaborateur@exemple.com"
              required
              autoComplete="off"
            />
            <button className={styles.btn} type="submit" disabled={sending}>
              {sending ? 'Génération…' : 'Générer un lien'}
            </button>
          </div>
        </div>
        {error && <p className={styles.error} role="alert">{error}</p>}
      </form>

      {inviteUrl && (
        <div className={styles.field} style={{ marginTop: '12px' }}>
          <label className={styles.label}>Lien d&apos;invitation</label>
          <div className={styles.inputRow}>
            <input
              className={styles.input}
              type="text"
              value={inviteUrl}
              readOnly
              aria-label="Lien d'invitation généré"
            />
            <button className={styles.btn} type="button" onClick={handleCopy}>
              {copied ? 'Copié !' : 'Copier'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Onglet Membres ────────────────────────────────────────────────────────────

function MembersTab({ users, currentUserId, onRemoved, onInvited }) {
  const [showInviteModal, setShowInviteModal] = useState(false)

  function handleInvited() {
    setShowInviteModal(false)
    if (onInvited) onInvited()
  }

  return (
    <>
      <div className={styles.membersHeader}>
        <h2 className={styles.membersHeaderTitle}>Membres</h2>
        <button
          className={styles.btn}
          type="button"
          onClick={() => setShowInviteModal(true)}
        >
          Ajouter un membre
        </button>
      </div>

      <MembersSection
        users={users}
        currentUserId={currentUserId}
        onRemoved={onRemoved}
      />

      {showInviteModal && (
        <Modal
          title="Inviter un membre"
          onClose={() => setShowInviteModal(false)}
          size="medium"
        >
          <InviteForm onInvited={handleInvited} />
        </Modal>
      )}
    </>
  )
}

// ── Onglet Invitations ────────────────────────────────────────────────────────

function InvitationsTab() {
  const [invitations,  setInvitations]  = useState([])
  const [loading,      setLoading]      = useState(true)
  const [cancellingId, setCancellingId] = useState(null)
  const [error,        setError]        = useState(null)
  const [showModal,    setShowModal]    = useState(false)

  const loadInvitations = useCallback(() => {
    setError(null)
    api.getInvitations()
      .then(data => setInvitations(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadInvitations() }, [loadInvitations])

  async function handleCancel(id) {
    setCancellingId(id)
    setError(null)
    try {
      await api.cancelInvitation(id)
      loadInvitations()
    } catch (err) {
      setError(err.message)
    } finally {
      setCancellingId(null)
    }
  }

  function handleInvited() {
    setShowModal(false)
    loadInvitations()
  }

  return (
    <>
      <div className={styles.membersHeader}>
        <h2 className={styles.membersHeaderTitle}>Invitations</h2>
        <button
          className={styles.btn}
          type="button"
          onClick={() => setShowModal(true)}
        >
          Générer un lien
        </button>
      </div>

      {error && <p className={styles.error} role="alert">{error}</p>}

      <div className={styles.card}>
        {loading ? (
          <p className={styles.empty}>Chargement…</p>
        ) : invitations.length === 0 ? (
          <p className={styles.empty}>Aucune invitation pour ce workspace.</p>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Statut</th>
                  <th>Expiration</th>
                  <th>Envoyée le</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {invitations.map(inv => (
                  <tr key={inv.id} className={styles.memberRow}>
                    <td>{inv.email}</td>
                    <td>
                      {inv.used_at
                        ? <span className={`${styles.badge} ${styles.badgeUser}`}>Acceptée</span>
                        : new Date(inv.expires_at) < new Date()
                          ? <span className={`${styles.badge} ${styles.badgeExpired}`}>Expirée</span>
                          : <span className={`${styles.badge} ${styles.badgeAdmin}`}>En attente</span>
                      }
                    </td>
                    <td>{formatDate(inv.expires_at)}</td>
                    <td>{formatDate(inv.created_at)}</td>
                    <td>
                      {!inv.used_at && new Date(inv.expires_at) >= new Date() && (
                        <button
                          className={styles.btnDangerSmall}
                          type="button"
                          onClick={() => handleCancel(inv.id)}
                          disabled={cancellingId === inv.id}
                          aria-label={`Annuler l'invitation pour ${inv.email}`}
                        >
                          {cancellingId === inv.id ? '…' : 'Annuler'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <Modal
          title="Générer un lien d'invitation"
          onClose={() => setShowModal(false)}
          size="medium"
        >
          <InviteForm onInvited={handleInvited} />
        </Modal>
      )}
    </>
  )
}

// ── Section : Zone de danger ──────────────────────────────────────────────────

function DangerZoneSection() {
  const { logout } = useAuth()
  const [showModal, setShowModal] = useState(false)
  const [deleting,  setDeleting]  = useState(false)
  const [error,     setError]     = useState(null)

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    try {
      await api.deleteWorkspace()
      logout()
    } catch (err) {
      setError(err.message)
      setDeleting(false)
    }
  }

  return (
    <section className={styles.dangerSection} aria-labelledby="danger-title">
      <div className={`${styles.card} ${styles.dangerZone}`}>
      <div className={styles.cardHeader}>
        <h2 className={`${styles.cardTitle} ${styles.cardTitleDanger}`} id="danger-title">Zone de danger</h2>
      </div>
        <div className={styles.dangerRow}>
          <div>
            <p className={styles.dangerLabel}>Supprimer le workspace</p>
            <p className={styles.dangerDesc}>
              Cette action supprimera définitivement toutes les données : factures, dépenses, transactions et membres. Elle est irréversible.
            </p>
          </div>
          <button
            className={styles.btnDanger}
            onClick={() => setShowModal(true)}
            type="button"
          >
            Supprimer le workspace
          </button>
        </div>
      </div>

      {showModal && (
        <Modal
          title="Supprimer le workspace"
          onClose={() => { if (!deleting) setShowModal(false) }}
          size="small"
        >
          <div className={styles.modalBody}>
            <p className={styles.modalWarning}>
              Cette action est <strong>irréversible</strong>. Toutes les données du workspace — factures, dépenses, transactions, membres — seront définitivement supprimées.
            </p>
            <p className={styles.modalQuestion}>Êtes-vous certain de vouloir supprimer ce workspace ?</p>
            {error && <p className={styles.error}>{error}</p>}
            <div className={styles.modalActions}>
              <button
                className={styles.btnDanger}
                onClick={handleDelete}
                disabled={deleting}
                type="button"
              >
                {deleting ? 'Suppression…' : 'Oui, supprimer définitivement'}
              </button>
              <button
                className={styles.btnGhost}
                onClick={() => setShowModal(false)}
                disabled={deleting}
                type="button"
              >
                Annuler
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────

const TABS = [
  { id: 'general',     label: 'Général'     },
  { id: 'members',     label: 'Membres'     },
  { id: 'invitations', label: 'Invitations' },
]

export default function Workspace() {
  const { user } = useAuth()
  const [workspace, setWorkspace] = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [activeTab, setActiveTab] = useState('general')

  const loadWorkspace = useCallback(() => {
    setError(null)
    api.getWorkspace()
      .then(data => setWorkspace(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadWorkspace() }, [loadWorkspace])

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingState}>Chargement…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.page}>
        <p className={styles.error}>{error}</p>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Workspace</h1>
        <p className={styles.pageSubtitle}>Gérez les paramètres et les membres de votre espace de travail.</p>
      </div>

      <div className={styles.tabs}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={styles.tabContent}>
        {activeTab === 'general' && (
          <>
            <div className={styles.generalGrid}>
              <WorkspaceInfoSection
                workspace={workspace}
                onRenamed={newName => setWorkspace(prev => ({ ...prev, name: newName }))}
              />
              <ActivityProfileSection
                workspace={workspace}
                onSaved={fields => setWorkspace(prev => ({ ...prev, ...fields }))}
              />
            </div>
            <DangerZoneSection />
          </>
        )}
        {activeTab === 'members' && (
          <MembersTab
            users={workspace.users || []}
            currentUserId={user?.userId}
            onRemoved={loadWorkspace}
            onInvited={loadWorkspace}
          />
        )}
        {activeTab === 'invitations' && (
          <InvitationsTab />
        )}
      </div>
    </div>
  )
}
