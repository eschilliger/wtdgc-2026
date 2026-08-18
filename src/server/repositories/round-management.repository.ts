import type { OpenRosterSlot, WtdgcRoundNumber, WtdgcRoundPublicationStatus } from "../../domain/wtdgc/competition";
import type { ComparisonTeam } from "../../components/TeamComparison";
import { db } from "../firebase/admin";
import { competitionRoundRef, getDefaultMatchRoster, WTDGC_EVENT_ID } from "./competition.repository";
import { loadScoutingTeams } from "./scouting.repository";

export type OpenRoundRoster = {
  slotAssignments: Partial<Record<OpenRosterSlot, string>>;
  selectedPlayerIds: string[];
};

export type OpenRoundManagementData = {
  roundNumber: WtdgcRoundNumber;
  publicationStatus: WtdgcRoundPublicationStatus;
  opponentTeamId: string | null;
  scheduledStart: string | null;
  course: string | null;
  startingHole: string | null;
  roster: OpenRoundRoster | null;
  publishedAt: string | null;
  publishedBy: string | null;
  internalNote: string;
  franceTeam: ComparisonTeam;
  teams: ComparisonTeam[];
  defaultSlotAssignments: Partial<Record<OpenRosterSlot, string>>;
};

type RoundDoc = {
  roundNumber?: number;
  publicationStatus?: WtdgcRoundPublicationStatus;
  opponentTeamId?: string | null;
  scheduledStart?: string | null;
  course?: string | null;
  startingHole?: string | null;
  roster?: { slotAssignments?: Partial<Record<OpenRosterSlot, string>>; selectedPlayerIds?: string[] } | null;
  publishedAt?: string | null;
  publishedBy?: string | null;
};

export async function listOpenRoundsForStaff() {
  const snapshot = await db.collection("events").doc(WTDGC_EVENT_ID).collection("competitionRounds")
    .where("division", "==", "open")
    .get();
  return snapshot.docs
    .map((doc) => {
      const data = doc.data() as RoundDoc;
      return {
        id: doc.id,
        roundNumber: Number(data.roundNumber) as WtdgcRoundNumber,
        publicationStatus: (data.publicationStatus ?? "draft") as WtdgcRoundPublicationStatus,
        opponentTeamId: data.opponentTeamId ?? null,
        scheduledStart: data.scheduledStart ?? null,
      };
    })
    .filter((round) => round.roundNumber >= 1 && round.roundNumber <= 8)
    .sort((a, b) => a.roundNumber - b.roundNumber);
}

export async function loadOpenRoundManagement(roundNumber: WtdgcRoundNumber): Promise<OpenRoundManagementData> {
  const [roundSnapshot, openTeams, defaultRoster, noteSnapshot] = await Promise.all([
    competitionRoundRef("open", roundNumber).get(),
    loadScoutingTeams("open"),
    getDefaultMatchRoster("open"),
    competitionRoundRef("open", roundNumber).collection("staffNotes").doc("france").get(),
  ]);

  if (!roundSnapshot.exists) throw new Error(`Open round ${roundNumber} not found.`);
  const round = roundSnapshot.data() as RoundDoc;
  const franceTeam = openTeams.find((team) => team.country.trim().toLowerCase() === "france");
  if (!franceTeam) throw new Error("France Open scouting team not found.");
  const teams = openTeams.filter((team) => team.id !== franceTeam.id).sort((a, b) => a.country.localeCompare(b.country, "fr"));

  const roster = round.roster?.slotAssignments
    ? {
        slotAssignments: round.roster.slotAssignments,
        selectedPlayerIds: round.roster.selectedPlayerIds ?? Object.values(round.roster.slotAssignments).filter((value): value is string => Boolean(value)),
      }
    : null;

  return {
    roundNumber,
    publicationStatus: round.publicationStatus ?? "draft",
    opponentTeamId: round.opponentTeamId ?? null,
    scheduledStart: round.scheduledStart ?? null,
    course: round.course ?? null,
    startingHole: round.startingHole ?? null,
    roster,
    publishedAt: round.publishedAt ?? null,
    publishedBy: round.publishedBy ?? null,
    internalNote: noteSnapshot.exists ? String(noteSnapshot.data()?.text ?? "") : "",
    franceTeam,
    teams,
    defaultSlotAssignments: (defaultRoster?.slotAssignments ?? {}) as Partial<Record<OpenRosterSlot, string>>,
  };
}

export async function saveOpenRoundManagement(input: {
  roundNumber: WtdgcRoundNumber;
  publicationStatus: WtdgcRoundPublicationStatus;
  opponentTeamId: string | null;
  scheduledStart: string | null;
  course: string | null;
  startingHole: string | null;
  slotAssignments: Partial<Record<OpenRosterSlot, string>>;
  internalNote: string;
  actorUid: string;
  actorEmail: string | null;
}) {
  const now = new Date().toISOString();
  const selectedPlayerIds = Object.values(input.slotAssignments).filter((value): value is string => Boolean(value));
  const roundRef = competitionRoundRef("open", input.roundNumber);
  const roundUpdate: Record<string, unknown> = {
    opponentTeamId: input.opponentTeamId,
    scheduledStart: input.scheduledStart,
    course: input.course,
    startingHole: input.startingHole,
    publicationStatus: input.publicationStatus,
    roster: {
      division: "open",
      roundNumber: input.roundNumber,
      kind: "round-specific",
      selectedPlayerIds,
      slotAssignments: input.slotAssignments,
      submittedAt: input.publicationStatus === "published" ? now : null,
      submissionDeadline: null,
      confirmed: input.publicationStatus !== "draft",
    },
    updatedAt: now,
    updatedBy: input.actorUid,
    updatedByEmail: input.actorEmail,
  };
  if (input.publicationStatus === "published") {
    roundUpdate.publishedAt = now;
    roundUpdate.publishedBy = input.actorUid;
  } else {
    roundUpdate.publishedAt = null;
    roundUpdate.publishedBy = null;
  }
  await roundRef.set(roundUpdate, { merge: true });
  await roundRef.collection("staffNotes").doc("france").set({
    text: input.internalNote,
    createdAt: now,
    updatedAt: now,
    authorUid: input.actorUid,
    authorEmail: input.actorEmail,
  }, { merge: true });
}
