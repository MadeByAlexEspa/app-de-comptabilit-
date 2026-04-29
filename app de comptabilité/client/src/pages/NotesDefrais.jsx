import { useState, useEffect, useRef, useCallback } from 'react'
import { Camera, Upload, Trash2, CheckCircle, XCircle, Clock, Loader2, ReceiptText } from 'lucide-react'
import { api, uploadExpenseNote, formatDate, formatEur } from '../lib/api.js'
import styles from './NotesDefrais.module.css'

const STATUS_LABEL = {
  pending:  'En attente',
  sending:  'Envoi…',
  sent:     'Envoyé',
  error:    'Erreur',
}

const STATUS_ICON = {
  pending: <Clock size={14} />,
  sending: <Loader2 size={14} className={styles.spin} />,
  sent:    <CheckCircle size={14} />,
  error:   <XCircle size={14} />,
}

export default function NotesDefrais() {
  const [notes, setNotes]         = useState([])
  const [accounts, setAccounts]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [formOpen, setFormOpen]   = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]         = useState(null)

  const [file, setFile]           = useState(null)
  const [preview, setPreview]     = useState(null)
  const [description, setDescription] = useState('')
  const [montant, setMontant]     = useState('')
  const [accountId, setAccountId] = useState('')

  const fileInputRef = useRef(null)

  const load = useCallback(async () => {
    try {
      const [notesData, accountsData] = await Promise.all([
        api.getExpenseNotes(),
        api.getQontoConfigs(),
      ])
      setNotes(notesData.notes ?? [])
      setAccounts(accountsData.accounts ?? [])
      if (accountsData.accounts?.length === 1) {
        setAccountId(String(accountsData.accounts[0].id))
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function handleFileChange(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    if (f.type.startsWith('image/')) {
      setPreview(prev => {
        if (prev) URL.revokeObjectURL(prev)
        return URL.createObjectURL(f)
      })
    } else {
      setPreview(prev => { if (prev) URL.revokeObjectURL(prev); return null })
    }
  }

  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview) }
  }, [preview])

  function resetForm() {
    setFile(null)
    setPreview(null)
    setDescription('')
    setMontant('')
    if (accounts.length !== 1) setAccountId('')
    setFormOpen(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!file) return

    setSubmitting(true)
    setError(null)

    const formData = new FormData()
    formData.append('file', file)
    if (description) formData.append('description', description)
    if (montant)     formData.append('montant_ttc', montant)
    if (accountId)   formData.append('account_id', accountId)

    try {
      await uploadExpenseNote(formData)
      resetForm()
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id) {
    try {
      await api.deleteExpenseNote(id)
      setNotes(prev => prev.filter(n => n.id !== id))
    } catch (e) {
      setError(e.message)
    }
  }

  const pending = notes.filter(n => n.status !== 'sent')
  const sent    = notes.filter(n => n.status === 'sent')

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Notes de frais</h1>
          <p className={styles.pageSubtitle}>
            Photographiez vos justificatifs et envoyez-les directement vers Qonto
          </p>
        </div>
        <button className={styles.addBtn} onClick={() => setFormOpen(v => !v)}>
          <Camera size={16} />
          Ajouter une note
        </button>
      </div>

      {error && (
        <div className={styles.errorBanner}>
          <XCircle size={15} /> {error}
          <button onClick={() => setError(null)} className={styles.errorClose}>×</button>
        </div>
      )}

      {formOpen && (
        <div className={styles.formCard}>
          <h2 className={styles.formTitle}>Nouvelle note de frais</h2>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.uploadZone} onClick={() => fileInputRef.current?.click()}>
              {preview ? (
                <img src={preview} alt="Aperçu" className={styles.preview} />
              ) : (
                <div className={styles.uploadPlaceholder}>
                  <Upload size={32} className={styles.uploadIcon} />
                  <span>Appuyer pour prendre une photo ou choisir un fichier</span>
                  <span className={styles.uploadHint}>JPEG, PNG, HEIC, PDF — max 10 Mo</span>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                capture="environment"
                onChange={handleFileChange}
                className={styles.fileInput}
              />
            </div>

            {file && (
              <div className={styles.fileName}>
                <ReceiptText size={14} />
                <span>{file.name}</span>
                <button
                  type="button"
                  className={styles.removeFile}
                  onClick={() => { setFile(null); setPreview(prev => { if (prev) URL.revokeObjectURL(prev); return null }); if (fileInputRef.current) fileInputRef.current.value = '' }}
                >
                  ×
                </button>
              </div>
            )}

            <div className={styles.fields}>
              <div className={styles.field}>
                <label className={styles.label}>Description</label>
                <input
                  className={styles.input}
                  type="text"
                  placeholder="ex. Taxi client, Repas équipe…"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Montant TTC (€)</label>
                <input
                  className={styles.input}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={montant}
                  onChange={e => setMontant(e.target.value)}
                />
              </div>

              {accounts.length > 1 && (
                <div className={styles.field}>
                  <label className={styles.label}>Compte Qonto</label>
                  <select
                    className={styles.input}
                    value={accountId}
                    onChange={e => setAccountId(e.target.value)}
                  >
                    <option value="">— Compte par défaut —</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className={styles.formActions}>
              <button type="button" className={styles.cancelBtn} onClick={resetForm}>
                Annuler
              </button>
              <button
                type="submit"
                className={styles.submitBtn}
                disabled={!file || submitting}
              >
                {submitting
                  ? <><Loader2 size={15} className={styles.spin} /> Envoi en cours…</>
                  : <><Upload size={15} /> Envoyer vers Qonto</>
                }
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className={styles.loadingRow}>
          <Loader2 size={20} className={styles.spin} /> Chargement…
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <section>
              <h2 className={styles.sectionTitle}>En cours ({pending.length})</h2>
              <div className={styles.notesList}>
                {pending.map(note => (
                  <NoteRow key={note.id} note={note} onDelete={handleDelete} />
                ))}
              </div>
            </section>
          )}

          {sent.length > 0 && (
            <section>
              <h2 className={styles.sectionTitle}>Envoyés ({sent.length})</h2>
              <div className={styles.notesList}>
                {sent.map(note => (
                  <NoteRow key={note.id} note={note} onDelete={handleDelete} />
                ))}
              </div>
            </section>
          )}

          {notes.length === 0 && (
            <div className={styles.empty}>
              <Camera size={40} className={styles.emptyIcon} />
              <p>Aucune note de frais pour le moment.</p>
              <p className={styles.emptyHint}>Cliquez sur « Ajouter une note » pour commencer.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function NoteRow({ note, onDelete }) {
  return (
    <div className={`${styles.noteRow} ${styles[`status_${note.status}`]}`}>
      <div className={styles.noteInfo}>
        <span className={`${styles.statusBadge} ${styles[`badge_${note.status}`]}`}>
          {STATUS_ICON[note.status]}
          {STATUS_LABEL[note.status] ?? note.status}
        </span>
        <span className={styles.noteFile}>{note.original_name}</span>
        {note.description && <span className={styles.noteDesc}>{note.description}</span>}
      </div>
      <div className={styles.noteMeta}>
        {note.montant_ttc != null && (
          <span className={styles.noteMontant}>{formatEur(note.montant_ttc)}</span>
        )}
        {note.account_name && (
          <span className={styles.noteAccount}>{note.account_name}</span>
        )}
        <span className={styles.noteDate}>{formatDate(note.sent_at || note.created_at)}</span>
        {note.error_message && (
          <span className={styles.noteError} title={note.error_message}>
            <XCircle size={12} /> {note.error_message}
          </span>
        )}
        {note.qonto_attachment_id && (
          <span className={styles.noteAttachId} title={note.qonto_attachment_id}>
            ID: {note.qonto_attachment_id.slice(0, 8)}…
          </span>
        )}
      </div>
      <button
        className={styles.deleteBtn}
        onClick={() => onDelete(note.id)}
        title="Supprimer de la liste"
      >
        <Trash2 size={15} />
      </button>
    </div>
  )
}
