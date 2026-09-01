import assert from "node:assert/strict";
import { roundGameAssignments, slotAssignmentsFromSelection, validateFranceRoster } from "../src/domain/wtdgc/round-assignments";
import type { WtdgcDivision, WtdgcRoundNumber } from "../src/domain/wtdgc/competition";
import { officialRoundMatchups } from "../src/server/wtdgc/round-roster";

const expected: Record<WtdgcDivision, string[]> = {
  open: [
    "MPO2|MPO3|MPO1+MPO4|FPO1+FPO2", "MPO4|MPO1|MPO3+FPO1|MPO2+FPO2",
    "FPO2|FPO1|MPO2+MPO4|MPO1+MPO3", "MPO3|MPO4|MPO2+FPO1|MPO1+FPO2",
    "MPO1|MPO2|MPO3+FPO2|MPO4+FPO1", "FPO1|MPO3|MPO4+FPO2|MPO1+MPO2",
    "MPO4|FPO2|MPO1+FPO1|MPO2+MPO3", "MPO1|FPO1|MPO2+FPO2|MPO3+MPO4",
  ],
  masters: [
    "MP40-2|MP40-3|MP40-1+MP50|FP40-1+FP40-2", "MP50|MP40-1|MP40-3+FP40-1|MP40-2+FP40-2",
    "FP40-2|FP40-1|MP40-2+MP50|MP40-1+MP40-3", "MP40-3|MP50|MP40-2+FP40-1|MP40-1+FP40-2",
    "MP40-1|MP40-2|MP40-3+FP40-2|MP50+FP40-1", "FP40-1|MP40-3|MP50+FP40-2|MP40-1+MP40-2",
    "MP50|FP40-2|MP40-1+FP40-1|MP40-2+MP40-3", "MP40-1|FP40-1|MP40-2+FP40-2|MP40-3+MP50",
  ],
};

for (const division of ["open", "masters"] as const) {
  for (let round = 1; round <= 8; round += 1) {
    const games = roundGameAssignments(division, round as WtdgcRoundNumber);
    assert.equal(games.map((game) => game.rosterSlots.join("+")).join("|"), expected[division][round - 1]);
    assert.deepEqual(games.map((game) => game.format), ["single", "single", "double", "double"]);
    assert.equal(new Set(games.flatMap((game) => game.rosterSlots)).size, 6);
  }
}

const openPlayers = [
  { id: "m1", gender: "M" as const, rating: 1000 }, { id: "m2", gender: "M" as const, rating: 990 },
  { id: "m3", gender: "M" as const, rating: 980 }, { id: "m4", gender: "M" as const, rating: 970 },
  { id: "f1", gender: "F" as const, rating: 950 }, { id: "f2", gender: "F" as const, rating: 940 },
];
assert.equal(validateFranceRoster("open", openPlayers).complete, true);
assert.deepEqual(slotAssignmentsFromSelection("open", openPlayers), { MPO1: "m1", MPO2: "m2", MPO3: "m3", MPO4: "m4", FPO1: "f1", FPO2: "f2" });

const mastersPlayers = [
  { id: "mp1", gender: "M" as const, rating: 980, pdgaNumber: 1 }, { id: "mp2", gender: "M" as const, rating: 970, pdgaNumber: 2 },
  { id: "mp3", gender: "M" as const, rating: 960, pdgaNumber: 3 }, { id: "mehdi", gender: "M" as const, rating: 990, pdgaNumber: 69452 },
  { id: "fp1", gender: "F" as const, rating: 940 }, { id: "fp2", gender: "F" as const, rating: 930 },
];
assert.equal(validateFranceRoster("masters", mastersPlayers).complete, true);
assert.deepEqual(slotAssignmentsFromSelection("masters", mastersPlayers), { "MP40-1": "mp1", "MP40-2": "mp2", "MP40-3": "mp3", "FP40-1": "fp1", "FP40-2": "fp2", MP50: "mehdi" });
assert.equal(validateFranceRoster("masters", mastersPlayers.map((player) => player.id === "mehdi" ? { ...player, pdgaNumber: 4 } : player)).complete, false);

const roundOne = officialRoundMatchups({
  division: "open",
  roundNumber: 1,
  value: [
    { game: "singles-1", opponentPlayerIds: ["o1"] }, { game: "singles-2", opponentPlayerIds: ["o2"] },
    { game: "doubles-1", opponentPlayerIds: ["o3", "o4"] }, { game: "doubles-2", opponentPlayerIds: ["o5", "o6"] },
  ],
  slotAssignments: slotAssignmentsFromSelection("open", openPlayers),
  opponentIds: new Set(["o1", "o2", "o3", "o4", "o5", "o6"]),
  disabledOpponentIds: new Set(),
});
assert.deepEqual(roundOne?.map((matchup) => matchup.francePlayerIds), [["m2"], ["m3"], ["m1", "m4"], ["f1", "f2"]]);
assert.deepEqual(roundOne?.flatMap((matchup) => matchup.opponentPlayerIds), ["o1", "o2", "o3", "o4", "o5", "o6"]);

console.log("Round assignments: OK");
