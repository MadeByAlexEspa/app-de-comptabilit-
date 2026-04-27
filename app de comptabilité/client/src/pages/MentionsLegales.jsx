const LAST_UPDATE = '27 avril 2026'

export default function MentionsLegales() {
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px', lineHeight: 1.7, fontFamily: 'inherit' }}>
      <h1>Mentions Légales</h1>
      <p><em>Dernière mise à jour : {LAST_UPDATE}</em></p>

      <h2>Éditeur du Site</h2>
      <p>
        Le présent service est édité par :<br />
        <strong>[Nom de la société]</strong><br />
        [Forme juridique] au capital de [montant] €<br />
        Siège social : [Adresse complète]<br />
        SIRET : [Numéro SIRET]<br />
        Email : [adresse@email.com]
      </p>

      <h2>Directeur de la Publication</h2>
      <p>[Nom du directeur de publication]</p>

      <h2>Hébergement</h2>
      <p>
        Le Service est hébergé par :<br />
        <strong>[Nom de l'hébergeur]</strong><br />
        [Adresse de l'hébergeur]<br />
        [Site web de l'hébergeur]
      </p>

      <h2>Propriété Intellectuelle</h2>
      <p>
        L'ensemble des contenus présents sur ce service (textes, images, interfaces, code source)
        est protégé par le droit d'auteur. Toute reproduction, même partielle, est interdite sans
        autorisation préalable de l'éditeur.
      </p>

      <h2>Limitation de Responsabilité</h2>
      <p>
        L'éditeur ne pourra être tenu responsable des dommages directs ou indirects résultant
        de l'utilisation du Service, d'une indisponibilité temporaire ou d'une perte de données.
        Les informations comptables générées par le Service sont fournies à titre indicatif et
        ne constituent pas un conseil professionnel.
      </p>

      <h2>Liens Hypertextes</h2>
      <p>
        Le Service peut contenir des liens vers des sites tiers. L'éditeur n'est pas responsable
        du contenu de ces sites ni de leur politique de confidentialité.
      </p>

      <h2>Droit Applicable</h2>
      <p>
        Le présent service est soumis au droit français. Tout litige relatif à son utilisation
        sera soumis aux tribunaux compétents du ressort du siège social de l'éditeur.
      </p>
    </div>
  )
}
