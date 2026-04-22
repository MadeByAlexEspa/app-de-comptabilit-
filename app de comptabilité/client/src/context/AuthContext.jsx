import { createContext, useContext, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const AuthContext = createContext(null)

function decodeToken(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    if (payload.exp && payload.exp < Date.now() / 1000) return null
    return payload
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('auth_token'))
  const [user, setUser] = useState(() => {
    const t = localStorage.getItem('auth_token')
    return t ? decodeToken(t) : null
  })
  const navigate = useNavigate()

  function login(newToken) {
    localStorage.setItem('auth_token', newToken)
    setToken(newToken)
    setUser(decodeToken(newToken))
  }

  function logout() {
    localStorage.removeItem('auth_token')
    setToken(null)
    setUser(null)
    navigate('/login')
  }

  function updateUser(fields) {
    setUser(prev => prev ? { ...prev, ...fields } : prev)
  }

  return (
    <AuthContext.Provider value={{ token, user, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
