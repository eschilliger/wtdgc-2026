"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ComparisonPlayer } from "../TeamComparison";
import { ScoutingRosterPanel } from "../scouting/ScoutingRosterPanel";
import { type OpenRosterSlot, type WtdgcRoundPublicationStatus } from "../../domain/wtdgc/competition";
import type { OpenRoundManagementData } from "../../server/repositories/round-management.repository";
import styles from "./OpenRoundEditor.module.css";

function statusLabel(status: WtdgcRoundPublicationStatus) {
  return status === "published" ? "Publié" : status === "ready" ? "Prêt" : "Brouillon";
}

function statusClass(status: WtdgcRoundPublicationStatus) {
  return status === "published" ? styles.published : status === "ready" ? styles.ready : styles.draft;
}

function rating(player: ComparisonPlayer) {
  return player.referenceRating ?? player.rating ?? -1;
}

function selectionFromAssignments(source: Partial<Record<OpenRosterSlot, string>>) {
  return new Set(Object.values(source).filter((value): value is string => Boolean(value)));
}

function assignmentsFromSelection(players: ComparisonPlayer[], selectedIds: Set<string>) {
  const selected = players.filter((player) => selectedIds.has(player.id));
  const men = selected.filter((player) => player.gender === "M").sort((a, b) => rating(b) - rating(a));
  const women = selected.filter((player) => player.gender === "F").sort((a, b) => rating(b) - rating(a));
  return {
    MPO1: men[0]?.id ?? "",
    MPO2: men[1]?.id ?? "",
    MPO3: men[2]?.id ?? "",
    MPO4: men[3]?.id ?? "",
    FPO1: women[0]?.id ?? "",
    FPO2: women[1]?.id ?? "",
  };
}

