import { useState, useCallback } from 'react'
import { api } from '../lib/api.js'

export function useDepenses() {
  const [depenses, setDepenses] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchDepenses = useCallback(async (mois) => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getDepenses(mois)
      setDepenses(data)
    } catch (e) {
      setError(e?.message || 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }, [])

  const createDepense = useCallback(async (data) => {
    const created = await api.createDepense(data)
    setDepenses(prev => [created, ...prev])
    return created
  }, [])

  const updateDepense = useCallback(async (id, data) => {
    const updated = await api.updateDepense(id, data)
    setDepenses(prev => prev.map(d => d.id === id ? updated : d))
    return updated
  }, [])

  const deleteDepense = useCallback(async (id) => {
    await api.deleteDepense(id)
    setDepenses(prev => prev.filter(d => d.id !== id))
  }, [])

  return { depenses, loading, error, fetchDepenses, createDepense, updateDepense, deleteDepense }
}
