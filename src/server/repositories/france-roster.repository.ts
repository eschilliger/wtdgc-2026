import { WTDGC_REFERENCE_RATING_DATE } from "../../domain/wtdgc/competition";
import { db } from "../firebase/admin";
import { getDefaultMatchRoster } from "./competition.repository";

export type FranceOpenRosterPlayer = {
  id: string;
  firstName: string;
  lastName: string;
  pdgaNumber: number | null;
  gender: "M" | "F";
  wtdgcRating: number | null;
  liveRating: number | null;
};

type TeamDoc = {
  id: string;
  country: string;
  division: "open" | "masters";
};

type RegistrationDoc = {
  teamId: string;
  personId: string;
  role: "player" | "nptm" | "npts";
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
  ratingEffectiveDate?: string | null;
  wtdgcReferenceRating?: number | null;
  wtdgcReferenceRatingDate?: string | null;
  gender?: "M" | "F" | null;
};

export async function loadFranceOpenRosterData() {
  const [teamsSnapshot, registrationsSnapshot, playersSnapshot, profilesSnapshot, roster] = await Promise.all([
    db.collection("teams").get(),
    db.collection("registrations").get(),
    db.collection("players").get(),
    db.collection("pdgaProfiles").get(),
    getDefaultMatchRoster("open"),
  ]);

  const franceOpen = teamsSnapshot.docs
    .map((doc) => doc.data() as TeamDoc)
    .find((team) => team.division === "open" && team.country.trim().toLowerCase() === "france");

  if (!franceOpen) throw new Error("France Open team not found.");

  const registrations = registrationsSnapshot.docs.map((doc) => doc.data() as RegistrationDoc);
  const playersById = new Map(playersSnapshot.docs.map((doc) => {
    const player = doc.data() as PlayerDoc;
    return [player.id, player] as const;
  }));
  const profilesByPdga = new Map<number, PdgaProfileDoc>();
  for (const doc of profilesSnapshot.docs) {
    const profile = doc.data() as PdgaProfileDoc;
    if (Number.isFinite(profile.pdgaNumber)) profilesByPdga.set(profile.pdgaNumber, profile);
  }

  const players: FranceOpenRosterPlayer[] = registrations
    .filter((registration) => registration.teamId === franceOpen.id && registration.role === "player")
    .map((registration) => {
      const player = playersById.get(registration.personId);
      if (!player) return null;
      const pdgaNumber = player.pdgaNumber ?? null;
      const profile = pdgaNumber ? profilesByPdga.get(pdgaNumber) : undefined;
      const wtdgcRating = profile?.wtdgcReferenceRatingDate === WTDGC_REFERENCE_RATING_DATE
        ? profile.wtdgcReferenceRating ?? null
        : profile?.ratingEffectiveDate === WTDGC_REFERENCE_RATING_DATE
          ? profile.currentRating ?? null
          : null;
      return {
        id: player.id,
        firstName: player.firstName,
        lastName: player.lastName,
        pdgaNumber,
        gender: profile?.gender === "F" ? "F" as const : "M" as const,
        wtdgcRating,
        liveRating: profile?.currentRating ?? null,
      };
    })
    .filter((player): player is FranceOpenRosterPlayer => player !== null)
    .sort((a, b) => (b.wtdgcRating ?? -Infinity) - (a.wtdgcRating ?? -Infinity) || a.lastName.localeCompare(b.lastName, "fr"));

  return {
    teamId: franceOpen.id,
    players,
    roster,
  };
}
