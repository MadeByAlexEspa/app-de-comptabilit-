import { useState } from 'react'
import { Link } from 'react-router-dom'
import { forgotPassword } from '../lib/api.js'
import styles from './Login.module.css'

export default function ForgotPassword() {
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true); setError(null)
    try {
      await forgotPassword(email)
      setSent(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <span className={styles.logoName}>✎ Compte-Pote</span>
        </div>

        <h1 className={styles.title}>Mot de passe oublié</h1>

        {sent ? (
          <>
            <div className={styles.successBox}>
              Un lien de réinitialisation a été envoyé à <strong>{email}</strong> si cet email
              est associé à un compte. Vérifiez aussi vos spams.
            </div>
            <p className={styles.footer}>
              <Link to="/login" className={styles.link}>← Retour à la connexion</Link>
            </p>
          </>
        ) : (
          <>
            <p className={styles.subtitle}>
              Saisissez votre email — nous vous enverrons un lien valable 1 heure.
            </p>
            <form className={styles.form} onSubmit={handleSubmit}>
              <div className={styles.field}>
                <label htmlFor="fp-email" className={styles.label}>Email</label>
                <input
                  id="fp-email"
                  className={styles.input}
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                  placeholder="vous@entreprise.com"
                />
              </div>

              {error && <div className={styles.error} role="alert">{error}</div>}

              <button className={styles.btn} type="submit" disabled={loading}>
                {loading ? 'Envoi…' : 'Envoyer le lien'}
              </button>
            </form>
            <p className={styles.footer}>
              <Link to="/login" className={styles.link}>← Retour à la connexion</Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
