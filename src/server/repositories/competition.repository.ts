import type {
  WtdgcDivision,
  WtdgcMatchRoster,
  WtdgcRoundMatch,
  WtdgcRoundNumber,
} from "../../domain/wtdgc/competition";
import { db } from "../firebase/admin";

export const WTDGC_EVENT_ID = "wtdgc-2026" as const;

export type CompetitionRoundDoc = WtdgcRoundMatch & {
  id: string;
  eventId: typeof WTDGC_EVENT_ID;
  stage: "swiss" | "post-swiss";
  pairingMode: "initial-seeding" | "swiss-results" | "post-swiss";
  gameAssignmentsKnown: boolean;
  rosterSubmissionLeadMinutes: 60;
  gameFormat: {
    totalGames: 4;
    singlesGames: 2;
    doublesGames: 2;
    doublesFormat: "modified-alternate-shot";
  };
  scoring: {
    gameWinPoints: 2;
    gameDrawPoints: 1;
    gameLossPoints: 0;
    matchWinPoints: 2;
    matchDrawPoints: 1;
    matchLossPoints: 0;
  };
  updatedAt: string;
};

export type DefaultMatchRosterDoc = WtdgcMatchRoster & {
  id: string;
  eventId: typeof WTDGC_EVENT_ID;
  status: "draft" | "confirmed";
  eligibilityValidated: boolean;
  updatedAt: string;
};

function eventRef() {
  return db.collection("events").doc(WTDGC_EVENT_ID);
}

export function competitionRoundId(division: WtdgcDivision, roundNumber: WtdgcRoundNumber) {
  return `${division}-r${roundNumber}`;
}

export function competitionRoundRef(division: WtdgcDivision, roundNumber: WtdgcRoundNumber) {
  return eventRef().collection("competitionRounds").doc(competitionRoundId(division, roundNumber));
}

export function defaultMatchRosterRef(division: WtdgcDivision) {
  return eventRef().collection("defaultMatchRosters").doc(division);
}

export async function getDefaultMatchRoster(division: WtdgcDivision): Promise<DefaultMatchRosterDoc | null> {
  const snapshot = await defaultMatchRosterRef(division).get();
  return snapshot.exists ? snapshot.data() as DefaultMatchRosterDoc : null;
}

export async function upsertDefaultMatchRoster(
  division: WtdgcDivision,
  input: Pick<DefaultMatchRosterDoc, "selectedPlayerIds" | "slotAssignments" | "confirmed" | "eligibilityValidated">,
) {
  const now = new Date().toISOString();
  const roster: Partial<DefaultMatchRosterDoc> = {
    id: division,
    eventId: WTDGC_EVENT_ID,
    division,
    roundNumber: null,
    kind: "default",
    selectedPlayerIds: input.selectedPlayerIds,
    slotAssignments: input.slotAssignments,
    submittedAt: input.confirmed ? now : null,
    submissionDeadline: null,
    confirmed: input.confirmed,
    status: input.confirmed ? "confirmed" : "draft",
    eligibilityValidated: input.eligibilityValidated,
    updatedAt: now,
  };

  await defaultMatchRosterRef(division).set(roster, { merge: true });
}
