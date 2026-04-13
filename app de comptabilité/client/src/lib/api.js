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
  getTVA: (mois) => request(`/tva?mois=${mois}`),
  getPnL: (debut, fin) => request(`/pnl?debut=${debut}&fin=${fin}`),
  getBilan: (date) => request(`/bilan?date=${date}`),
  getDashboard: () => request('/dashboard'),

  // Qonto
  getQontoConfig:    ()       => request('/qonto/config'),
  saveQontoConfig:   (data)   => request('/qonto/config',   { method: 'POST', body: data }),
  getQontoAccounts:  ()       => request('/qonto/accounts'),
  getQontoMappings:  ()       => request('/qonto/mappings'),
  saveQontoMappings: (data)   => request('/qonto/mappings', { method: 'PUT',  body: data }),
  runQontoSync:      ()       => request('/qonto/sync',     { method: 'POST' }),
  getQontoSyncLog:   ()       => request('/qonto/sync/log'),
}

export function formatEur(amount) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount ?? 0)
}

export function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('fr-FR')
}
