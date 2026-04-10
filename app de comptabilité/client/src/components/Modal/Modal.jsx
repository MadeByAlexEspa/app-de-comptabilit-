import { useEffect } from 'react'
import styles from './Modal.module.css'

export default function Modal({ title, children, onClose, size = 'medium' }) {
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`${styles.modal} ${styles[size]}`} role="dialog" aria-modal="true">
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        <div className={styles.body}>
          {children}
        </div>
      </div>
    </div>
  )
}
