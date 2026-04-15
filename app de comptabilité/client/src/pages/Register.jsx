import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../lib/api.js'
import styles from './Register.module.css'

export default function Register() {
  const { login } = useAuth()
  const navigate  = useNavigate()
  const [companyName, setCompanyName] = useState('')
  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [confirm,     setConfirm]     = useState('')
  const [error,       setError]       = useState(null)
  const [loading,     setLoading]     = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas'); return }
    setLoading(true); setError(null)
    try {
      const { token } = await api.authRegister({ companyName, email, password })
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
          <span className={styles.logoIcon}>📒</span>
          <span className={styles.logoName}>Comptabilité</span>
        </div>
        <h1 className={styles.title}>Créer un espace de travail</h1>
        <p className={styles.subtitle}>Votre entreprise, vos données, isolées et sécurisées</p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label htmlFor="register-company" className={styles.label}>{"Nom de l'entreprise"}</label>
            <input
              id="register-company"
              className={styles.input}
              type="text"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              required
              autoFocus
              placeholder="Acme SAS"
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="register-email" className={styles.label}>Email</label>
            <input
              id="register-email"
              className={styles.input}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="vous@entreprise.com"
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="register-password" className={styles.label}>Mot de passe</label>
            <input
              id="register-password"
              className={styles.input}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="6 caractères minimum"
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="register-confirm" className={styles.label}>Confirmer le mot de passe</label>
            <input
              id="register-confirm"
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
            {loading ? 'Création…' : 'Créer mon espace de travail'}
          </button>
        </form>

        <p className={styles.footer}>
          Déjà un compte ?{' '}
          <Link to="/login" className={styles.link}>Se connecter</Link>
        </p>
      </div>
    </div>
  )
}
