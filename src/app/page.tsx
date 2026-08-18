import TeamComparison from "@/components/TeamComparison";
import { loadScoutingTeams } from "@/server/repositories/scouting.repository";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const teams = await loadScoutingTeams();

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">WTDGC 2026 · Vilnius</p>
          <h1>Team Scout</h1>
          <p className="hero-copy">Compare rapidement les forces en présence à partir des compositions WTDGC et des ratings PDGA.</p>
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
