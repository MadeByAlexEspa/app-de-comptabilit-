import { useState, useCallback } from 'react'
import { api } from '../lib/api.js'

export function useFactures() {
  const [factures, setFactures] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchFactures = useCallback(async (mois) => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getFactures(mois)
      setFactures(data)
    } catch (e) {
      setError(e?.message || 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }, [])

  const createFacture = useCallback(async (data) => {
    const created = await api.createFacture(data)
    setFactures(prev => [created, ...prev])
    return created
  }, [])

  const updateFacture = useCallback(async (id, data) => {
    const updated = await api.updateFacture(id, data)
    setFactures(prev => prev.map(f => f.id === id ? updated : f))
    return updated
  }, [])

  const deleteFacture = useCallback(async (id) => {
    await api.deleteFacture(id)
    setFactures(prev => prev.filter(f => f.id !== id))
  }, [])

  return { factures, loading, error, fetchFactures, createFacture, updateFacture, deleteFacture }
}
