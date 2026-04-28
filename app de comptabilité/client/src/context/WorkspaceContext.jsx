import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api.js'
import { useAuth } from './AuthContext.jsx'

const WorkspaceContext = createContext(null)

export function WorkspaceProvider({ children }) {
  const { token } = useAuth()
  const [profile, setProfile] = useState({ activite_type: null, structure_type: null })

  const refreshProfile = useCallback(() => {
    if (!token) return
    api.getWorkspace()
      .then(data => setProfile({
        activite_type:  data.activite_type  || null,
        structure_type: data.structure_type || null,
      }))
      .catch(() => {})
  }, [token])

  useEffect(() => { refreshProfile() }, [refreshProfile])

  return (
    <WorkspaceContext.Provider value={{ profile, refreshProfile }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  return useContext(WorkspaceContext)
}
