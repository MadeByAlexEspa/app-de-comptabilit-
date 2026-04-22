import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { checkInviteToken, acceptInvite } from '../lib/api.js'
import styles from './InviteAccept.module.css'

export default function InviteAccept() {
  const { token } = useParams()

  const [status,          setStatus]          = useState('loading') // 'loading' | 'valid' | 'invalid'
  const [invite,          setInvite]          = useState(null)
  const [password,        setPassword]        = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting,      setSubmitting]      = useState(false)
  const [done,            setDone]            = useState(false)
  const [error,           setError]           = useState(null)

  useEffect(() => {
    checkInviteToken(token)
      .then(data => {
        setInvite(data)
        setStatus('valid')
      })
      .catch(() => {
        setStatus('invalid')
      })
  }, [token])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }

    setSubmitting(true)
    try {
      await acceptInvite(token, password)
      setDone(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>📒</span>
          <span className={styles.logoName}>Comptabilité</span>
        </div>

        {status === 'loading' && (
          <div className={styles.loadingState}>Vérification du lien…</div>
        )}

        {status === 'invalid' && (
          <div className={styles.error} role="alert">
            Ce lien d&apos;invitation est invalide, expiré ou déjà utilisé.
          </div>
        )}

        {status === 'valid' && !done && (
          <>
            <h1 className={styles.title}>Rejoindre {invite.workspace_name}</h1>
            <p className={styles.subtitle}>
              Votre compte sera créé pour <strong>{invite.email}</strong>
            </p>

            <form className={styles.form} onSubmit={handleSubmit} noValidate>
              <div className={styles.field}>
                <label htmlFor="invite-password" className={styles.label}>
                  Mot de passe
                </label>
                <input
                  id="invite-password"
                  className={styles.input}
                  type="password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(null) }}
                  required
                  minLength={8}
                  placeholder="••••••••"
                  autoFocus
                  autoComplete="new-password"
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="invite-confirm-password" className={styles.label}>
                  Confirmer le mot de passe
                </label>
                <input
                  id="invite-confirm-password"
                  className={styles.input}
                  type="password"
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); setError(null) }}
                  required
                  minLength={8}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </div>

              {error && (
                <div className={styles.error} role="alert">{error}</div>
              )}

              <button
                className={styles.btn}
                type="submit"
                disabled={submitting}
              >
                {submitting ? 'Création…' : 'Créer mon compte'}
              </button>
            </form>
          </>
        )}

        {status === 'valid' && done && (
          <div>
            <div className={styles.success} role="status">
              Compte créé avec succès !
            </div>
            <p className={styles.footer}>
              <Link to="/login" className={styles.link}>Se connecter</Link>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
