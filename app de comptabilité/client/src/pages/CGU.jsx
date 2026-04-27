const LAST_UPDATE = '27 avril 2026'

export default function CGU() {
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px', lineHeight: 1.7, fontFamily: 'inherit' }}>
      <h1>Conditions Générales d'Utilisation</h1>
      <p><em>Dernière mise à jour : {LAST_UPDATE}</em></p>

      <h2>1. Objet</h2>
      <p>
        Les présentes conditions générales d'utilisation (CGU) régissent l'accès et l'utilisation
        de l'application de comptabilité accessible en ligne (ci-après « le Service »). En accédant
        au Service, vous acceptez sans réserve les présentes CGU.
      </p>

      <h2>2. Accès au Service</h2>
      <p>
        L'accès au Service est réservé aux personnes physiques ou morales disposant d'un compte
        valide. L'utilisateur s'engage à fournir des informations exactes lors de son inscription
        et à maintenir la confidentialité de ses identifiants.
      </p>

      <h2>3. Utilisation du Service</h2>
      <p>L'utilisateur s'engage à :</p>
      <ul>
        <li>utiliser le Service conformément à la législation en vigueur ;</li>
        <li>ne pas tenter d'accéder à des données qui ne lui appartiennent pas ;</li>
        <li>ne pas perturber le bon fonctionnement du Service ;</li>
        <li>ne pas utiliser le Service à des fins illicites ou frauduleuses.</li>
      </ul>

      <h2>4. Responsabilité</h2>
      <p>
        Le Service est fourni « en l'état ». L'éditeur s'efforce d'assurer la disponibilité et
        l'exactitude des informations, mais ne peut garantir l'absence d'interruptions ou d'erreurs.
        L'utilisateur est seul responsable de l'utilisation qu'il fait des données produites par
        le Service, notamment à des fins fiscales ou comptables.
      </p>

      <h2>5. Propriété intellectuelle</h2>
      <p>
        L'ensemble des éléments composant le Service (code, interface, marques, logos) est la
        propriété exclusive de l'éditeur. Toute reproduction ou utilisation non autorisée est
        interdite.
      </p>

      <h2>6. Modification des CGU</h2>
      <p>
        L'éditeur se réserve le droit de modifier les présentes CGU à tout moment. Les utilisateurs
        seront informés de toute modification substantielle. La poursuite de l'utilisation du Service
        vaut acceptation des nouvelles conditions.
      </p>

      <h2>7. Résiliation</h2>
      <p>
        L'utilisateur peut résilier son compte à tout moment depuis les paramètres de l'application.
        L'éditeur se réserve le droit de suspendre ou supprimer tout compte en cas de violation
        des présentes CGU.
      </p>

      <h2>8. Droit applicable</h2>
      <p>
        Les présentes CGU sont soumises au droit français. Tout litige sera soumis à la compétence
        exclusive des tribunaux compétents.
      </p>
    </div>
  )
}
