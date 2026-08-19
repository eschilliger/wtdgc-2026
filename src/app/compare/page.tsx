import TeamComparison from "@/components/TeamComparison";
import { requireAuthorizedAccess } from "@/server/auth/session";
import { loadScoutingTeams } from "@/server/repositories/scouting.repository";

export const dynamic = "force-dynamic";

export default async function ComparePage() {
  await requireAuthorizedAccess();
  const teams = await loadScoutingTeams();

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">WTDGC 2026 · Vilnius</p>
          <h1>Comparateur d’équipes</h1>
          <p className="hero-copy">Compare les équipes, teste des compositions et analyse les écarts à partir des données WTDGC et PDGA.</p>
        </div>
        <div className="hero-badge">
          <strong>{teams.length}</strong>
          <span>équipes suivies</span>
        </div>
      </header>
      <TeamComparison teams={teams} />
    </main>
  );
}
