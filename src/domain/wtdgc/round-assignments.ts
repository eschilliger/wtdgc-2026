import type {
  MastersRosterSlot,
  OpenRosterSlot,
  WtdgcDivision,
  WtdgcRosterSlot,
  WtdgcRoundNumber,
} from "./competition";

export const MEHDI_PDGA_NUMBER = 69452 as const;

export type WtdgcGameKey = "singles-1" | "singles-2" | "doubles-1" | "doubles-2";

export type WtdgcRoundGameAssignment = {
  game: WtdgcGameKey;
  label: "Simple 1" | "Simple 2" | "Double 1" | "Double 2";
  format: "single" | "double";
  rosterSlots: readonly WtdgcRosterSlot[];
};

export type WtdgcRosterCandidate = {
  id: string;
  firstName?: string;
  lastName?: string;
  pdgaNumber?: number | null;
  gender: "M" | "F" | null;
  referenceRating?: number | null;
  rating?: number | null;
};

const OPEN_PATTERNS: Record<WtdgcRoundNumber, readonly [readonly OpenRosterSlot[], readonly OpenRosterSlot[], readonly OpenRosterSlot[], readonly OpenRosterSlot[]]> = {
  1: [["MPO2"], ["MPO3"], ["MPO1", "MPO4"], ["FPO1", "FPO2"]],
  2: [["MPO4"], ["MPO1"], ["MPO3", "FPO1"], ["MPO2", "FPO2"]],
  3: [["FPO2"], ["FPO1"], ["MPO2", "MPO4"], ["MPO1", "MPO3"]],
  4: [["MPO3"], ["MPO4"], ["MPO2", "FPO1"], ["MPO1", "FPO2"]],
  5: [["MPO1"], ["MPO2"], ["MPO3", "FPO2"], ["MPO4", "FPO1"]],
  6: [["FPO1"], ["MPO3"], ["MPO4", "FPO2"], ["MPO1", "MPO2"]],
  7: [["MPO4"], ["FPO2"], ["MPO1", "FPO1"], ["MPO2", "MPO3"]],
  8: [["MPO1"], ["FPO1"], ["MPO2", "FPO2"], ["MPO3", "MPO4"]],
};

const MASTERS_PATTERNS: Record<WtdgcRoundNumber, readonly [readonly MastersRosterSlot[], readonly MastersRosterSlot[], readonly MastersRosterSlot[], readonly MastersRosterSlot[]]> = {
  1: [["MP40-2"], ["MP40-3"], ["MP40-1", "MP50"], ["FP40-1", "FP40-2"]],
  2: [["MP50"], ["MP40-1"], ["MP40-3", "FP40-1"], ["MP40-2", "FP40-2"]],
  3: [["FP40-2"], ["FP40-1"], ["MP40-2", "MP50"], ["MP40-1", "MP40-3"]],
  4: [["MP40-3"], ["MP50"], ["MP40-2", "FP40-1"], ["MP40-1", "FP40-2"]],
  5: [["MP40-1"], ["MP40-2"], ["MP40-3", "FP40-2"], ["MP50", "FP40-1"]],
  6: [["FP40-1"], ["MP40-3"], ["MP50", "FP40-2"], ["MP40-1", "MP40-2"]],
  7: [["MP50"], ["FP40-2"], ["MP40-1", "FP40-1"], ["MP40-2", "MP40-3"]],
  8: [["MP40-1"], ["FP40-1"], ["MP40-2", "FP40-2"], ["MP40-3", "MP50"]],
};

const GAME_META = [
  { game: "singles-1", label: "Simple 1", format: "single" },
  { game: "singles-2", label: "Simple 2", format: "single" },
  { game: "doubles-1", label: "Double 1", format: "double" },
  { game: "doubles-2", label: "Double 2", format: "double" },
] as const;

function rating(candidate: WtdgcRosterCandidate) {
  return candidate.referenceRating ?? candidate.rating ?? -1;
}

function rankCandidates(candidates: WtdgcRosterCandidate[]) {
  return [...candidates].sort((a, b) => {
    const ratingGap = rating(b) - rating(a);
    if (ratingGap) return ratingGap;
    const nameA = `${a.lastName ?? ""} ${a.firstName ?? ""} ${a.id}`;
    const nameB = `${b.lastName ?? ""} ${b.firstName ?? ""} ${b.id}`;
    return nameA.localeCompare(nameB, "fr");
  });
}

export function isMehdi(candidate: Pick<WtdgcRosterCandidate, "pdgaNumber">) {
  return candidate.pdgaNumber === MEHDI_PDGA_NUMBER;
}

export function validateFranceRoster(division: WtdgcDivision, selected: WtdgcRosterCandidate[]) {
  const women = selected.filter((player) => player.gender === "F");
  const men = selected.filter((player) => player.gender === "M");
  if (division === "open") {
    return {
      complete: selected.length === 6 && men.length === 4 && women.length === 2,
      menCount: men.length,
      womenCount: women.length,
      mp40Count: 0,
      hasMehdi: men.some(isMehdi),
    };
  }
  const mp40 = men.filter((player) => !isMehdi(player));
  const mehdi = men.filter(isMehdi);
  return {
    complete: selected.length === 6 && mp40.length === 3 && mehdi.length === 1 && women.length === 2,
    menCount: men.length,
    womenCount: women.length,
    mp40Count: mp40.length,
    hasMehdi: mehdi.length === 1,
  };
}

export function slotAssignmentsFromSelection(
  division: WtdgcDivision,
  selected: WtdgcRosterCandidate[],
): Partial<Record<WtdgcRosterSlot, string>> {
  const women = rankCandidates(selected.filter((player) => player.gender === "F"));
  if (division === "open") {
    const men = rankCandidates(selected.filter((player) => player.gender === "M"));
    return {
      MPO1: men[0]?.id ?? "",
      MPO2: men[1]?.id ?? "",
      MPO3: men[2]?.id ?? "",
      MPO4: men[3]?.id ?? "",
      FPO1: women[0]?.id ?? "",
      FPO2: women[1]?.id ?? "",
    };
  }
  const mp40 = rankCandidates(selected.filter((player) => player.gender === "M" && !isMehdi(player)));
  const mehdi = selected.find(isMehdi);
  return {
    "MP40-1": mp40[0]?.id ?? "",
    "MP40-2": mp40[1]?.id ?? "",
    "MP40-3": mp40[2]?.id ?? "",
    "FP40-1": women[0]?.id ?? "",
    "FP40-2": women[1]?.id ?? "",
    MP50: mehdi?.id ?? "",
  };
}

export function roundGameAssignments(division: WtdgcDivision, roundNumber: WtdgcRoundNumber): WtdgcRoundGameAssignment[] {
  const pattern = division === "open" ? OPEN_PATTERNS[roundNumber] : MASTERS_PATTERNS[roundNumber];
  return GAME_META.map((meta, index) => ({ ...meta, rosterSlots: pattern[index] }));
}
