const BASE = '/api'

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  })
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

  // Qonto — legacy / shared
  getQontoConfig:    ()       => request('/qonto/config'),
  saveQontoConfig:   (data)   => request('/qonto/config',   { method: 'POST', body: data }),
  getQontoAccounts:  ()       => request('/qonto/accounts'),
  getQontoMappings:  ()       => request('/qonto/mappings'),
  saveQontoMappings: (data)   => request('/qonto/mappings', { method: 'PUT',  body: data }),
  runQontoSync:      ()       => request('/qonto/sync',     { method: 'POST' }),
  getQontoSyncLog:   ()       => request('/qonto/sync/log'),
  resetQontoData:    ()       => request('/qonto/reset',    { method: 'POST' }),
}

export function formatEur(amount) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount ?? 0)
}

export function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('fr-FR')
}
