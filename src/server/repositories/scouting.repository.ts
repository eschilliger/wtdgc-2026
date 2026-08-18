import { WTDGC_REFERENCE_RATING_DATE } from "../../domain/wtdgc/competition";
import type { ComparisonTeam } from "../../components/TeamComparison";
import { db } from "../firebase/admin";
import { extractPdgaGender, type PdgaGender } from "../pdga/statistics";

type TeamDoc = { id: string; country: string; countryCode: string; division: "open" | "masters" };
type RegistrationDoc = { teamId: string; personId: string; role: "player" | "nptm" | "npts"; jerseyNumber?: number | null };
type PlayerDoc = { id: string; firstName: string; lastName: string; pdgaNumber?: number | null };
type GenderSource = "profile" | "yearly-stats" | "default-m";
type PdgaProfileDoc = {
  pdgaNumber: number;
  currentRating?: number | null;
  ratingEffectiveDate?: string | null;
  wtdgcReferenceRating?: number | null;
  wtdgcReferenceRatingDate?: string | null;
  gender?: PdgaGender | null;
  genderSource?: string | null;
  scoutingMetrics?: { trend12Months?: number | null } | null;
};
type YearlyStatsDoc = { pdgaNumber?: number; gender?: PdgaGender | null; payload?: unknown };

export async function loadScoutingTeams(division?: "open" | "masters"): Promise<ComparisonTeam[]> {
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
  const referenceRatings = new Map<number, number>();
  const trends12Months = new Map<number, number | null>();
  const genders = new Map<number, PdgaGender>();
  const genderSources = new Map<number, GenderSource>();

  for (const doc of profilesSnapshot.docs) {
    const profile = doc.data() as PdgaProfileDoc;
    if (!Number.isFinite(profile.pdgaNumber)) continue;
    ratings.set(profile.pdgaNumber, profile.currentRating ?? null);
    trends12Months.set(profile.pdgaNumber, profile.scoutingMetrics?.trend12Months ?? null);
    if (profile.wtdgcReferenceRatingDate === WTDGC_REFERENCE_RATING_DATE && typeof profile.wtdgcReferenceRating === "number") {
      referenceRatings.set(profile.pdgaNumber, profile.wtdgcReferenceRating);
    } else if (profile.ratingEffectiveDate === WTDGC_REFERENCE_RATING_DATE && typeof profile.currentRating === "number") {
      referenceRatings.set(profile.pdgaNumber, profile.currentRating);
    }
    if (profile.gender === "M" || profile.gender === "F") {
      genders.set(profile.pdgaNumber, profile.gender);
      genderSources.set(profile.pdgaNumber, profile.genderSource === "default-m" ? "default-m" : "profile");
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
    .filter((team) => (team.division === "open" || team.division === "masters") && (!division || team.division === division))
    .map((team) => ({
      id: team.id,
      country: team.country,
      countryCode: team.countryCode,
      division: team.division,
      players: registrations
        .filter((registration) => registration.teamId === team.id && registration.role === "player")
        .map((registration) => {
          const player = players.get(registration.personId);
          if (!player) return null;
          const pdgaNumber = player.pdgaNumber ?? null;
          const gender = pdgaNumber ? genders.get(pdgaNumber) ?? "M" : "M";
          const referenceRating = pdgaNumber ? referenceRatings.get(pdgaNumber) ?? null : null;
          return {
            id: player.id,
            firstName: player.firstName,
            lastName: player.lastName,
            pdgaNumber,
            rating: pdgaNumber ? ratings.get(pdgaNumber) ?? null : null,
            trend12Months: pdgaNumber ? trends12Months.get(pdgaNumber) ?? null : null,
            gender,
            genderSource: pdgaNumber ? genderSources.get(pdgaNumber) ?? "default-m" : "default-m",
            jerseyNumber: registration.jerseyNumber ?? null,
            referenceRating,
            ratingSource: referenceRating !== null ? "pdga" as const : null,
          };
        })
        .filter((player): player is NonNullable<typeof player> => player !== null),
    }));
}
