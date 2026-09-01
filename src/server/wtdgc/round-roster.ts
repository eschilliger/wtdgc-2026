import type { WtdgcDivision, WtdgcRosterSlot, WtdgcRoundNumber } from "../../domain/wtdgc/competition";
import { roundGameAssignments } from "../../domain/wtdgc/round-assignments";
import type { RoundMatchup } from "../repositories/round-management.repository";

export function officialRoundMatchups(input: {
  division: WtdgcDivision;
  roundNumber: WtdgcRoundNumber;
  value: unknown;
  slotAssignments: Partial<Record<WtdgcRosterSlot, string>>;
  opponentIds: Set<string>;
  disabledOpponentIds: Set<string>;
}): RoundMatchup[] | null {
  if (input.value !== undefined && !Array.isArray(input.value)) return null;
  const rawMatchups = Array.isArray(input.value) ? input.value : [];
  const games = roundGameAssignments(input.division, input.roundNumber);

  return games.map((game, index) => {
    const byKey = rawMatchups.find((entry) => entry && typeof entry === "object" && (entry as { game?: unknown }).game === game.game);
    const raw = (byKey ?? rawMatchups[index]) as { opponentPlayerIds?: unknown } | undefined;
    const size = game.format === "single" ? 1 : 2;
    const opponentPlayerIds = Array.isArray(raw?.opponentPlayerIds)
      ? [...new Set(raw.opponentPlayerIds.filter((id): id is string =>
        typeof id === "string" && input.opponentIds.has(id) && !input.disabledOpponentIds.has(id),
      ))].slice(0, size)
      : [];
    return {
      id: game.game,
      order: index + 1,
      game: game.game,
      format: game.format,
      francePlayerIds: game.rosterSlots
        .map((slot) => input.slotAssignments[slot])
        .filter((id): id is string => Boolean(id)),
      opponentPlayerIds,
    };
  });
}