export function OpenRoundEditor({ data }: { data: OpenRoundManagementData }) {
  const initialSelected = useMemo(
    () => selectionFromAssignments(data.roster?.slotAssignments ?? data.defaultSlotAssignments),
    [data.roster, data.defaultSlotAssignments],
  );
  const [selectedIds, setSelectedIds] = useState(initialSelected);
  const [opponentTeamId, setOpponentTeamId] = useState(data.opponentTeamId ?? "");
  const [scheduledStart, setScheduledStart] = useState(data.scheduledStart ?? "");
  const [course, setCourse] = useState(data.course ?? "");
  const [startingHole, setStartingHole] = useState(data.startingHole ?? "");
  const [internalNote, setInternalNote] = useState(data.internalNote);
  const [status, setStatus] = useState<WtdgcRoundPublicationStatus>(data.publicationStatus);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const selectedPlayers = data.franceTeam.players.filter((player) => selectedIds.has(player.id));
  const menCount = selectedPlayers.filter((player) => player.gender === "M").length;
  const womenCount = selectedPlayers.filter((player) => player.gender === "F").length;
  const complete = menCount === 4 && womenCount === 2;
  const canReady = complete && Boolean(opponentTeamId);
  const canPublish = canReady && Boolean(scheduledStart);
  const opponentTeam = data.teams.find((team) => team.id === opponentTeamId) ?? null;

  function toggleFrancePlayer(player: ComparisonPlayer) {
    if (busy) return;
    setMessage(null);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(player.id)) {
        next.delete(player.id);
        return next;
      }
      const currentPlayers = data.franceTeam.players.filter((candidate) => next.has(candidate.id));
      const count = currentPlayers.filter((candidate) => candidate.gender === player.gender).length;
      const limit = player.gender === "F" ? 2 : 4;
      if (count >= limit) {
        setMessage({ kind: "error", text: player.gender === "F" ? "Le match Open utilise 2 féminines." : "Le match Open utilise 4 hommes." });
        return current;
      }
      next.add(player.id);
      return next;
    });
  }

  function useDefaultRoster() {
    setSelectedIds(selectionFromAssignments(data.defaultSlotAssignments));
    setMessage(null);
  }

  async function save(nextStatus: WtdgcRoundPublicationStatus) {
    if (nextStatus === "published" && !window.confirm("Publier ce round ?")) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/staff/rounds/open/${data.roundNumber}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          publicationStatus: nextStatus,
          opponentTeamId: opponentTeamId || null,
          scheduledStart: scheduledStart || null,
          course: course || null,
          startingHole: startingHole || null,
          slotAssignments: assignmentsFromSelection(data.franceTeam.players, selectedIds),
          internalNote,
        }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Enregistrement impossible.");
      setStatus(nextStatus);
      setMessage({ kind: "success", text: nextStatus === "published" ? "Round publié." : nextStatus === "ready" ? "Round prêt." : "Brouillon enregistré." });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Enregistrement impossible." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <Link className={styles.back} href="/staff">← Staff</Link>
        <nav className={styles.roundNav} aria-label="Rounds Open">
          {Array.from({ length: 8 }, (_, index) => index + 1).map((round) => <Link key={round} href={`/staff/rounds/open/${round}`} aria-current={round === data.roundNumber ? "page" : undefined}>R{round}</Link>)}
        </nav>
      </div>

      <section className={styles.card}>
        <div className={styles.header}>
          <div><h2>Open · Round {data.roundNumber}</h2></div>
          <span className={`${styles.status} ${statusClass(status)}`}>{statusLabel(status)}</span>
        </div>

        <div className={styles.metaGrid}>
          <label className={styles.field}>Adversaire
            <select value={opponentTeamId} disabled={busy} onChange={(event) => setOpponentTeamId(event.target.value)}>
              <option value="">Non défini</option>
              {data.teams.map((team) => <option key={team.id} value={team.id}>{team.country}</option>)}
            </select>
          </label>
          <label className={styles.field}>Départ · heure locale
            <input type="datetime-local" value={scheduledStart} disabled={busy} onChange={(event) => setScheduledStart(event.target.value)} />
          </label>
          <label className={styles.field}>Parcours / lieu<input value={course} disabled={busy} onChange={(event) => setCourse(event.target.value)} placeholder="À définir" /></label>
          <label className={styles.field}>Trou de départ<input value={startingHole} disabled={busy} onChange={(event) => setStartingHole(event.target.value)} placeholder="Ex. 1, 7A…" /></label>
        </div>

        <div className={styles.rosterActions}>
          <span>{menCount}/4 hommes · {womenCount}/2 féminines</span>
          <button className={styles.secondary} type="button" disabled={busy} onClick={useDefaultRoster}>Roster par défaut</button>
        </div>

        <div className={`comparison-grid ${styles.comparison}`}>
          <ScoutingRosterPanel team={data.franceTeam} selectedIds={selectedIds} editable onToggle={toggleFrancePlayer} title="France" />
          {opponentTeam ? (
            <ScoutingRosterPanel team={opponentTeam} title={opponentTeam.country} />
          ) : (
            <article className={`team-card ${styles.emptyOpponent}`}><div className="team-card__header"><div><span className="team-country-kicker">Adversaire</span><h3>À sélectionner</h3></div></div></article>
          )}
        </div>

        <details className={styles.notes} open={Boolean(internalNote)}>
          <summary>Notes Staff</summary>
          <label className={`${styles.field} ${styles.full}`}>
            <textarea value={internalNote} disabled={busy} onChange={(event) => setInternalNote(event.target.value)} placeholder="Stratégie, points d’attention…" />
          </label>
        </details>

        <div className={styles.actions}>
          <button className={styles.save} type="button" disabled={busy} onClick={() => save("draft")}>{status === "published" ? "Brouillon" : "Enregistrer"}</button>
          <button className={styles.readyButton} type="button" disabled={busy || !canReady} onClick={() => save("ready")}>Prêt</button>
          <button className={styles.publishButton} type="button" disabled={busy || !canPublish} onClick={() => save("published")}>Publier</button>
        </div>
        {message ? <p className={`${styles.message} ${message.kind === "success" ? styles.success : styles.error}`}>{message.text}</p> : null}
      </section>
    </div>
  );
}
