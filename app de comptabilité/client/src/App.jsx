import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout/Layout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Transactions from './pages/Transactions.jsx'
import TVA from './pages/TVA.jsx'
import Exercice from './pages/Exercice.jsx'
import Integrations from './pages/Integrations.jsx'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/factures" element={<Navigate to="/transactions" replace />} />
        <Route path="/depenses" element={<Navigate to="/transactions" replace />} />
        <Route path="/tva" element={<TVA />} />
        <Route path="/exercice" element={<Exercice />} />
        <Route path="/pnl" element={<Navigate to="/exercice" replace />} />
        <Route path="/bilan" element={<Navigate to="/exercice" replace />} />
        <Route path="/integrations" element={<Integrations />} />
        <Route path="/qonto" element={<Navigate to="/integrations" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
