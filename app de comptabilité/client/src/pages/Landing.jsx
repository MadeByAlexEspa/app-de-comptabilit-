import { Link } from 'react-router-dom'
import styles from './Landing.module.css'

export default function Landing() {
  return (
    <div className={styles.root}>
      {/* ── Nav ── */}
      <header className={styles.nav}>
        <div className={styles.navInner}>
          <span className={styles.navLogo}>✎ Comptabilité</span>
          <nav className={styles.navLinks}>
            <Link to="/login" className={styles.navLogin}>Se connecter</Link>
            <Link to="/register" className={styles.navCta}>Commencer</Link>
          </nav>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroContent}>
            <div className={styles.heroLabel}>[ Pour les indépendants &amp; TPE ]</div>
            <h1 className={styles.heroHeadline}>
              La comptabilité<br />sans les complications.
            </h1>
            <p className={styles.heroSub}>
              Factures, dépenses, TVA, bilan annuel — tout ce qu'il vous faut si vous n'êtes pas
              obligé de passer par un expert-comptable.
            </p>
            <Link to="/register" className={styles.heroCta}>Essayer gratuitement →</Link>
            <p className={styles.heroPrice}>3 € / mois — sans engagement</p>
          </div>

          <div className={styles.ledgerArt} aria-hidden="true">
            <div className={styles.ledgerHeader}>GRAND LIVRE</div>
            <div className={styles.ledgerRow}>
              <span>Factures</span><span>12 450,00 €</span>
            </div>
            <div className={styles.ledgerRow}>
              <span>Dépenses</span><span>─ 4 230,00 €</span>
            </div>
            <div className={styles.ledgerDivider} />
            <div className={styles.ledgerTotal}>
              <span>Résultat</span><span>8 220,00 €</span>
            </div>
            <div className={styles.ledgerRow} style={{ opacity: 0.35 }}>
              <span>TVA due</span><span>1 230,00 €</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pour qui ── */}
      <section className={styles.audience}>
        <div className={styles.sectionInner}>
          <p className={styles.sectionLabel}>─── POUR QUI ───</p>
          <div className={styles.cards}>
            <div className={styles.card}>
              <span className={styles.cardIndex}>[ 01 ]</span>
              <h3 className={styles.cardTitle}>Micro-entrepreneur</h3>
              <p className={styles.cardSub}>AE / Auto-entrepreneur</p>
              <p className={styles.cardDesc}>
                Déclaration mensuelle ou trimestrielle, pas d'obligation de bilan.
              </p>
            </div>
            <div className={styles.card}>
              <span className={styles.cardIndex}>[ 02 ]</span>
              <h3 className={styles.cardTitle}>Entreprise Individuelle</h3>
              <p className={styles.cardSub}>EI / EIRL</p>
              <p className={styles.cardDesc}>
                Comptabilité de trésorerie simplifiée, régime micro ou réel simplifié.
              </p>
            </div>
            <div className={styles.card}>
              <span className={styles.cardIndex}>[ 03 ]</span>
              <h3 className={styles.cardTitle}>Petite société</h3>
              <p className={styles.cardSub}>SASU / EURL (micro)</p>
              <p className={styles.cardDesc}>
                Vous gérez vous-même votre compta jusqu'au seuil imposant un CAC.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className={styles.features}>
        <div className={styles.sectionInner}>
          <h2 className={styles.featuresTitle}>Ce que vous obtenez</h2>
          <div className={styles.featureGrid}>
            <div className={styles.feature}>
              <div className={styles.featureInner}>
                <p className={styles.featureName}><span className={styles.featurePrefix}>→</span> Factures &amp; devis</p>
                <p className={styles.featureDesc}>Créez et envoyez vos factures numérotées automatiquement.</p>
              </div>
            </div>
            <div className={styles.feature}>
              <div className={styles.featureInner}>
                <p className={styles.featureName}><span className={styles.featurePrefix}>→</span> Suivi des dépenses</p>
                <p className={styles.featureDesc}>Catégorisez chaque sortie selon le Plan Comptable Général.</p>
              </div>
            </div>
            <div className={styles.feature}>
              <div className={styles.featureInner}>
                <p className={styles.featureName}><span className={styles.featurePrefix}>→</span> Déclaration TVA</p>
                <p className={styles.featureDesc}>Votre CA3 précalculée, mois par mois ou sur une plage libre.</p>
              </div>
            </div>
            <div className={styles.feature}>
              <div className={styles.featureInner}>
                <p className={styles.featureName}><span className={styles.featurePrefix}>→</span> Bilan annuel</p>
                <p className={styles.featureDesc}>Actif, passif, compte de résultat conformes ANC 2025.</p>
              </div>
            </div>
            <div className={styles.feature}>
              <div className={styles.featureInner}>
                <p className={styles.featureName}><span className={styles.featurePrefix}>→</span> Agent IA</p>
                <p className={styles.featureDesc}>Posez vos questions comptables en langage naturel.</p>
              </div>
            </div>
            <div className={styles.feature}>
              <div className={styles.featureInner}>
                <p className={styles.featureName}><span className={styles.featurePrefix}>→</span> Connexion Qonto</p>
                <p className={styles.featureDesc}>Importez vos transactions bancaires en un clic.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className={styles.pricing}>
        <div className={styles.sectionInner}>
          <p className={styles.sectionLabel}>─── TARIF ───</p>
          <div className={styles.pricingCard}>
            <p className={styles.pricingPlan}>FORMULE UNIQUE</p>
            <div className={styles.pricingAmount}>
              <span className={styles.pricingNumber}>3 €</span>
              <span className={styles.pricingPer}>/mois</span>
            </div>
            <div className={styles.pricingDivider} />
            <ul className={styles.pricingList}>
              <li><span className={styles.check}>✓</span> Accès à toutes les fonctionnalités</li>
              <li><span className={styles.check}>✓</span> Historique illimité</li>
              <li><span className={styles.check}>✓</span> Agent comptable IA inclus</li>
              <li><span className={styles.check}>✓</span> Mises à jour incluses</li>
              <li><span className={styles.check}>✓</span> Sans engagement, résiliable à tout moment</li>
            </ul>
            <Link to="/register" className={styles.heroCta}>Commencer maintenant →</Link>
            <p className={styles.pricingNote}><em>Moins qu'un café par mois.</em></p>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span className={styles.footerLogo}>✎ Comptabilité</span>
          <p className={styles.footerTagline}>
            Fait pour les indépendants français. Pas pour les grandes entreprises.
          </p>
          <nav className={styles.footerLinks}>
            <Link to="/login" className={styles.footerLink}>Connexion</Link>
            <Link to="/register" className={styles.footerLink}>Inscription</Link>
          </nav>
        </div>
        <div className={styles.footerBottom}>
          © 2025 — 3 € / mois — TVA non applicable
        </div>
      </footer>
    </div>
  )
}
