export default function HomePage() {
  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">WTDGC 2026 · Vilnius</p>
        <h1>WTDGC 2026 Scout</h1>
        <p>
          Consultation et comparaison des équipes WTDGC 2026 avec statistiques PDGA et espace staff France.
        </p>
      </section>

      <section className="panel">
        <h2>Socle initial</h2>
        <ul>
          <li>Next.js + TypeScript</li>
          <li>Firebase / Firestore prêt à configurer</li>
          <li>Client serveur PDGA avec authentification par session</li>
          <li>Modèle équipes, joueurs, inscriptions et statistiques</li>
        </ul>
      </section>
    </main>
  );
}
