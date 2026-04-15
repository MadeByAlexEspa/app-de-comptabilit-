import { useState, useEffect } from 'react'
import { api } from '../lib/api.js'

export function useDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    api.getDashboard()
      .then(d => { if (!cancelled) { setData(d); setLoading(false) } })
      .catch(e => { if (!cancelled) { setError(e?.message || 'Erreur inconnue'); setLoading(false) } })
    return () => { cancelled = true }
  }, [])

  return { data, loading, error }
}
