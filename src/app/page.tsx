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

type GenderSource = "profile" | "yearly-stats" | "default-m";

type PdgaProfileDoc = {
  pdgaNumber: number;
  currentRating?: number | null;
  gender?: PdgaGender | null;
  genderSource?: string | null;
  scoutingMetrics?: {
    trend12Months?: number | null;
  } | null;
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
  const trends12Months = new Map<number, number | null>();
  const genders = new Map<number, PdgaGender>();
  const genderSources = new Map<number, GenderSource>();

  for (const doc of profilesSnapshot.docs) {
    const profile = doc.data() as PdgaProfileDoc;
    if (!Number.isFinite(profile.pdgaNumber)) continue;
    ratings.set(profile.pdgaNumber, profile.currentRating ?? null);
    trends12Months.set(profile.pdgaNumber, profile.scoutingMetrics?.trend12Months ?? null);
    if (profile.gender === "M" || profile.gender === "F") {
      genders.set(profile.pdgaNumber, profile.gender);
      genderSources.set(
        profile.pdgaNumber,
        profile.genderSource === "default-m" ? "default-m" : "profile",
      );
    }
  }

  for (const doc of yearlyStatsSnapshot.docs) {
    const stats = doc.data() as YearlyStatsDoc;
    const pdgaNumber = stats.pdgaNumber ?? Number.parseInt(doc.ref.parent.parent?.id ?? "", 10);
    if (!Number.isFinite(pdgaNumber) || genders.has(pdgaNumber)) continue;
    const gender = stats.gender ?? extractPdgaGender(stats.payload);
    if (gender) {
      genders.set(pdgaNumber, gender);
      genderSources.set(pdgaNumber, "yearly-stats");
    }
  }

  return teams
    .filter((team) => team.division === "open" || team.division === "masters")
    .map((team) => {
      const teamPlayers = registrations
        .filter((registration) => registration.teamId === team.id && registration.role === "player")
        .map((registration) => {
          const player = players.get(registration.personId);
          if (!player) return null;

          const pdgaNumber = player.pdgaNumber ?? null;
          const gender = pdgaNumber ? genders.get(pdgaNumber) ?? "M" : "M";
          const genderSource = pdgaNumber
            ? genderSources.get(pdgaNumber) ?? "default-m"
            : "default-m";

          return {
            id: player.id,
            firstName: player.firstName,
            lastName: player.lastName,
            pdgaNumber,
            rating: pdgaNumber ? ratings.get(pdgaNumber) ?? null : null,
            trend12Months: pdgaNumber ? trends12Months.get(pdgaNumber) ?? null : null,
            gender,
            genderSource,
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
