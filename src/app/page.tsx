import TeamComparison, { type ComparisonTeam } from "@/components/TeamComparison";
import { db } from "@/server/firebase/admin";

export const dynamic = "force-dynamic";

type TeamDoc = {
  id: string;
  country: string;
  countryCode: string;
  division: "open" | "masters";
};

type RegistrationDoc = {
  teamId: string;
  personId: string;
  role: "player" | "nptm" | "npts";
  jerseyNumber?: number | null;
};

type PlayerDoc = {
  id: string;
  firstName: string;
  lastName: string;
  pdgaNumber?: number | null;
};

type PdgaProfileDoc = {
  pdgaNumber: number;
  currentRating?: number | null;
};

async function loadTeams(): Promise<ComparisonTeam[]> {
  const [teamsSnapshot, registrationsSnapshot, playersSnapshot, profilesSnapshot] = await Promise.all([
    db.collection("teams").get(),
    db.collection("registrations").get(),
    db.collection("players").get(),
    db.collection("pdgaProfiles").get(),
  ]);

  const teams = teamsSnapshot.docs.map((doc) => doc.data() as TeamDoc);
  const registrations = registrationsSnapshot.docs.map((doc) => doc.data() as RegistrationDoc);
  const players = new Map(playersSnapshot.docs.map((doc) => {
    const player = doc.data() as PlayerDoc;
    return [player.id, player] as const;
  }));
  const ratings = new Map<number, number | null>();

  for (const doc of profilesSnapshot.docs) {
    const profile = doc.data() as PdgaProfileDoc;
    if (Number.isFinite(profile.pdgaNumber)) ratings.set(profile.pdgaNumber, profile.currentRating ?? null);
  }

  return teams
    .filter((team) => team.division === "open" || team.division === "masters")
    .map((team) => {
      const teamPlayers = registrations
        .filter((registration) => registration.teamId === team.id && registration.role === "player")
        .map((registration) => {
          const player = players.get(registration.personId);
          if (!player) return null;

          return {
            id: player.id,
            firstName: player.firstName,
            lastName: player.lastName,
            pdgaNumber: player.pdgaNumber ?? null,
            rating: player.pdgaNumber ? ratings.get(player.pdgaNumber) ?? null : null,
            jerseyNumber: registration.jerseyNumber ?? null,
          };
        })
        .filter((player): player is NonNullable<typeof player> => player !== null);

      return {
        id: team.id,
        country: team.country,
        countryCode: team.countryCode,
        division: team.division,
        players: teamPlayers,
      };
    });
}

export default async function HomePage() {
  const teams = await loadTeams();

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
