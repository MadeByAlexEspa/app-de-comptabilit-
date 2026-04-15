import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import Layout from './components/Layout/Layout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Transactions from './pages/Transactions.jsx'
import TVA from './pages/TVA.jsx'
import Exercice from './pages/Exercice.jsx'
import Integrations from './pages/Integrations.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'

function PrivateRoute({ children }) {
  const { token } = useAuth()
  if (!token) return <Navigate to="/login" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login"    element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/*" element={
        <PrivateRoute>
          <Layout>
            <Routes>
              <Route path="/"             element={<Dashboard />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/tva"          element={<TVA />} />
              <Route path="/exercice"     element={<Exercice />} />
              <Route path="/integrations" element={<Integrations />} />
              <Route path="*"             element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </PrivateRoute>
      } />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
