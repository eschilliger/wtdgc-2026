"use client";

import type { ComparisonPlayer, ComparisonTeam } from "../TeamComparison";
import { ComparisonTeamCard, compareByReference } from "../comparison/ComparisonTeamCard";

export function nominalSixIds(team: ComparisonTeam) {
  const men = team.players.filter((player) => player.gender === "M").sort(compareByReference).slice(0, 4);
  const women = team.players.filter((player) => player.gender === "F").sort(compareByReference).slice(0, 2);
  return new Set([...men, ...women].map((player) => player.id));
}

export function ScoutingRosterPanel({
  team,
  selectedIds,
  editable = false,
  onToggle,
}: {
  team: ComparisonTeam;
  selectedIds?: Set<string>;
  editable?: boolean;
  onToggle?: (player: ComparisonPlayer) => void;
  title?: string;
  helper?: string;
}) {
  const activeIds = selectedIds ?? nominalSixIds(team);
  const playersById = new Map(team.players.map((player) => [player.id, player] as const));

  return (
    <ComparisonTeamCard
      team={team}
      selectedIds={activeIds}
      onTogglePlayer={(playerId) => {
        const player = playersById.get(playerId);
        if (player) onToggle?.(player);
      }}
      onReset={() => undefined}
      interactionDisabled={!editable}
    />
  );
}
