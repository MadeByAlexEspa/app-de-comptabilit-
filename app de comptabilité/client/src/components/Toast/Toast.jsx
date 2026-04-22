import { useEffect } from 'react'
import styles from './Toast.module.css'

export default function Toast({ message, type = 'success', onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <div className={`${styles.toast} ${styles[type]}`} role="status" aria-live="polite">
      {message}
    </div>
  )
}
