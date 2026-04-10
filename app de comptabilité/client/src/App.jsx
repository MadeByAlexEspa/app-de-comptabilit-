import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout/Layout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Factures from './pages/Factures.jsx'
import Depenses from './pages/Depenses.jsx'
import TVA from './pages/TVA.jsx'
import PnL from './pages/PnL.jsx'
import Bilan from './pages/Bilan.jsx'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/factures" element={<Factures />} />
        <Route path="/depenses" element={<Depenses />} />
        <Route path="/tva" element={<TVA />} />
        <Route path="/pnl" element={<PnL />} />
        <Route path="/bilan" element={<Bilan />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
