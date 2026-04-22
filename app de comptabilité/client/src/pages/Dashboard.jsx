import { TrendingUp, TrendingDown, Receipt, BarChart3, FileText } from 'lucide-react'
import { useDashboard } from '../hooks/useDashboard.js'
import KPICard from '../components/KPICard/KPICard.jsx'
import Spinner from '../components/Spinner/Spinner.jsx'
import { formatEur } from '../lib/api.js'
import styles from './Dashboard.module.css'

export default function Dashboard() {
  const { data, loading, error } = useDashboard()

  if (loading) {
    return (
      <div className={styles.loading}>
        <Spinner size={36} />
        <p>Chargement du tableau de bord…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.error}>
        <span>⚠️</span>
        <p>Erreur : {error}</p>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Tableau de bord</h1>
        <p className={styles.pageSubtitle}>Vue d'ensemble de votre activité</p>
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Indicateurs du mois</h2>
        <div className={styles.kpiGrid}>
          <KPICard
            title="CA HT du mois"
            value={formatEur(data?.ca_ht_mois)}
            subtitle="Chiffre d'affaires hors taxes"
            variant="success"
            icon={<TrendingUp size={20} aria-hidden="true" />}
          />
          <KPICard
            title="Charges du mois"
            value={formatEur(data?.charges_ht_mois)}
            subtitle="Dépenses hors taxes"
            variant="danger"
            icon={<TrendingDown size={20} aria-hidden="true" />}
          />
          <KPICard
            title="TVA due ce mois"
            value={formatEur(data?.tva_due_mois)}
            subtitle="À reverser à l'État"
            variant="primary"
            icon={<Receipt size={20} aria-hidden="true" />}
          />
          <KPICard
            title="Résultat YTD"
            value={formatEur(data?.resultat_ytd)}
            subtitle="Depuis le début de l'année"
            variant={data?.resultat_ytd >= 0 ? 'success' : 'danger'}
            icon={<BarChart3 size={20} aria-hidden="true" />}
          />
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>En attente de règlement</h2>
        <div className={styles.pendingGrid}>
          <div className={styles.pendingCard}>
            <div className={styles.pendingIconWrapper} style={{ background: '#eff6ff' }}>
              <FileText size={22} color="#1a56db" aria-hidden="true" />
            </div>
            <div className={styles.pendingInfo}>
              <span className={styles.pendingLabel}>Factures en attente</span>
              <span className={styles.pendingCount} style={{ color: '#1a56db' }}>
                {data?.factures_en_attente ?? 0}
              </span>
            </div>
          </div>
          <div className={styles.pendingCard}>
            <div className={styles.pendingIconWrapper} style={{ background: '#fff7ed' }}>
              <TrendingDown size={22} color="#d97706" aria-hidden="true" />
            </div>
            <div className={styles.pendingInfo}>
              <span className={styles.pendingLabel}>Dépenses en attente</span>
              <span className={styles.pendingCount} style={{ color: '#d97706' }}>
                {data?.depenses_en_attente ?? 0}
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
