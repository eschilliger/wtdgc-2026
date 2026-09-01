import type { WtdgcDivision, WtdgcRoundNumber } from "../../domain/wtdgc/competition";
import type { WtdgcGameKey } from "../../domain/wtdgc/round-assignments";
import type { RoundMatchup } from "./round-management.repository";
import { db } from "../firebase/admin";
import { WTDGC_EVENT_ID } from "./competition.repository";

export type PlayerAssociation = {
  personId: string;
  pdgaNumber: number | null;
  division: WtdgcDivision;
  playerDisplayName: string | null;
};

export type PublishedPlayerMatchup = {
  id: string;
  order: number;
  game: WtdgcGameKey;
  format: "single" | "double";
  francePlayers: string[];
  opponentPlayers: string[];
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
  playerStatus: "starter" | "substitute";
  matchups: PublishedPlayerMatchup[];
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
  matchups?: RoundMatchup[] | null;
};

type TeamDoc = { id?: string; country?: string };
type PlayerDoc = { id?: string; firstName?: string; lastName?: string };

function displayName(player: PlayerDoc | undefined, fallback: string) {
  if (!player) return fallback;
  const value = `${player.firstName ?? ""} ${player.lastName ?? ""}`.trim();
  return value || fallback;
}

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

  const [roundsSnapshot, teamsSnapshot, playersSnapshot] = await Promise.all([
    db.collection("events").doc(WTDGC_EVENT_ID).collection("competitionRounds").where("publicationStatus", "==", "published").get(),
    db.collection("teams").get(),
    db.collection("players").get(),
  ]);
  const countryByTeamId = new Map<string, string>();
  teamsSnapshot.docs.forEach((doc) => {
    const team = doc.data() as TeamDoc;
    const country = typeof team.country === "string" ? team.country : "Adversaire";
    countryByTeamId.set(doc.id, country);
    if (typeof team.id === "string") countryByTeamId.set(team.id, country);
  });
  const playersById = new Map<string, PlayerDoc>();
  playersSnapshot.docs.forEach((doc) => {
    const player = doc.data() as PlayerDoc;
    playersById.set(doc.id, player);
    if (typeof player.id === "string") playersById.set(player.id, player);
  });

  const matches = roundsSnapshot.docs
    .map((doc) => ({ id: doc.id, data: doc.data() as RoundDoc }))
    .filter(({ data }) => data.division === association.division)
    .map(({ id, data }) => {
      const relevantMatchups: PublishedPlayerMatchup[] = (Array.isArray(data.matchups) ? data.matchups : [])
        .filter((matchup) => Array.isArray(matchup.francePlayerIds) && matchup.francePlayerIds.includes(association.personId))
        .map((matchup, index) => {
          const fallbackGame = (["singles-1", "singles-2", "doubles-1", "doubles-2"] as const)[index] ?? "singles-1";
          return {
            id: matchup.id || `match-${index + 1}`,
            order: Number.isFinite(matchup.order) ? matchup.order : index + 1,
            game: matchup.game ?? fallbackGame,
            format: matchup.format === "double" ? "double" as const : "single" as const,
            francePlayers: matchup.francePlayerIds.map((playerId) => displayName(playersById.get(playerId), "Joueur France")),
            opponentPlayers: matchup.opponentPlayerIds.map((playerId) => displayName(playersById.get(playerId), "Adversaire")),
          };
        })
        .sort((a, b) => a.order - b.order);
      return {
        id,
        division: association.division,
        roundNumber: Number(data.roundNumber) as WtdgcRoundNumber,
        opponentCountry: data.opponentTeamId ? countryByTeamId.get(data.opponentTeamId) ?? "Adversaire" : "Adversaire",
        scheduledStart: data.scheduledStart ?? null,
        course: data.course ?? null,
        startingHole: data.startingHole ?? null,
        publishedAt: data.publishedAt ?? null,
        playerStatus: data.roster?.selectedPlayerIds?.includes(association.personId) ? "starter" as const : "substitute" as const,
        matchups: relevantMatchups,
      };
    })
    .filter((match) => match.roundNumber >= 1 && match.roundNumber <= 8)
    .sort((a, b) => a.roundNumber - b.roundNumber);

  return { association, matches };
}
