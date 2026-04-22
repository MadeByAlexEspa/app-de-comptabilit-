import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../lib/api.js'
import styles from './Login.module.css'

export default function Login() {
  const { login } = useAuth()
  const navigate  = useNavigate()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState(null)
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true); setError(null)
    try {
      const { token } = await api.authLogin({ email, password })
      login(token)
      navigate('/')
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
        <h1 className={styles.title}>Connexion</h1>
        <p className={styles.subtitle}>Accédez à votre espace de travail</p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label htmlFor="login-email" className={styles.label}>Email</label>
            <input
              id="login-email"
              className={styles.input}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              placeholder="vous@entreprise.com"
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="login-password" className={styles.label}>Mot de passe</label>
            <input
              id="login-password"
              className={styles.input}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>

          {error && <div className={styles.error} role="alert">{error}</div>}

          <button className={styles.btn} type="submit" disabled={loading}>
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        <p className={styles.footer}>
          Pas encore de compte ?{' '}
          <Link to="/register" className={styles.link}>Créer un espace de travail</Link>
        </p>

        <div className={styles.demo}>
          <span className={styles.demoLabel}>Compte démo :</span>
          <code>demo@compta.app</code> / <code>demo1234</code>
        </div>
      </div>
    </div>
  )
}
