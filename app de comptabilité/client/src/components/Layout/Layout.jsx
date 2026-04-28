import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, ArrowLeftRight, Receipt, BookOpen,
  Plug, Settings, LogOut, Sparkles, Menu, X, NotebookPen, Camera
} from 'lucide-react'
import AIChatPanel from '../AIChatPanel/AIChatPanel.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import styles from './Layout.module.css'

const navItems = [
  { to: '/', label: 'Tableau de bord', Icon: LayoutDashboard, end: true },
  { to: '/transactions', label: 'Transactions', Icon: ArrowLeftRight },
  { to: '/tva', label: 'TVA', Icon: Receipt },
  { to: '/exercice', label: 'Comptes annuels', Icon: BookOpen },
  { to: '/notes-de-frais', label: 'Notes de frais', Icon: Camera },
]

export default function Layout({ children }) {
  const [chatOpen,    setChatOpen]    = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user, logout } = useAuth()

  function closeSidebar() { setSidebarOpen(false) }

  return (
    <div className={styles.wrapper}>
      <div className={styles.mobileBar}>
        <button
          className={styles.hamburger}
          onClick={() => setSidebarOpen(v => !v)}
          aria-label={sidebarOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <div className={styles.mobileBrand}>
          <NotebookPen size={18} aria-hidden="true" />
          <span>Compte-Pote</span>
        </div>
      </div>

      {sidebarOpen && (
        <div className={styles.overlay} onClick={closeSidebar} aria-hidden="true" />
      )}

      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.brand}>
          <NotebookPen size={20} className={styles.brandIconSvg} aria-hidden="true" />
          <span className={styles.brandName}>Compte-Pote</span>
        </div>
        {user?.workspaceName && (
          <div className={styles.workspace} title={user.workspaceName}>{user.workspaceName}</div>
        )}
        <nav className={styles.nav}>
          {navItems.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
              }
              onClick={closeSidebar}
            >
              <Icon size={17} className={styles.navIcon} aria-hidden="true" />
              <span className={styles.navLabel}>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className={styles.sidebarFooter}>
          <div className={styles.footerNav}>
            <NavLink
              to="/integrations"
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
              }
              onClick={closeSidebar}
            >
              <Plug size={17} className={styles.navIcon} aria-hidden="true" />
              <span className={styles.navLabel}>Connexions API</span>
            </NavLink>
            <NavLink
              to="/workspace"
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
              }
              onClick={closeSidebar}
            >
              <Settings size={17} className={styles.navIcon} aria-hidden="true" />
              <span className={styles.navLabel}>Workspace</span>
            </NavLink>
          </div>
          <div className={styles.footerActions}>
            <button
              className={`${styles.navItem} ${styles.aiBtn} ${chatOpen ? styles.aiBtnActive : ''}`}
              onClick={() => setChatOpen(v => !v)}
            >
              <Sparkles size={17} className={styles.navIcon} aria-hidden="true" />
              <span className={styles.navLabel}>ComptIA</span>
            </button>
            <button
              className={`${styles.navItem} ${styles.logoutBtn}`}
              onClick={logout}
            >
              <LogOut size={17} className={styles.navIcon} aria-hidden="true" />
              <span className={styles.navLabel}>Déconnexion</span>
            </button>
          </div>
        </div>
      </aside>

      <main className={`${styles.main} ${chatOpen ? styles.mainShifted : ''}`}>
        <div className={styles.content}>
          {children}
        </div>
      </main>

      <AIChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  )
}
