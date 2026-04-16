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
import Admin from './pages/Admin.jsx'
import AdminLogin from './pages/AdminLogin.jsx'

function PrivateRoute({ children }) {
  const { token } = useAuth()
  if (!token) return <Navigate to="/login" replace />
  return children
}

// Vérifie le token admin (admin_token) — indépendant de l'auth utilisateur
function AdminRoute({ children }) {
  const token = localStorage.getItem('admin_token')
  if (!token) return <Navigate to="/admin/login" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      {/* ── Public routes ── */}
      <Route path="/login"       element={<Login />} />
      <Route path="/register"    element={<Register />} />

      {/* ── Back-office admin (hors Layout utilisateur) ── */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin/*"     element={<AdminRoute><Admin /></AdminRoute>} />

      {/* ── App utilisateur ── */}
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
