import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminLogin } from '../lib/api.js'
import styles from './Login.module.css'

export default function AdminLogin() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', code: '' })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { token } = await adminLogin(form)
      localStorage.setItem('admin_token', token)
      navigate('/admin')
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
          <span className={styles.logoIcon}>⚙</span>
          <span className={styles.logoName}>Back-office</span>
        </div>

        <div>
          <h1 className={styles.title}>Administration</h1>
          <p className={styles.subtitle}>Accès réservé</p>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="username">Identifiant</label>
            <input
              id="username"
              className={styles.input}
              type="text"
              autoComplete="username"
              required
              value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="code">Code d'accès</label>
            <input
              id="code"
              className={styles.input}
              type="password"
              autoComplete="current-password"
              required
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            />
          </div>

          <button className={styles.btn} type="submit" disabled={loading}>
            {loading ? 'Connexion…' : 'Accéder'}
          </button>
        </form>
      </div>
    </div>
  )
}
