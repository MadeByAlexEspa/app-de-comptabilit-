import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import * as api from '../lib/api.js'
import styles from './Admin.module.css'

function relativeTime(dateStr) {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr + 'Z').getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "À l'instant"
  if (m < 60) return `il y a ${m}min`
  const h = Math.floor(m / 60)
  if (h < 24) return `il y a ${h}h`
  const d = Math.floor(h / 24)
  return `il y a ${d}j`
}

export default function Admin() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('overview')

  const [analytics, setAnalytics] = useState(null)
  const [workspaces, setWorkspaces] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  // Workspace modal
  const [showNewWs, setShowNewWs] = useState(false)
  const [wsForm, setWsForm] = useState({ name: '', email: '', password: '' })
  const [wsError, setWsError] = useState(null)
  const [wsLoading, setWsLoading] = useState(false)

  // User create modal
  const [showNewUser, setShowNewUser] = useState(false)
  const [newUserForm, setNewUserForm] = useState({ workspace_id: '', email: '', password: '', role: 'owner' })
  const [newUserError, setNewUserError] = useState(null)
  const [newUserLoading, setNewUserLoading] = useState(false)

  // User edit modal
  const [editUser, setEditUser] = useState(null)
  const [editForm, setEditForm] = useState({ email: '', role: 'owner', password: '' })
  const [editError, setEditError] = useState(null)
  const [editLoading, setEditLoading] = useState(false)

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    setLoadError(null)
    try {
      const [analyticsData, workspacesData, usersData] = await Promise.all([
        api.getAdminAnalytics(),
        api.getAdminWorkspaces(),
        api.getAdminUsers(),
      ])
      setAnalytics(analyticsData)
      setWorkspaces(workspacesData)
      setUsers(usersData)
    } catch (err) {
      setLoadError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Workspace handlers ────────────────────────────────────────────────────
  async function handleCreateWorkspace(e) {
    e.preventDefault()
    setWsError(null)
    setWsLoading(true)
    try {
      await api.createAdminWorkspace(wsForm)
      setShowNewWs(false)
      setWsForm({ name: '', email: '', password: '' })
      await loadAll()
    } catch (err) {
      setWsError(err.message)
    } finally {
      setWsLoading(false)
    }
  }

  async function handleDeleteWorkspace(ws) {
    if (!window.confirm('Supprimer ce workspace et tous ses utilisateurs ?')) return
    try {
      await api.deleteAdminWorkspace(ws.id)
      await loadAll()
    } catch (err) {
      alert(err.message)
    }
  }

  // ── User handlers ─────────────────────────────────────────────────────────
  async function handleCreateUser(e) {
    e.preventDefault()
    setNewUserError(null)
    setNewUserLoading(true)
    try {
      await api.createAdminUser(newUserForm)
      setShowNewUser(false)
      setNewUserForm({ workspace_id: '', email: '', password: '', role: 'owner' })
      await loadAll()
    } catch (err) {
      setNewUserError(err.message)
    } finally {
      setNewUserLoading(false)
    }
  }

  function openEditUser(u) {
    setEditUser(u)
    setEditForm({ email: u.email, role: u.role, password: '' })
    setEditError(null)
  }

  async function handleEditUser(e) {
    e.preventDefault()
    setEditError(null)
    setEditLoading(true)
    try {
      const payload = { email: editForm.email, role: editForm.role }
      if (editForm.password) payload.password = editForm.password
      await api.updateAdminUser(editUser.id, payload)
      setEditUser(null)
      await loadAll()
    } catch (err) {
      setEditError(err.message)
    } finally {
      setEditLoading(false)
    }
  }

  async function handleDeleteUser(u) {
    if (!window.confirm(`Supprimer l'utilisateur ${u.email} ?`)) return
    try {
      await api.deleteAdminUser(u.id)
      await loadAll()
    } catch (err) {
      alert(err.message)
    }
  }

  // ── Sorted users for overview ─────────────────────────────────────────────
  const recentUsers = [...users].sort((a, b) => {
    if (!a.last_login_at && !b.last_login_at) return 0
    if (!a.last_login_at) return 1
    if (!b.last_login_at) return -1
    return new Date(b.last_login_at) - new Date(a.last_login_at)
  })

  // ── Loading / error states ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={styles.page}>
        <p className={styles.loadingText}>Chargement…</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className={styles.page}>
        <div className={styles.error}>Erreur : {loadError}</div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      {/* ── Page header ── */}
      <div className={styles.header}>
        <h1 className={styles.headerTitle}>Administration</h1>
        <button
          className={styles.btnGhost}
          onClick={() => { localStorage.removeItem('admin_token'); navigate('/admin/login') }}
        >
          ↩ Déconnexion
        </button>
      </div>

      {/* ── Tabs ── */}
      <div className={styles.tabs} role="tablist">
        {[
          { id: 'overview', label: 'Aperçu' },
          { id: 'workspaces', label: 'Workspaces' },
          { id: 'users', label: 'Utilisateurs' },
        ].map(({ id, label }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            className={`${styles.tab} ${tab === id ? styles.tabActive : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          ONGLET APERÇU
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'overview' && (
        <>
          <div className={styles.kpiGrid}>
            <div className={styles.kpiCard}>
              <p className={styles.kpiValue}>{analytics?.total_workspaces ?? 0}</p>
              <p className={styles.kpiLabel}>Workspaces</p>
            </div>
            <div className={styles.kpiCard}>
              <p className={styles.kpiValue}>{analytics?.total_users ?? 0}</p>
              <p className={styles.kpiLabel}>Utilisateurs</p>
            </div>
            <div className={styles.kpiCard}>
              <p className={styles.kpiValue}>{analytics?.active_users_30d ?? 0}</p>
              <p className={styles.kpiLabel}>Actifs 30j</p>
            </div>
            <div className={styles.kpiCard}>
              <p className={styles.kpiValue}>{analytics?.new_workspaces_30d ?? 0}</p>
              <p className={styles.kpiLabel}>Nouveaux 30j</p>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Activité récente</h2>
            </div>
            {recentUsers.length === 0 ? (
              <p className={styles.emptyState}>Aucun utilisateur.</p>
            ) : (
              <table className={styles.table} aria-label="Activité récente des utilisateurs">
                <thead>
                  <tr>
                    <th className={styles.th}>Email</th>
                    <th className={styles.th}>Workspace</th>
                    <th className={styles.th}>Rôle</th>
                    <th className={styles.th}>Dernière connexion</th>
                  </tr>
                </thead>
                <tbody>
                  {recentUsers.map((u) => (
                    <tr key={u.id} className={styles.tr}>
                      <td className={styles.td}>{u.email}</td>
                      <td className={styles.td}>{u.workspace_name ?? '—'}</td>
                      <td className={styles.td}>
                        <span
                          className={`${styles.badge} ${
                            u.role === 'superadmin' ? styles.badgeSuperadmin : styles.badgeOwner
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className={styles.td}>
                        <span className={styles.relativeTime}>
                          {relativeTime(u.last_login_at)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ONGLET WORKSPACES
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'workspaces' && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Workspaces</h2>
            <button
              className={styles.btnPrimary}
              onClick={() => { setShowNewWs(true); setWsError(null) }}
            >
              + Nouveau workspace
            </button>
          </div>
          {workspaces.length === 0 ? (
            <p className={styles.emptyState}>Aucun workspace.</p>
          ) : (
            <table className={styles.table} aria-label="Liste des workspaces">
              <thead>
                <tr>
                  <th className={styles.th}>Nom</th>
                  <th className={styles.th}>Slug</th>
                  <th className={styles.th}>Nb utilisateurs</th>
                  <th className={styles.th}>Créé le</th>
                  <th className={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {workspaces.map((ws) => (
                  <tr key={ws.id} className={styles.tr}>
                    <td className={styles.td}>{ws.name}</td>
                    <td className={styles.td}>{ws.slug}</td>
                    <td className={styles.td}>{ws.users?.length ?? 0}</td>
                    <td className={styles.td}>{api.formatDate(ws.created_at)}</td>
                    <td className={styles.td}>
                      <div className={styles.actions}>
                        <button
                          className={styles.btnDanger}
                          disabled={ws.id === 1}
                          title={ws.id === 1 ? 'Workspace protégé' : undefined}
                          onClick={() => handleDeleteWorkspace(ws)}
                        >
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ONGLET UTILISATEURS
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'users' && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Utilisateurs</h2>
            <button
              className={styles.btnPrimary}
              onClick={() => { setShowNewUser(true); setNewUserError(null) }}
            >
              + Nouvel utilisateur
            </button>
          </div>
          {users.length === 0 ? (
            <p className={styles.emptyState}>Aucun utilisateur.</p>
          ) : (
            <table className={styles.table} aria-label="Liste des utilisateurs">
              <thead>
                <tr>
                  <th className={styles.th}>Email</th>
                  <th className={styles.th}>Workspace</th>
                  <th className={styles.th}>Rôle</th>
                  <th className={styles.th}>Dernière connexion</th>
                  <th className={styles.th}>Créé le</th>
                  <th className={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className={styles.tr}>
                    <td className={styles.td}>{u.email}</td>
                    <td className={styles.td}>{u.workspace_name ?? '—'}</td>
                    <td className={styles.td}>
                      <span
                        className={`${styles.badge} ${
                          u.role === 'superadmin' ? styles.badgeSuperadmin : styles.badgeOwner
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className={styles.td}>
                      <span className={styles.relativeTime}>
                        {relativeTime(u.last_login_at)}
                      </span>
                    </td>
                    <td className={styles.td}>{api.formatDate(u.created_at)}</td>
                    <td className={styles.td}>
                      <div className={styles.actions}>
                        <button
                          className={styles.btnGhost}
                          onClick={() => openEditUser(u)}
                        >
                          Modifier
                        </button>
                        <button
                          className={styles.btnDanger}
                          onClick={() => handleDeleteUser(u)}
                        >
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL — Nouveau workspace
      ══════════════════════════════════════════════════════════════════════ */}
      {showNewWs && (
        <div
          className={styles.overlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-new-ws-title"
          onClick={(e) => { if (e.target === e.currentTarget) setShowNewWs(false) }}
        >
          <form className={styles.modal} onSubmit={handleCreateWorkspace}>
            <h2 id="modal-new-ws-title" className={styles.modalTitle}>Nouveau workspace</h2>

            {wsError && <div className={styles.error} role="alert">{wsError}</div>}

            <div className={styles.field}>
              <label htmlFor="ws-name" className={styles.label}>Nom entreprise</label>
              <input
                id="ws-name"
                className={styles.input}
                type="text"
                required
                value={wsForm.name}
                onChange={(e) => setWsForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="ws-email" className={styles.label}>Email owner</label>
              <input
                id="ws-email"
                className={styles.input}
                type="email"
                required
                value={wsForm.email}
                onChange={(e) => setWsForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="ws-password" className={styles.label}>Mot de passe</label>
              <input
                id="ws-password"
                className={styles.input}
                type="password"
                required
                value={wsForm.password}
                onChange={(e) => setWsForm((f) => ({ ...f, password: e.target.value }))}
              />
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() => setShowNewWs(false)}
              >
                Annuler
              </button>
              <button type="submit" className={styles.btnPrimary} disabled={wsLoading}>
                {wsLoading ? 'Création…' : 'Créer'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL — Nouvel utilisateur
      ══════════════════════════════════════════════════════════════════════ */}
      {showNewUser && (
        <div
          className={styles.overlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-new-user-title"
          onClick={(e) => { if (e.target === e.currentTarget) setShowNewUser(false) }}
        >
          <form className={styles.modal} onSubmit={handleCreateUser}>
            <h2 id="modal-new-user-title" className={styles.modalTitle}>Nouvel utilisateur</h2>

            {newUserError && <div className={styles.error} role="alert">{newUserError}</div>}

            <div className={styles.field}>
              <label htmlFor="nu-workspace" className={styles.label}>Workspace</label>
              <select
                id="nu-workspace"
                className={styles.select}
                required
                value={newUserForm.workspace_id}
                onChange={(e) => setNewUserForm((f) => ({ ...f, workspace_id: e.target.value }))}
              >
                <option value="">— Sélectionner —</option>
                {workspaces.map((ws) => (
                  <option key={ws.id} value={ws.id}>{ws.name}</option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label htmlFor="nu-email" className={styles.label}>Email</label>
              <input
                id="nu-email"
                className={styles.input}
                type="email"
                required
                value={newUserForm.email}
                onChange={(e) => setNewUserForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="nu-password" className={styles.label}>Mot de passe</label>
              <input
                id="nu-password"
                className={styles.input}
                type="password"
                required
                value={newUserForm.password}
                onChange={(e) => setNewUserForm((f) => ({ ...f, password: e.target.value }))}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="nu-role" className={styles.label}>Rôle</label>
              <select
                id="nu-role"
                className={styles.select}
                value={newUserForm.role}
                onChange={(e) => setNewUserForm((f) => ({ ...f, role: e.target.value }))}
              >
                <option value="owner">owner</option>
                <option value="superadmin">superadmin</option>
              </select>
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() => setShowNewUser(false)}
              >
                Annuler
              </button>
              <button type="submit" className={styles.btnPrimary} disabled={newUserLoading}>
                {newUserLoading ? 'Création…' : 'Créer'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL — Modifier utilisateur
      ══════════════════════════════════════════════════════════════════════ */}
      {editUser && (
        <div
          className={styles.overlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-edit-user-title"
          onClick={(e) => { if (e.target === e.currentTarget) setEditUser(null) }}
        >
          <form className={styles.modal} onSubmit={handleEditUser}>
            <h2 id="modal-edit-user-title" className={styles.modalTitle}>Modifier l'utilisateur</h2>

            {editError && <div className={styles.error} role="alert">{editError}</div>}

            <div className={styles.field}>
              <label htmlFor="eu-email" className={styles.label}>Email</label>
              <input
                id="eu-email"
                className={styles.input}
                type="email"
                required
                value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="eu-role" className={styles.label}>Rôle</label>
              <select
                id="eu-role"
                className={styles.select}
                value={editForm.role}
                onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
              >
                <option value="owner">owner</option>
                <option value="superadmin">superadmin</option>
              </select>
            </div>

            <div className={styles.field}>
              <label htmlFor="eu-password" className={styles.label}>Nouveau mot de passe</label>
              <input
                id="eu-password"
                className={styles.input}
                type="password"
                placeholder="Laisser vide pour ne pas changer"
                value={editForm.password}
                onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
              />
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() => setEditUser(null)}
              >
                Annuler
              </button>
              <button type="submit" className={styles.btnPrimary} disabled={editLoading}>
                {editLoading ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
