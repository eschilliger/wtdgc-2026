import TeamComparison, { type ComparisonTeam } from "@/components/TeamComparison";
import { db } from "@/server/firebase/admin";
import { extractPdgaGender, type PdgaGender } from "@/server/pdga/statistics";

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
  gender?: PdgaGender | null;
};

type YearlyStatsDoc = {
  pdgaNumber?: number;
  gender?: PdgaGender | null;
  payload?: unknown;
};

async function loadTeams(): Promise<ComparisonTeam[]> {
  const [teamsSnapshot, registrationsSnapshot, playersSnapshot, profilesSnapshot, yearlyStatsSnapshot] = await Promise.all([
    db.collection("teams").get(),
    db.collection("registrations").get(),
    db.collection("players").get(),
    db.collection("pdgaProfiles").get(),
    db.collectionGroup("yearlyStats").get(),
  ]);

  const teams = teamsSnapshot.docs.map((doc) => doc.data() as TeamDoc);
  const registrations = registrationsSnapshot.docs.map((doc) => doc.data() as RegistrationDoc);
  const players = new Map(playersSnapshot.docs.map((doc) => {
    const player = doc.data() as PlayerDoc;
    return [player.id, player] as const;
  }));
  const ratings = new Map<number, number | null>();
  const genders = new Map<number, PdgaGender>();

  for (const doc of profilesSnapshot.docs) {
    const profile = doc.data() as PdgaProfileDoc;
    if (!Number.isFinite(profile.pdgaNumber)) continue;
    ratings.set(profile.pdgaNumber, profile.currentRating ?? null);
    if (profile.gender === "M" || profile.gender === "F") genders.set(profile.pdgaNumber, profile.gender);
  }

  for (const doc of yearlyStatsSnapshot.docs) {
    const stats = doc.data() as YearlyStatsDoc;
    const pdgaNumber = stats.pdgaNumber ?? Number.parseInt(doc.ref.parent.parent?.id ?? "", 10);
    if (!Number.isFinite(pdgaNumber) || genders.has(pdgaNumber)) continue;
    const gender = stats.gender ?? extractPdgaGender(stats.payload);
    if (gender) genders.set(pdgaNumber, gender);
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
            gender: player.pdgaNumber ? genders.get(player.pdgaNumber) ?? null : null,
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
