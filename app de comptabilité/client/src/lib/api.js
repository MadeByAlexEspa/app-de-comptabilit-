const BASE = '/api'

async function request(path, options = {}) {
  const token = localStorage.getItem('auth_token')
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, {
    headers,
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (res.status === 401) {
    localStorage.removeItem('auth_token')
    window.location.href = '/login'
    throw new Error('Session expirée')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  return res.json()
}

export const api = {
  // Factures
  getFactures: (mois) => request(mois ? `/factures?mois=${mois}` : '/factures'),
  createFacture: (data) => request('/factures', { method: 'POST', body: data }),
  updateFacture: (id, data) => request(`/factures/${id}`, { method: 'PUT', body: data }),
  deleteFacture: (id) => request(`/factures/${id}`, { method: 'DELETE' }),

  // Dépenses
  getDepenses: (mois) => request(mois ? `/depenses?mois=${mois}` : '/depenses'),
  createDepense: (data) => request('/depenses', { method: 'POST', body: data }),
  updateDepense: (id, data) => request(`/depenses/${id}`, { method: 'PUT', body: data }),
  deleteDepense: (id) => request(`/depenses/${id}`, { method: 'DELETE' }),

  // Reports
  getTVA: (debut, fin) => request(`/tva?debut=${debut}&fin=${fin}`),
  getPnL: (debut, fin) => request(`/pnl?debut=${debut}&fin=${fin}`),
  getBilan: (fin, debut) => request(`/bilan?fin=${fin}${debut ? `&debut=${debut}` : ''}`),
  getDashboard: () => request('/dashboard'),

  // Drilldown transactions
  getTransactions: (params) => request(`/transactions?${new URLSearchParams(params).toString()}`),

  // Qonto — multi-account CRUD
  getQontoConfigs:        ()        => request('/qonto/configs'),
  createQontoConfig:      (data)    => request('/qonto/configs',                  { method: 'POST',   body: data }),
  updateQontoConfig:      (id, data)=> request(`/qonto/configs/${id}`,            { method: 'PUT',    body: data }),
  deleteQontoConfig:      (id)      => request(`/qonto/configs/${id}`,            { method: 'DELETE' }),
  getQontoBankAccounts:   (id)      => request(`/qonto/configs/${id}/bank-accounts`),
  syncQontoAccount:       (id)      => request(`/qonto/configs/${id}/sync`,       { method: 'POST' }),
  syncAllQonto:           ()        => request('/qonto/sync-all',                 { method: 'POST' }),

  // Shine — multi-account CRUD
  getShineConfigs:        ()         => request('/shine/configs'),
  createShineConfig:      (data)     => request('/shine/configs',                  { method: 'POST',   body: data }),
  updateShineConfig:      (id, data) => request(`/shine/configs/${id}`,            { method: 'PUT',    body: data }),
  deleteShineConfig:      (id)       => request(`/shine/configs/${id}`,            { method: 'DELETE' }),
  getShineBankAccounts:   (id)       => request(`/shine/configs/${id}/bank-accounts`),
  syncShineAccount:       (id)       => request(`/shine/configs/${id}/sync`,       { method: 'POST' }),
  syncAllShine:           ()         => request('/shine/sync-all',                 { method: 'POST' }),
  getShineSyncLog:        ()         => request('/shine/sync/log'),
  resetShineData:         ()         => request('/shine/reset',                    { method: 'POST' }),

  // Qonto — sync log & reset (utilisés dans Integrations)
  getQontoSyncLog:   ()       => request('/qonto/sync/log'),
  resetQontoData:    ()       => request('/qonto/reset',    { method: 'POST' }),

  // IA
  getAIConfig:    ()         => request('/ai/config'),
  saveAIConfig:   (data)     => request('/ai/config', { method: 'POST',   body: data }),
  deleteAIConfig: ()         => request('/ai/config', { method: 'DELETE' }),
  aiChat:         (messages) => request('/ai/chat',   { method: 'POST',   body: { messages } }),

  // Auth
  authRegister: (data) => request('/auth/register', { method: 'POST', body: data }),
  authLogin:    (data) => request('/auth/login',    { method: 'POST', body: data }),
  authMe:       ()     => request('/auth/me'),
}

export function formatEur(amount) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount ?? 0)
}

export function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('fr-FR')
}

// ── Admin back-office (token séparé : admin_token) ────────────────────────────

async function adminRequest(path, options = {}) {
  const token = localStorage.getItem('admin_token')
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, {
    headers,
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (res.status === 401) {
    localStorage.removeItem('admin_token')
    window.location.href = '/admin/login'
    throw new Error('Session admin expirée')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  return res.json()
}

export const adminLogin           = (data)      => adminRequest('/admin/auth/login',  { method: 'POST', body: data })
export const getAdminAnalytics    = ()          => adminRequest('/admin/analytics')
export const getAdminWorkspaces   = ()          => adminRequest('/admin/workspaces')
export const getAdminUsers        = ()          => adminRequest('/admin/users')
export const createAdminUser      = (data)      => adminRequest('/admin/users',           { method: 'POST',   body: data })
export const updateAdminUser      = (id, data)  => adminRequest(`/admin/users/${id}`,     { method: 'PUT',    body: data })
export const deleteAdminUser      = (id)        => adminRequest(`/admin/users/${id}`,     { method: 'DELETE' })
export const createAdminWorkspace = (data)      => adminRequest('/admin/workspaces',      { method: 'POST',   body: data })
export const deleteAdminWorkspace = (id)        => adminRequest(`/admin/workspaces/${id}`,{ method: 'DELETE' })
