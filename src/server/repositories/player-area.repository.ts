import type { WtdgcDivision, WtdgcRoundNumber } from "../../domain/wtdgc/competition";
import { db } from "../firebase/admin";
import { WTDGC_EVENT_ID } from "./competition.repository";

export type PlayerAssociation = {
  personId: string;
  pdgaNumber: number | null;
  division: WtdgcDivision;
  playerDisplayName: string | null;
};

export type PublishedPlayerMatch = {
  id: string;
  division: WtdgcDivision;
  roundNumber: WtdgcRoundNumber;
  opponentCountry: string;
  scheduledStart: string | null;
  course: string | null;
  startingHole: string | null;
  publishedAt: string | null;
};

type AppUserDoc = {
  personId?: string | null;
  pdgaNumber?: number | null;
  division?: WtdgcDivision | null;
  playerDisplayName?: string | null;
};

type RoundDoc = {
  division?: WtdgcDivision;
  roundNumber?: number;
  publicationStatus?: string;
  opponentTeamId?: string | null;
  scheduledStart?: string | null;
  course?: string | null;
  startingHole?: string | null;
  publishedAt?: string | null;
  roster?: { selectedPlayerIds?: string[] } | null;
};

type TeamDoc = { id?: string; country?: string };

export async function loadPlayerArea(uid: string) {
  const profileSnapshot = await db.collection("appUsers").doc(uid).get();
  const profile = profileSnapshot.exists ? profileSnapshot.data() as AppUserDoc : null;
  if (!profile?.personId || (profile.division !== "open" && profile.division !== "masters")) {
    return { association: null, matches: [] as PublishedPlayerMatch[] };
  }

  const association: PlayerAssociation = {
    personId: profile.personId,
    pdgaNumber: typeof profile.pdgaNumber === "number" ? profile.pdgaNumber : null,
    division: profile.division,
    playerDisplayName: typeof profile.playerDisplayName === "string" ? profile.playerDisplayName : null,
  };

  const [roundsSnapshot, teamsSnapshot] = await Promise.all([
    db.collection("events").doc(WTDGC_EVENT_ID).collection("competitionRounds").where("publicationStatus", "==", "published").get(),
    db.collection("teams").get(),
  ]);
  const countryByTeamId = new Map<string, string>();
  teamsSnapshot.docs.forEach((doc) => {
    const team = doc.data() as TeamDoc;
    const country = typeof team.country === "string" ? team.country : "Adversaire";
    countryByTeamId.set(doc.id, country);
    if (typeof team.id === "string") countryByTeamId.set(team.id, country);
  });

  const matches = roundsSnapshot.docs
    .map((doc) => ({ id: doc.id, data: doc.data() as RoundDoc }))
    .filter(({ data }) => data.division === association.division && data.roster?.selectedPlayerIds?.includes(association.personId))
    .map(({ id, data }) => ({
      id,
      division: association.division,
      roundNumber: Number(data.roundNumber) as WtdgcRoundNumber,
      opponentCountry: data.opponentTeamId ? countryByTeamId.get(data.opponentTeamId) ?? "Adversaire" : "Adversaire",
      scheduledStart: data.scheduledStart ?? null,
      course: data.course ?? null,
      startingHole: data.startingHole ?? null,
      publishedAt: data.publishedAt ?? null,
    }))
    .filter((match) => match.roundNumber >= 1 && match.roundNumber <= 8)
    .sort((a, b) => a.roundNumber - b.roundNumber);

  return { association, matches };
}
