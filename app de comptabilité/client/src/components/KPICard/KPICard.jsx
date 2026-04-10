import styles from './KPICard.module.css'

export default function KPICard({ title, value, subtitle, variant = 'default', icon }) {
  return (
    <div className={`${styles.card} ${styles[variant]}`}>
      <div className={styles.header}>
        <span className={styles.title}>{title}</span>
        {icon && <span className={styles.icon}>{icon}</span>}
      </div>
      <div className={styles.value}>{value}</div>
      {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
    </div>
  )
}
