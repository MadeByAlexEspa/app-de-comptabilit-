import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { resetPassword } from '../lib/api.js'
import styles from './Login.module.css'

export default function ResetPassword() {
  const [params]        = useSearchParams()
  const navigate        = useNavigate()
  const token           = params.get('token') || ''

  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)
  const [done,      setDone]      = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    setLoading(true); setError(null)
    try {
      await resetPassword(token, password)
      setDone(true)
      setTimeout(() => navigate('/login'), 2500)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.logo}><span className={styles.logoName}>✎ Compte-Pote</span></div>
          <h1 className={styles.title}>Lien invalide</h1>
          <p className={styles.subtitle}>Ce lien de réinitialisation est manquant ou corrompu.</p>
          <p className={styles.footer}>
            <Link to="/mot-de-passe-oublie" className={styles.link}>Faire une nouvelle demande</Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <span className={styles.logoName}>✎ Compte-Pote</span>
        </div>

        <h1 className={styles.title}>Nouveau mot de passe</h1>

        {done ? (
          <>
            <div className={styles.successBox}>
              Mot de passe mis à jour. Vous allez être redirigé vers la connexion…
            </div>
          </>
        ) : (
          <>
            <p className={styles.subtitle}>Choisissez un nouveau mot de passe (8 caractères min).</p>
            <form className={styles.form} onSubmit={handleSubmit}>
              <div className={styles.field}>
                <label htmlFor="rp-password" className={styles.label}>Nouveau mot de passe</label>
                <input
                  id="rp-password"
                  className={styles.input}
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoFocus
                  placeholder="••••••••"
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="rp-confirm" className={styles.label}>Confirmer</label>
                <input
                  id="rp-confirm"
                  className={styles.input}
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  placeholder="••••••••"
                />
              </div>

              {error && <div className={styles.error} role="alert">{error}</div>}

              <button className={styles.btn} type="submit" disabled={loading}>
                {loading ? 'Enregistrement…' : 'Changer le mot de passe'}
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
