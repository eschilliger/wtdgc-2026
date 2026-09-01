import type { WtdgcDivision, WtdgcRoundNumber, WtdgcRoundPublicationStatus, WtdgcRosterSlot } from "../../domain/wtdgc/competition";
import type { WtdgcGameKey } from "../../domain/wtdgc/round-assignments";
import type { ComparisonTeam } from "../../components/TeamComparison";
import { db } from "../firebase/admin";
import { competitionRoundRef, getDefaultMatchRoster, WTDGC_EVENT_ID } from "./competition.repository";
import { loadScoutingTeams } from "./scouting.repository";

export type RoundRoster = {
  slotAssignments: Partial<Record<WtdgcRosterSlot, string>>;
  selectedPlayerIds: string[];
};

export type RoundMatchup = {
  id: string;
  order: number;
  game: WtdgcGameKey;
  format: "single" | "double";
  francePlayerIds: string[];
  opponentPlayerIds: string[];
};

export type RoundManagementData = {
  division: WtdgcDivision;
  roundNumber: WtdgcRoundNumber;
  publicationStatus: WtdgcRoundPublicationStatus;
  opponentTeamId: string | null;
  opponentDisabledPlayerIds: string[];
  scheduledStart: string | null;
  course: string | null;
  startingHole: string | null;
  roster: RoundRoster | null;
  matchups: RoundMatchup[];
  publishedAt: string | null;
  publishedBy: string | null;
  internalNote: string;
  franceTeam: ComparisonTeam;
  teams: ComparisonTeam[];
  defaultSelectedPlayerIds: string[];
  defaultSlotAssignments: Partial<Record<WtdgcRosterSlot, string>>;
};

export type OpenRoundManagementData = RoundManagementData;

type RoundDoc = {
  roundNumber?: number;
  publicationStatus?: WtdgcRoundPublicationStatus;
  opponentTeamId?: string | null;
  opponentScenario?: { disabledPlayerIds?: string[] } | null;
  scheduledStart?: string | null;
  course?: string | null;
  startingHole?: string | null;
  roster?: { slotAssignments?: Partial<Record<WtdgcRosterSlot, string>>; selectedPlayerIds?: string[] } | null;
  matchups?: RoundMatchup[] | null;
  publishedAt?: string | null;
  publishedBy?: string | null;
};

function normalizeMatchups(value: unknown): RoundMatchup[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry, index) => {
    if (!entry || typeof entry !== "object") return [];
    const raw = entry as Partial<RoundMatchup>;
    if (raw.format !== "single" && raw.format !== "double") return [];
    const size = raw.format === "single" ? 1 : 2;
    const defaultGame = (["singles-1", "singles-2", "doubles-1", "doubles-2"] as const)[index];
    const game = raw.game === "singles-1" || raw.game === "singles-2" || raw.game === "doubles-1" || raw.game === "doubles-2"
      ? raw.game
      : defaultGame;
    if (!game) return [];
    return [{
      id: typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : `match-${index + 1}`,
      order: Number.isFinite(raw.order) ? Number(raw.order) : index + 1,
      game,
      format: raw.format,
      francePlayerIds: Array.isArray(raw.francePlayerIds) ? raw.francePlayerIds.filter((id): id is string => typeof id === "string").slice(0, size) : [],
      opponentPlayerIds: Array.isArray(raw.opponentPlayerIds) ? raw.opponentPlayerIds.filter((id): id is string => typeof id === "string").slice(0, size) : [],
    }];
  }).sort((a, b) => a.order - b.order);
}

export async function listRoundsForStaff(division: WtdgcDivision) {
  const snapshot = await db.collection("events").doc(WTDGC_EVENT_ID).collection("competitionRounds").where("division", "==", division).get();
  return snapshot.docs.map((doc) => {
    const data = doc.data() as RoundDoc;
    return { id: doc.id, roundNumber: Number(data.roundNumber) as WtdgcRoundNumber, publicationStatus: (data.publicationStatus ?? "draft") as WtdgcRoundPublicationStatus, opponentTeamId: data.opponentTeamId ?? null, scheduledStart: data.scheduledStart ?? null };
  }).filter((round) => round.roundNumber >= 1 && round.roundNumber <= 8).sort((a, b) => a.roundNumber - b.roundNumber);
}

export const listOpenRoundsForStaff = () => listRoundsForStaff("open");

