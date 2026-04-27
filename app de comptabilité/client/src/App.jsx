import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import Layout from './components/Layout/Layout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Transactions from './pages/Transactions.jsx'
import TVA from './pages/TVA.jsx'
import Exercice from './pages/Exercice.jsx'
import Integrations from './pages/Integrations.jsx'
import Workspace from './pages/Workspace.jsx'
import NotesDefrais from './pages/NotesDefrais.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Admin from './pages/Admin.jsx'
import AdminLogin from './pages/AdminLogin.jsx'
import InviteAccept from './pages/InviteAccept.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import ResetPassword from './pages/ResetPassword.jsx'
import Landing from './pages/Landing.jsx'
import CGU from './pages/CGU.jsx'
import MentionsLegales from './pages/MentionsLegales.jsx'
import PolitiqueConfidentialite from './pages/PolitiqueConfidentialite.jsx'

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
      <Route path="/landing"        element={<Landing />} />
      <Route path="/login"          element={<Login />} />
      <Route path="/register"       element={<Register />} />
      <Route path="/invite/:token"         element={<InviteAccept />} />
      <Route path="/mot-de-passe-oublie"   element={<ForgotPassword />} />
      <Route path="/reset-password"        element={<ResetPassword />} />
      <Route path="/cgu"                        element={<CGU />} />
      <Route path="/mentions-legales"           element={<MentionsLegales />} />
      <Route path="/politique-confidentialite"  element={<PolitiqueConfidentialite />} />

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
              <Route path="/notes-de-frais" element={<NotesDefrais />} />
              <Route path="/integrations" element={<Integrations />} />
              <Route path="/workspace"    element={<Workspace />} />
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
