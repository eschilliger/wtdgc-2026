"use client";

import { useMemo, useState } from "react";
import type { ComparisonPlayer, ComparisonTeam } from "../TeamComparison";
import { ScoutingRosterPanel } from "../scouting/ScoutingRosterPanel";
import type { DefaultMatchRosterDoc } from "../../server/repositories/competition.repository";
import styles from "./DefaultOpenRoster.module.css";

function playerRating(player: ComparisonPlayer) {
  return player.referenceRating ?? player.rating ?? -1;
}

function assignmentsFromSelection(team: ComparisonTeam, selectedIds: Set<string>) {
  const selected = team.players.filter((player) => selectedIds.has(player.id));
  const men = selected.filter((player) => player.gender === "M").sort((a, b) => playerRating(b) - playerRating(a));
  const women = selected.filter((player) => player.gender === "F").sort((a, b) => playerRating(b) - playerRating(a));
  return {
    MPO1: men[0]?.id ?? "",
    MPO2: men[1]?.id ?? "",
    MPO3: men[2]?.id ?? "",
    MPO4: men[3]?.id ?? "",
    FPO1: women[0]?.id ?? "",
    FPO2: women[1]?.id ?? "",
  };
}

export function DefaultOpenRoster({ team, roster }: { team: ComparisonTeam; roster: DefaultMatchRosterDoc | null }) {
  const initialSelected = useMemo(() => new Set(
    (roster?.selectedPlayerIds?.length ? roster.selectedPlayerIds : Object.values(roster?.slotAssignments ?? {})).filter(Boolean) as string[],
  ), [roster]);
  const [selectedIds, setSelectedIds] = useState(initialSelected);
  const [confirmed, setConfirmed] = useState(Boolean(roster?.confirmed));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const selectedPlayers = team.players.filter((player) => selectedIds.has(player.id));
  const menCount = selectedPlayers.filter((player) => player.gender === "M").length;
  const womenCount = selectedPlayers.filter((player) => player.gender === "F").length;
  const complete = menCount === 4 && womenCount === 2;

  function toggle(player: ComparisonPlayer) {
    if (busy) return;
    setMessage(null);
    setConfirmed(false);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(player.id)) {
        next.delete(player.id);
        return next;
      }
      const currentPlayers = team.players.filter((candidate) => next.has(candidate.id));
      const genderCount = currentPlayers.filter((candidate) => candidate.gender === player.gender).length;
      const limit = player.gender === "F" ? 2 : 4;
      if (genderCount >= limit) {
        setMessage({ kind: "error", text: player.gender === "F" ? "Le roster Open contient 2 féminines maximum." : "Le roster Open contient 4 hommes maximum." });
        return current;
      }
      next.add(player.id);
      return next;
    });
  }

  async function save(nextConfirmed: boolean) {
    const slotAssignments = assignmentsFromSelection(team, selectedIds);
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/staff/default-roster/open", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slotAssignments, confirmed: nextConfirmed }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Enregistrement impossible.");
      setConfirmed(nextConfirmed);
      setMessage({ kind: "success", text: nextConfirmed ? "Roster confirmé." : "Brouillon enregistré." });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Enregistrement impossible." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <div>
          <h2>Roster de référence · Open</h2>
          <p>Sélectionne 4 hommes et 2 féminines.</p>
        </div>
        <span className={`${styles.status} ${confirmed ? styles.statusConfirmed : ""}`}>{confirmed ? "Confirmé" : "Brouillon"}</span>
      </div>

      <ScoutingRosterPanel
        team={team}
        selectedIds={selectedIds}
        editable
        onToggle={toggle}
        title="France"
      />

      <p className={styles.legend}>{menCount}/4 hommes · {womenCount}/2 féminines · rating WTDGC au 11/08/2026.</p>
      <div className={styles.actions}>
        <button className={styles.save} type="button" disabled={busy} onClick={() => save(false)}>Enregistrer</button>
        <button className={styles.confirm} type="button" disabled={busy || !complete} onClick={() => save(true)}>Confirmer</button>
      </div>
      {message ? <p className={`${styles.message} ${message.kind === "success" ? styles.success : styles.error}`}>{message.text}</p> : null}
    </section>
  );
}
