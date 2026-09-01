import type { WtdgcDivision, WtdgcRosterSlot, WtdgcRoundNumber } from "../../domain/wtdgc/competition";
import { roundGameAssignments } from "../../domain/wtdgc/round-assignments";
import type { RoundMatchup } from "../repositories/round-management.repository";

export function officialRoundMatchups(input: {
  division: WtdgcDivision;
  roundNumber: WtdgcRoundNumber;
  slotAssignments: Partial<Record<WtdgcRosterSlot, string>>;
  opponentSlotAssignments: Partial<Record<WtdgcRosterSlot, string>>;
}): RoundMatchup[] {
  const games = roundGameAssignments(input.division, input.roundNumber);

  return games.map((game, index) => {
    return {
      id: game.game,
      order: index + 1,
      game: game.game,
      format: game.format,
      francePlayerIds: game.rosterSlots
        .map((slot) => input.slotAssignments[slot])
        .filter((id): id is string => Boolean(id)),
      opponentPlayerIds: game.rosterSlots
        .map((slot) => input.opponentSlotAssignments[slot])
        .filter((id): id is string => Boolean(id)),
    };
  });
}
