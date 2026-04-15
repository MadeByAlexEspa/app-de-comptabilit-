import { useState, useEffect, useRef } from 'react'
import { api } from '../../lib/api.js'
import styles from './AIChatPanel.module.css'

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`${styles.bubble} ${isUser ? styles.bubbleUser : styles.bubbleAI}`}>
      {!isUser && <div className={styles.bubbleLabel}>Agent comptable</div>}
      <div className={styles.bubbleText}>
        {msg.content.split('\n').map((line, i, arr) => (
          <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
        ))}
      </div>
    </div>
  )
}

const SUGGESTIONS = [
  'Quel est mon résultat net ?',
  'Quelle TVA dois-je reverser ?',
  'Quels sont mes principaux postes de dépenses ?',
]

export default function AIChatPanel({ open, onClose }) {
  const [messages,   setMessages]   = useState([])
  const [input,      setInput]      = useState('')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState(null)
  const [configured, setConfigured] = useState(null)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  useEffect(() => {
    if (!open) return
    api.getAIConfig()
      .then(d => setConfigured(d.configured))
      .catch(() => setConfigured(false))
  }, [open])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150)
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setError(null)
    const newMessages = [...messages, { role: 'user', content: text }]
    setMessages(newMessages)
    setLoading(true)
    try {
      const { reply } = await api.aiChat(newMessages.map(m => ({ role: m.role, content: m.content })))
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function useSuggestion(s) {
    setInput(s)
    inputRef.current?.focus()
  }

  if (!open) return null

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerIcon}>✦</span>
          <span className={styles.headerTitle}>ComptIA</span>
        </div>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Fermer">×</button>
      </div>

      <div className={styles.body}>
        {configured === false ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>🔑</div>
            <p className={styles.emptyTitle}>Agent non configuré</p>
            <p className={styles.emptyText}>
              Ajoutez votre clé API dans{' '}
              <a href="/integrations" className={styles.emptyLink}>Connexions API → IA</a>
              {' '}pour démarrer.
            </p>
          </div>
        ) : messages.length === 0 && !loading ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>💬</div>
            <p className={styles.emptyTitle}>Posez une question comptable</p>
            <div className={styles.suggestions}>
              {SUGGESTIONS.map(s => (
                <button key={s} className={styles.suggestion} onClick={() => useSuggestion(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className={styles.messages}>
            {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
            {loading && (
              <div className={`${styles.bubble} ${styles.bubbleAI}`}>
                <div className={styles.bubbleLabel}>Agent comptable</div>
                <div className={styles.typing}>
                  <span /><span /><span />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {error && <div className={styles.errorBar}>⚠️ {error}</div>}

      <div className={styles.inputArea}>
        <textarea
          ref={inputRef}
          className={styles.input}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Posez une question… (Entrée pour envoyer)"
          rows={2}
          disabled={loading || configured === false}
        />
        <button
          className={styles.sendBtn}
          onClick={handleSend}
          disabled={!input.trim() || loading || configured === false}
          aria-label="Envoyer"
        >
          ↑
        </button>
      </div>
    </div>
  )
}