export async function loadRoundManagement(division: WtdgcDivision, roundNumber: WtdgcRoundNumber): Promise<RoundManagementData> {
  const [roundSnapshot, divisionTeams, defaultRoster, noteSnapshot] = await Promise.all([
    competitionRoundRef(division, roundNumber).get(),
    loadScoutingTeams(division),
    getDefaultMatchRoster(division),
    competitionRoundRef(division, roundNumber).collection("staffNotes").doc("france").get(),
  ]);
  if (!roundSnapshot.exists) throw new Error(`${division} round ${roundNumber} not found.`);
  const round = roundSnapshot.data() as RoundDoc;
  const franceTeam = divisionTeams.find((team) => team.country.trim().toLowerCase() === "france");
  if (!franceTeam) throw new Error(`France ${division} scouting team not found.`);
  const teams = divisionTeams.filter((team) => team.id !== franceTeam.id).sort((a, b) => a.country.localeCompare(b.country, "fr"));
  const slotAssignments = round.roster?.slotAssignments ?? {};
  const selectedPlayerIds = round.roster?.selectedPlayerIds ?? Object.values(slotAssignments).filter((value): value is string => Boolean(value));
  const defaultSlotAssignments = (defaultRoster?.slotAssignments ?? {}) as Partial<Record<WtdgcRosterSlot, string>>;
  const defaultSelectedPlayerIds = defaultRoster?.selectedPlayerIds?.length ? defaultRoster.selectedPlayerIds : Object.values(defaultSlotAssignments).filter((value): value is string => Boolean(value));
  return {
    division,
    roundNumber,
    publicationStatus: round.publicationStatus ?? "draft",
    opponentTeamId: round.opponentTeamId ?? null,
    opponentDisabledPlayerIds: round.opponentScenario?.disabledPlayerIds ?? [],
    scheduledStart: round.scheduledStart ?? null,
    course: round.course ?? null,
    startingHole: round.startingHole ?? null,
    roster: selectedPlayerIds.length ? { slotAssignments, selectedPlayerIds } : null,
    matchups: normalizeMatchups(round.matchups),
    publishedAt: round.publishedAt ?? null,
    publishedBy: round.publishedBy ?? null,
    internalNote: noteSnapshot.exists ? String(noteSnapshot.data()?.text ?? "") : "",
    franceTeam,
    teams,
    defaultSelectedPlayerIds,
    defaultSlotAssignments,
  };
}

export const loadOpenRoundManagement = (roundNumber: WtdgcRoundNumber) => loadRoundManagement("open", roundNumber);

export async function saveRoundManagement(input: {
  division: WtdgcDivision;
  roundNumber: WtdgcRoundNumber;
  publicationStatus: WtdgcRoundPublicationStatus;
  opponentTeamId: string | null;
  opponentDisabledPlayerIds: string[];
  scheduledStart: string | null;
  course: string | null;
  startingHole: string | null;
  selectedPlayerIds: string[];
  slotAssignments?: Partial<Record<WtdgcRosterSlot, string>>;
  matchups: RoundMatchup[];
  internalNote: string;
  actorUid: string;
  actorEmail: string | null;
}) {
  const now = new Date().toISOString();
  const roundRef = competitionRoundRef(input.division, input.roundNumber);
  const roundUpdate: Record<string, unknown> = {
    opponentTeamId: input.opponentTeamId,
    opponentScenario: { disabledPlayerIds: input.opponentDisabledPlayerIds },
    scheduledStart: input.scheduledStart,
    course: input.course,
    startingHole: input.startingHole,
    publicationStatus: input.publicationStatus,
    roster: {
      division: input.division,
      roundNumber: input.roundNumber,
      kind: "round-specific",
      selectedPlayerIds: input.selectedPlayerIds,
      slotAssignments: input.slotAssignments ?? {},
      submittedAt: input.publicationStatus === "published" ? now : null,
      submissionDeadline: null,
      confirmed: input.publicationStatus !== "draft",
    },
    matchups: input.matchups.map((matchup, index) => ({ ...matchup, order: index + 1 })),
    updatedAt: now,
    updatedBy: input.actorUid,
    updatedByEmail: input.actorEmail,
    publishedAt: input.publicationStatus === "published" ? now : null,
    publishedBy: input.publicationStatus === "published" ? input.actorUid : null,
  };
  await roundRef.set(roundUpdate, { merge: true });
  await roundRef.collection("staffNotes").doc("france").set({ text: input.internalNote, createdAt: now, updatedAt: now, authorUid: input.actorUid, authorEmail: input.actorEmail }, { merge: true });
}

export async function saveOpenRoundManagement(input: Omit<Parameters<typeof saveRoundManagement>[0], "division" | "selectedPlayerIds"> & { slotAssignments: Partial<Record<WtdgcRosterSlot, string>> }) {
  const selectedPlayerIds = Object.values(input.slotAssignments).filter((value): value is string => Boolean(value));
  return saveRoundManagement({ ...input, division: "open", selectedPlayerIds });
}
