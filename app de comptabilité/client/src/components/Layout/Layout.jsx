import { NavLink } from 'react-router-dom'
import styles from './Layout.module.css'

const navItems = [
  { to: '/', label: 'Tableau de bord', icon: '🏠', end: true },
  { to: '/transactions', label: 'Transactions', icon: '💳' },
  { to: '/tva', label: 'TVA', icon: '📊' },
  { to: '/exercice', label: 'Comptes annuels', icon: '📈' },
]

export default function Layout({ children }) {
  return (
    <div className={styles.wrapper}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandIcon}>📒</span>
          <span className={styles.brandName}>Comptabilité</span>
        </div>
        <nav className={styles.nav}>
          {navItems.map(({ to, label, icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
              }
            >
              <span className={styles.navIcon}>{icon}</span>
              <span className={styles.navLabel}>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className={styles.sidebarFooter}>
          <NavLink
            to="/integrations"
            className={({ isActive }) =>
              `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
            }
          >
            <span className={styles.navIcon}>🔌</span>
            <span className={styles.navLabel}>Connexions API</span>
          </NavLink>
          <span className={styles.footerText}>v1.0.0</span>
        </div>
      </aside>
      <main className={styles.main}>
        <div className={styles.content}>
          {children}
        </div>
      </main>
    </div>
  )
}
