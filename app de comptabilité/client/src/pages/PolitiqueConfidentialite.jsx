const LAST_UPDATE = '27 avril 2026'

export default function PolitiqueConfidentialite() {
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px', lineHeight: 1.7, fontFamily: 'inherit' }}>
      <h1>Politique de Confidentialité</h1>
      <p><em>Dernière mise à jour : {LAST_UPDATE}</em></p>

      <h2>1. Responsable du Traitement</h2>
      <p>
        Le responsable du traitement des données personnelles est :<br />
        <strong>[Nom de la société]</strong><br />
        [Adresse]<br />
        Email : [adresse@email.com]
      </p>

      <h2>2. Données Collectées</h2>
      <p>Nous collectons uniquement les données nécessaires au fonctionnement du Service :</p>
      <ul>
        <li><strong>Compte :</strong> adresse email, mot de passe (hashé), nom de l'espace de travail ;</li>
        <li><strong>Données comptables :</strong> transactions, factures, dépenses, données de TVA — saisies directement par l'utilisateur ou importées depuis ses intégrations bancaires (Qonto, Shine) ;</li>
        <li><strong>Données techniques :</strong> journaux d'accès, adresse IP (à des fins de sécurité et de débogage).</li>
      </ul>

      <h2>3. Finalités du Traitement</h2>
      <p>Les données sont traitées pour :</p>
      <ul>
        <li>fournir et améliorer le Service ;</li>
        <li>authentifier les utilisateurs et sécuriser les accès ;</li>
        <li>permettre la synchronisation avec les services bancaires tiers autorisés par l'utilisateur ;</li>
        <li>répondre aux demandes de support.</li>
      </ul>

      <h2>4. Base Légale</h2>
      <p>
        Les traitements reposent sur l'exécution du contrat liant l'utilisateur à l'éditeur
        (article 6.1.b du RGPD) et, le cas échéant, sur le consentement explicite de l'utilisateur.
      </p>

      <h2>5. Conservation des Données</h2>
      <p>
        Les données sont conservées pendant toute la durée d'activité du compte, puis supprimées
        dans un délai de 30 jours suivant la résiliation, sauf obligation légale contraire
        (notamment les obligations comptables et fiscales pouvant imposer une conservation de 10 ans).
      </p>

      <h2>6. Partage des Données</h2>
      <p>
        Nous ne vendons ni ne louons vos données à des tiers. Les données peuvent être transmises
        uniquement à des sous-traitants techniques (hébergement, infrastructure) dans le strict
        cadre de la fourniture du Service, liés par des obligations contractuelles de confidentialité.
      </p>

      <h2>7. Sécurité</h2>
      <p>
        Les données sensibles (identifiants bancaires, clés API) sont chiffrées au repos.
        Les mots de passe sont hashés avec bcrypt. Les communications sont chiffrées via HTTPS.
        L'accès aux données est limité par workspace et protégé par JWT.
      </p>

      <h2>8. Vos Droits (RGPD)</h2>
      <p>Conformément au RGPD, vous disposez des droits suivants :</p>
      <ul>
        <li><strong>Accès :</strong> obtenir une copie de vos données personnelles ;</li>
        <li><strong>Rectification :</strong> corriger des données inexactes ;</li>
        <li><strong>Effacement :</strong> demander la suppression de vos données (« droit à l'oubli ») ;</li>
        <li><strong>Portabilité :</strong> recevoir vos données dans un format structuré ;</li>
        <li><strong>Opposition :</strong> vous opposer à certains traitements.</li>
      </ul>
      <p>
        Pour exercer ces droits, contactez-nous à : <strong>[adresse@email.com]</strong>.
        Vous pouvez également introduire une réclamation auprès de la CNIL (www.cnil.fr).
      </p>

      <h2>9. Cookies</h2>
      <p>
        Le Service n'utilise pas de cookies de traçage ou publicitaires. Seuls des tokens
        d'authentification (stockés en mémoire ou localStorage) sont utilisés pour maintenir
        la session utilisateur.
      </p>

      <h2>10. Modifications</h2>
      <p>
        Cette politique peut être mise à jour. En cas de modification substantielle, les
        utilisateurs en seront informés par email ou notification dans l'application.
      </p>
    </div>
  )
}
