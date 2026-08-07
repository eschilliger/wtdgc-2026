import Link from "next/link";

export default function PlayerNotFound() {
  return (
    <main className="shell player-detail">
      <div className="detail-card">
        <p className="eyebrow">Profil joueur</p>
        <h2>Joueur introuvable</h2>
        <p className="empty-state">Ce profil n'est pas encore disponible dans les données WTDGC / PDGA synchronisées.</p>
        <Link className="back-link" href="/">← Retour au comparateur</Link>
      </div>
    </main>
  );
}
