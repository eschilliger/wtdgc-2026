export const WTDGC_REFERENCE_RATING_DATE = "2026-08-11" as const;

export type WtdgcDivision = "open" | "masters";
export type WtdgcRoundNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type WtdgcUserRole = "admin" | "staff" | "player";
export type WtdgcRoundPublicationStatus = "draft" | "published";

export type WtdgcRoundStage =
  | "swiss"
  | "post-swiss";

export type WtdgcPlayerEligibility =
  | "MPO"
  | "FPO"
  | "MP40"
  | "FP40"
  | "MP50";

export type WtdgcEligibilitySource =
  | "official"
  | "captain"
  | "unknown";

export type OpenRosterSlot = "MPO1" | "MPO2" | "MPO3" | "MPO4" | "FPO1" | "FPO2";
export type MastersRosterSlot = "MP40-1" | "MP40-2" | "MP40-3" | "FP40-1" | "FP40-2" | "MP50";
export type WtdgcRosterSlot = OpenRosterSlot | MastersRosterSlot;

export const OPEN_ROSTER_SLOTS: readonly OpenRosterSlot[] = [
  "MPO1",
  "MPO2",
  "MPO3",
  "MPO4",
  "FPO1",
  "FPO2",
];

export const MASTERS_ROSTER_SLOTS: readonly MastersRosterSlot[] = [
  "MP40-1",
  "MP40-2",
  "MP40-3",
  "FP40-1",
  "FP40-2",
  "MP50",
];

export type WtdgcCompetitionRound = {
  roundNumber: WtdgcRoundNumber;
  stage: WtdgcRoundStage;
  pairingsKnownInAdvance: boolean;
  gameAssignmentsKnown: boolean;
};

/**
 * Rounds 1-6 are Swiss. After round 6, the route depends on the standings:
 * medal play-offs for the top four, additional Swiss/placement play for the rest.
 * The official round-specific Singles/Doubles assignments are modeled in
 * round-assignments.ts. Opponents and operational details remain round-specific.
 */
export const WTDGC_ROUNDS: readonly WtdgcCompetitionRound[] = [
  { roundNumber: 1, stage: "swiss", pairingsKnownInAdvance: true, gameAssignmentsKnown: true },
  { roundNumber: 2, stage: "swiss", pairingsKnownInAdvance: false, gameAssignmentsKnown: true },
  { roundNumber: 3, stage: "swiss", pairingsKnownInAdvance: false, gameAssignmentsKnown: true },
  { roundNumber: 4, stage: "swiss", pairingsKnownInAdvance: false, gameAssignmentsKnown: true },
  { roundNumber: 5, stage: "swiss", pairingsKnownInAdvance: false, gameAssignmentsKnown: true },
  { roundNumber: 6, stage: "swiss", pairingsKnownInAdvance: false, gameAssignmentsKnown: true },
  { roundNumber: 7, stage: "post-swiss", pairingsKnownInAdvance: false, gameAssignmentsKnown: true },
  { roundNumber: 8, stage: "post-swiss", pairingsKnownInAdvance: false, gameAssignmentsKnown: true },
];

export type WtdgcPlayerCompetitionData = {
  referenceRating: number | null;
  referenceRatingDate: typeof WTDGC_REFERENCE_RATING_DATE | null;
  officialRank: number | null;
  captainTieBreakOrder: number | null;
  eligibilities: WtdgcPlayerEligibility[];
  eligibilitySource: WtdgcEligibilitySource;
};

export type WtdgcMatchRoster = {
  division: WtdgcDivision;
  roundNumber: WtdgcRoundNumber | null;
  kind: "default" | "round-specific";
  selectedPlayerIds: string[];
  slotAssignments: Partial<Record<WtdgcRosterSlot, string>>;
  submittedAt: string | null;
  submissionDeadline: string | null;
  confirmed: boolean;
};

export type WtdgcRoundMatch = {
  division: WtdgcDivision;
  roundNumber: WtdgcRoundNumber;
  opponentTeamId: string | null;
  scheduledStart: string | null;
  course: string | null;
  startingHole: string | null;
  roster: WtdgcMatchRoster | null;
};

export type WtdgcRoundPublication = {
  publicationStatus: WtdgcRoundPublicationStatus;
  publishedAt: string | null;
  publishedBy: string | null;
};

export type WtdgcStaffNote = {
  text: string;
  createdAt: string;
  updatedAt: string;
  authorUid: string;
};

export function requiredRosterSlots(division: WtdgcDivision): readonly WtdgcRosterSlot[] {
  return division === "open" ? OPEN_ROSTER_SLOTS : MASTERS_ROSTER_SLOTS;
}

export function isMastersEligibilityResolved(data: Pick<WtdgcPlayerCompetitionData, "eligibilities" | "eligibilitySource">) {
  return data.eligibilitySource !== "unknown" && data.eligibilities.some((eligibility) =>
    eligibility === "MP40" || eligibility === "FP40" || eligibility === "MP50",
  );
}
