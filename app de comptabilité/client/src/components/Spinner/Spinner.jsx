import styles from './Spinner.module.css'
export default function Spinner({ size = 32 }) {
  return <div className={styles.spinner} style={{ width: size, height: size }} aria-label="Chargement" role="status" />
}
