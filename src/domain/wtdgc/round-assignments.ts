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

export type MastersSlotOptions = {
  mp50PlayerId?: string | null;
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

function rankCandidates<T extends WtdgcRosterCandidate>(candidates: T[]): T[] {
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

export function nominalSix<T extends WtdgcRosterCandidate>(candidates: T[]): T[] {
  const men = rankCandidates(candidates.filter((player) => player.gender === "M")).slice(0, 4);
  const women = rankCandidates(candidates.filter((player) => player.gender === "F")).slice(0, 2);
  return [...men, ...women];
}

export function franceRoundSix<T extends WtdgcRosterCandidate>(division: WtdgcDivision, candidates: T[]): T[] {
  if (division === "open") return nominalSix(candidates);
  const mehdi = candidates.find(isMehdi);
  const mp40 = rankCandidates(candidates.filter((player) => player.gender === "M" && !isMehdi(player))).slice(0, 3);
  const fp40 = rankCandidates(candidates.filter((player) => player.gender === "F")).slice(0, 2);
  return [...mp40, ...(mehdi ? [mehdi] : []), ...fp40];
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
  options: MastersSlotOptions = {},
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
  const mp50ExplicitlyAssigned = Object.prototype.hasOwnProperty.call(options, "mp50PlayerId");
  const mp50 = mp50ExplicitlyAssigned
    ? selected.find((player) => player.id === options.mp50PlayerId && player.gender === "M")
    : selected.find(isMehdi);
  const mp40 = mp50ExplicitlyAssigned && !mp50
    ? []
    : rankCandidates(selected.filter((player) => player.gender === "M" && player.id !== mp50?.id));
  return {
    "MP40-1": mp40[0]?.id ?? "",
    "MP40-2": mp40[1]?.id ?? "",
    "MP40-3": mp40[2]?.id ?? "",
    "FP40-1": women[0]?.id ?? "",
    "FP40-2": women[1]?.id ?? "",
    MP50: mp50?.id ?? "",
  };
}

export function positionLabels(
  division: WtdgcDivision,
  selected: WtdgcRosterCandidate[],
  allPlayers: WtdgcRosterCandidate[],
  options: MastersSlotOptions = {},
) {
  const labels = new Map<string, string>();
  const selectedIds = new Set(selected.map((player) => player.id));
  if (division === "open") {
    const selectedMpo = rankCandidates(selected.filter((player) => player.gender === "M"));
    const selectedFpo = rankCandidates(selected.filter((player) => player.gender === "F"));
    allPlayers.filter((player) => player.gender === "M").forEach((player) => labels.set(player.id, selectedIds.has(player.id) ? `MPO${selectedMpo.findIndex((item) => item.id === player.id) + 1}` : "Rempl. MPO"));
    allPlayers.filter((player) => player.gender === "F").forEach((player) => labels.set(player.id, selectedIds.has(player.id) ? `FPO${selectedFpo.findIndex((item) => item.id === player.id) + 1}` : "Rempl. FPO"));
    return labels;
  }

  const mp50Id = options.mp50PlayerId ?? selected.find(isMehdi)?.id ?? null;
  const selectedMp40 = rankCandidates(selected.filter((player) => player.gender === "M" && player.id !== mp50Id));
  const selectedFp40 = rankCandidates(selected.filter((player) => player.gender === "F"));
  for (const player of allPlayers.filter((item) => item.gender === "M")) {
    if (player.id === mp50Id) labels.set(player.id, selectedIds.has(player.id) ? "MP50" : "Rempl. MP50");
    else if (!mp50Id && selectedIds.has(player.id)) labels.set(player.id, "MP40 / MP50");
    else if (!mp50Id) labels.set(player.id, "Rempl. MP40 / MP50");
    else labels.set(player.id, selectedIds.has(player.id) ? `MP40-${selectedMp40.findIndex((item) => item.id === player.id) + 1}` : "Rempl. MP40");
  }
  allPlayers.filter((player) => player.gender === "F").forEach((player) => labels.set(player.id, selectedIds.has(player.id) ? `FP40-${selectedFp40.findIndex((item) => item.id === player.id) + 1}` : "Rempl. FP40"));
  return labels;
}

export function roundGameAssignments(division: WtdgcDivision, roundNumber: WtdgcRoundNumber): WtdgcRoundGameAssignment[] {
  const pattern = division === "open" ? OPEN_PATTERNS[roundNumber] : MASTERS_PATTERNS[roundNumber];
  return GAME_META.map((meta, index) => ({ ...meta, rosterSlots: pattern[index] }));
}
