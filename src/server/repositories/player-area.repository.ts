import type { WtdgcDivision, WtdgcRoundNumber } from "../../domain/wtdgc/competition";
import { averageEventRating, roundGameAssignments, type WtdgcGameKey } from "../../domain/wtdgc/round-assignments";
import type { RoundMatchup } from "./round-management.repository";
import { db } from "../firebase/admin";
import { WTDGC_EVENT_ID } from "./competition.repository";
import { loadScoutingTeams } from "./scouting.repository";

export type PlayerAssociation = {
  personId: string;
  pdgaNumber: number | null;
  division: WtdgcDivision;
  playerDisplayName: string | null;
};

export type PublishedMatchupPlayer = {
  id: string;
  name: string;
  slot: string;
  rating: number | null;
};

export type PublishedPlayerMatchup = {
  id: string;
  order: number;
  game: WtdgcGameKey;
  format: "single" | "double";
  slotLabel: string;
  francePlayers: PublishedMatchupPlayer[];
  opponentPlayers: PublishedMatchupPlayer[];
  franceRating: number | null;
  opponentRating: number | null;
  ratingGap: number | null;
  includesPlayer: boolean;
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

function eventRating(player: { referenceRating?: number | null; rating?: number | null } | undefined) {
  return player?.referenceRating ?? player?.rating ?? null;
}

function playerName(player: { firstName?: string; lastName?: string } | undefined, fallback: string) {
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

  const [roundsSnapshot, divisionTeams] = await Promise.all([
    db.collection("events").doc(WTDGC_EVENT_ID).collection("competitionRounds").where("publicationStatus", "==", "published").get(),
    loadScoutingTeams(association.division),
  ]);

  const countryByTeamId = new Map(divisionTeams.map((team) => [team.id, team.country] as const));
  const playersById = new Map(divisionTeams.flatMap((team) => team.players.map((player) => [player.id, player] as const)));

  const matches = roundsSnapshot.docs
    .map((doc) => ({ id: doc.id, data: doc.data() as RoundDoc }))
    .filter(({ data }) => data.division === association.division)
    .map(({ id, data }) => {
      const roundNumber = Number(data.roundNumber) as WtdgcRoundNumber;
      const officialGames = roundNumber >= 1 && roundNumber <= 8 ? roundGameAssignments(association.division, roundNumber) : [];
      const teamMatchups: PublishedPlayerMatchup[] = (Array.isArray(data.matchups) ? data.matchups : [])
        .map((matchup, index) => {
          const fallbackGame = (["singles-1", "singles-2", "doubles-1", "doubles-2"] as const)[index] ?? "singles-1";
          const game = matchup.game ?? fallbackGame;
          const officialGame = officialGames.find((entry) => entry.game === game) ?? officialGames[index];
          const slots = officialGame?.rosterSlots ?? [];
          const francePlayers = matchup.francePlayerIds.map((playerId, playerIndex) => {
            const player = playersById.get(playerId);
            return {
              id: playerId,
              name: playerName(player, "Joueur France"),
              slot: slots[playerIndex] ?? "—",
              rating: eventRating(player),
            };
          });
          const opponentPlayers = matchup.opponentPlayerIds.map((playerId, playerIndex) => {
            const player = playersById.get(playerId);
            return {
              id: playerId,
              name: playerName(player, "Adversaire"),
              slot: slots[playerIndex] ?? "—",
              rating: eventRating(player),
            };
          });
          const franceCandidates = matchup.francePlayerIds.map((playerId) => playersById.get(playerId)).filter((player): player is NonNullable<typeof player> => Boolean(player));
          const opponentCandidates = matchup.opponentPlayerIds.map((playerId) => playersById.get(playerId)).filter((player): player is NonNullable<typeof player> => Boolean(player));
          const franceRating = franceCandidates.length === matchup.francePlayerIds.length ? averageEventRating(franceCandidates) : null;
          const opponentRating = opponentCandidates.length === matchup.opponentPlayerIds.length ? averageEventRating(opponentCandidates) : null;
          return {
            id: matchup.id || `match-${index + 1}`,
            order: Number.isFinite(matchup.order) ? matchup.order : index + 1,
            game,
            format: matchup.format === "double" ? "double" as const : "single" as const,
            slotLabel: slots.join(" + "),
            francePlayers,
            opponentPlayers,
            franceRating,
            opponentRating,
            ratingGap: franceRating !== null && opponentRating !== null ? franceRating - opponentRating : null,
            includesPlayer: matchup.francePlayerIds.includes(association.personId),
          };
        })
        .sort((a, b) => a.order - b.order);
      return {
        id,
        division: association.division,
        roundNumber,
        opponentCountry: data.opponentTeamId ? countryByTeamId.get(data.opponentTeamId) ?? "Adversaire" : "Adversaire",
        scheduledStart: data.scheduledStart ?? null,
        course: data.course ?? null,
        startingHole: data.startingHole ?? null,
        publishedAt: data.publishedAt ?? null,
        playerStatus: data.roster?.selectedPlayerIds?.includes(association.personId) ? "starter" as const : "substitute" as const,
        matchups: teamMatchups,
      };
    })
    .filter((match) => match.roundNumber >= 1 && match.roundNumber <= 8)
    .sort((a, b) => a.roundNumber - b.roundNumber);

  return { association, matches };
}
