"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ComparisonPlayer } from "../TeamComparison";
import { ComparisonTeamCard } from "../comparison/ComparisonTeamCard";
import { ComparisonSummary, LineupMatchups } from "../comparison/ComparisonDuel";
import { nominalSixIds } from "../scouting/ScoutingRosterPanel";
import { StaffDivisionSwitch } from "./StaffDivisionSwitch";
import { type WtdgcRoundPublicationStatus } from "../../domain/wtdgc/competition";
import { isMehdi, roundGameAssignments, slotAssignmentsFromSelection, validateFranceRoster } from "../../domain/wtdgc/round-assignments";
import type { RoundManagementData, RoundMatchup } from "../../server/repositories/round-management.repository";
import styles from "./OpenRoundEditor.module.css";

function statusLabel(status: WtdgcRoundPublicationStatus) { return status === "published" ? "Publié" : status === "ready" ? "Prêt" : "Brouillon"; }
function statusClass(status: WtdgcRoundPublicationStatus) { return status === "published" ? styles.published : status === "ready" ? styles.ready : styles.draft; }
function rating(player: ComparisonPlayer) { return player.referenceRating ?? player.rating ?? -1; }
function playerLabel(player: ComparisonPlayer) { return `${player.firstName} ${player.lastName}`.trim(); }
function fallbackRosterIds(data: RoundManagementData) {
  if (data.division === "open") return nominalSixIds(data.franceTeam);
  const men = data.franceTeam.players.filter((player) => player.gender === "M" && !isMehdi(player)).sort((a, b) => rating(b) - rating(a)).slice(0, 3);
  const mehdi = data.franceTeam.players.find(isMehdi);
  const women = data.franceTeam.players.filter((player) => player.gender === "F").sort((a, b) => rating(b) - rating(a)).slice(0, 2);
  return new Set([...men, ...(mehdi ? [mehdi] : []), ...women].map((player) => player.id));
}

export function OpenRoundEditor({ data }: { data: RoundManagementData }) {
  const initialSelected = useMemo(() => {
    const ids = data.roster?.selectedPlayerIds?.length ? data.roster.selectedPlayerIds : data.defaultSelectedPlayerIds;
    return ids.length ? new Set(ids) : fallbackRosterIds(data);
  }, [data]);
  const [selectedIds, setSelectedIds] = useState(initialSelected);
  const [opponentTeamId, setOpponentTeamId] = useState(data.opponentTeamId ?? "");
  const [opponentDisabledIds, setOpponentDisabledIds] = useState(new Set(data.opponentDisabledPlayerIds));
  const [scheduledStart, setScheduledStart] = useState(data.scheduledStart ?? "");
  const [course, setCourse] = useState(data.course ?? "");
  const [startingHole, setStartingHole] = useState(data.startingHole ?? "");
  const [matchups, setMatchups] = useState<RoundMatchup[]>(data.matchups);
  const [internalNote, setInternalNote] = useState(data.internalNote);
  const [status, setStatus] = useState<WtdgcRoundPublicationStatus>(data.publicationStatus);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const selectedPlayers = data.franceTeam.players.filter((player) => selectedIds.has(player.id));
  const rosterValidation = validateFranceRoster(data.division, selectedPlayers);
  const { menCount, womenCount, mp40Count, hasMehdi, complete } = rosterValidation;
  const slotAssignments = slotAssignmentsFromSelection(data.division, selectedPlayers);
  const officialGames = roundGameAssignments(data.division, data.roundNumber);
  const officialMatchups = officialGames.map((game, index) => {
    const saved = matchups.find((matchup) => matchup.game === game.game) ?? matchups[index];
    return {
      id: game.game,
      order: index + 1,
      game: game.game,
      format: game.format,
      francePlayerIds: game.rosterSlots.map((slot) => slotAssignments[slot]).filter((id): id is string => Boolean(id)),
      opponentPlayerIds: saved?.opponentPlayerIds?.slice(0, game.format === "single" ? 1 : 2) ?? [],
    } satisfies RoundMatchup;
  });
  const opponentTeam = data.teams.find((team) => team.id === opponentTeamId) ?? null;
  const opponentAvailableTeam = opponentTeam ? { ...opponentTeam, players: opponentTeam.players.filter((player) => !opponentDisabledIds.has(player.id)) } : null;
  const opponentMatchPlayers = opponentAvailableTeam?.players ?? [];
  const opponentSelections = officialMatchups.flatMap((matchup) => matchup.opponentPlayerIds);
  const opponentsComplete = opponentSelections.length === 6 && new Set(opponentSelections).size === 6;
  const canReady = complete && Boolean(opponentTeamId) && opponentsComplete;
  const canPublish = canReady && Boolean(scheduledStart);
  const divisionLabel = data.division === "open" ? "Open" : "Masters";

  function toggleFrancePlayer(player: ComparisonPlayer) {
    if (busy) return;
    setMessage(null);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(player.id)) { next.delete(player.id); return next; }
      const currentPlayers = data.franceTeam.players.filter((candidate) => next.has(candidate.id));
      const count = currentPlayers.filter((candidate) => candidate.gender === player.gender).length;
      const mastersMp40Count = currentPlayers.filter((candidate) => candidate.gender === "M" && !isMehdi(candidate)).length;
      const limit = player.gender === "F" ? 2 : data.division === "masters" && !isMehdi(player) ? 3 : 4;
      const effectiveCount = data.division === "masters" && player.gender === "M" && !isMehdi(player) ? mastersMp40Count : count;
      if (effectiveCount >= limit) {
        setMessage({ kind: "error", text: player.gender === "F" ? "La composition utilise déjà 2 joueuses." : data.division === "masters" ? "La composition utilise déjà 3 MP40." : "La composition utilise déjà 4 MPO." });
        return current;
      }
      next.add(player.id);
      return next;
    });
  }
  function toggleOpponentPlayer(playerId: string) {
    setOpponentDisabledIds((current) => { const next = new Set(current); if (next.has(playerId)) next.delete(playerId); else next.add(playerId); return next; });
  }
  function useDefaultRoster() {
    setSelectedIds(data.defaultSelectedPlayerIds.length ? new Set(data.defaultSelectedPlayerIds) : fallbackRosterIds(data));
    setMessage(null);
  }
  function resetDuel() { useDefaultRoster(); setOpponentDisabledIds(new Set()); }
  function setOpponentPlayer(id: string, index: number, playerId: string) {
    setMatchups(officialMatchups.map((item) => {
      const withoutDuplicate = playerId && item.id !== id ? item.opponentPlayerIds.filter((value) => value !== playerId) : item.opponentPlayerIds;
      if (item.id !== id) return { ...item, opponentPlayerIds: withoutDuplicate };
      const next = [...withoutDuplicate];
      if (playerId) next[index] = playerId; else next.splice(index, 1);
      return { ...item, opponentPlayerIds: next.filter(Boolean) };
    }));
  }

  async function save(nextStatus: WtdgcRoundPublicationStatus) {
    if (nextStatus === "published" && !window.confirm("Publier ce round ?")) return;
    setBusy(true); setMessage(null);
    try {
      const response = await fetch(`/api/staff/rounds/${data.division}/${data.roundNumber}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          publicationStatus: nextStatus,
          opponentTeamId: opponentTeamId || null,
          opponentDisabledPlayerIds: [...opponentDisabledIds],
          scheduledStart: scheduledStart || null,
          course: course || null,
          startingHole: startingHole || null,
          selectedPlayerIds: [...selectedIds],
          slotAssignments,
          matchups: officialMatchups,
          internalNote,
        }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Enregistrement impossible.");
      setStatus(nextStatus);
      setMessage({ kind: "success", text: nextStatus === "published" ? "Round publié." : nextStatus === "ready" ? "Round prêt." : "Brouillon enregistré." });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Enregistrement impossible." });
    } finally { setBusy(false); }
  }

  return <div className={styles.page}>
    <div className={styles.topbar}>
      <Link className={styles.back} href={`/staff?division=${data.division}`}>← Staff</Link>
      <StaffDivisionSwitch division={data.division} roundNumber={data.roundNumber} />
      <nav className={styles.roundNav} aria-label={`Rounds ${divisionLabel}`}>{Array.from({ length: 8 }, (_, index) => index + 1).map((round) => <Link key={round} href={`/staff/rounds/${data.division}/${round}`} aria-current={round === data.roundNumber ? "page" : undefined}>R{round}</Link>)}</nav>
    </div>

    <section className={styles.card}>
      <div className={styles.header}><div><h2>{divisionLabel} · Round {data.roundNumber}</h2></div><span className={`${styles.status} ${statusClass(status)}`}>{statusLabel(status)}</span></div>
      <div className={styles.metaGrid}>
        <label className={styles.field}>Adversaire<select value={opponentTeamId} disabled={busy} onChange={(event) => { setOpponentTeamId(event.target.value); setOpponentDisabledIds(new Set()); setMatchups([]); }}><option value="">Non défini</option>{data.teams.map((team) => <option key={team.id} value={team.id}>{team.country}</option>)}</select></label>
        <label className={styles.field}>Départ · heure locale<input type="datetime-local" value={scheduledStart} disabled={busy} onChange={(event) => setScheduledStart(event.target.value)} /></label>
        <label className={styles.field}>Parcours / lieu<input value={course} disabled={busy} onChange={(event) => setCourse(event.target.value)} placeholder="À définir" /></label>
        <label className={styles.field}>Trou de départ<input value={startingHole} disabled={busy} onChange={(event) => setStartingHole(event.target.value)} placeholder="Ex. 1, 7A…" /></label>
      </div>

      <div className={styles.rosterActions}><span>{data.division === "open" ? `${menCount}/4 MPO · ${womenCount}/2 FPO` : `${mp40Count}/3 MP40 · ${hasMehdi ? "Mehdi MP50 ✓" : "Mehdi MP50 manquant"} · ${womenCount}/2 FP40`}</span><button className={styles.secondary} type="button" disabled={busy} onClick={useDefaultRoster}>Roster par défaut</button></div>
      <div className={`comparison-grid ${styles.comparison}`}>
        <ComparisonTeamCard team={data.franceTeam} selectedIds={selectedIds} onTogglePlayer={(id) => { const player = data.franceTeam.players.find((candidate) => candidate.id === id); if (player) toggleFrancePlayer(player); }} onReset={useDefaultRoster} />
        {opponentTeam ? <ComparisonTeamCard team={opponentTeam} disabledIds={opponentDisabledIds} onTogglePlayer={toggleOpponentPlayer} onReset={() => setOpponentDisabledIds(new Set())} /> : <article className={`team-card ${styles.emptyOpponent}`}><div className="team-card__header"><div><div className="team-card__identity"><p className="team-card__eyebrow">Adversaire</p><h3>À sélectionner</h3></div></div></div></article>}
      </div>
      {opponentTeam ? <><ComparisonSummary teamA={data.franceTeam} teamB={opponentTeam} disabledA={new Set()} disabledB={opponentDisabledIds} selectedA={selectedIds} onResetDuel={resetDuel} /><LineupMatchups teamA={data.franceTeam} teamB={opponentTeam} disabledA={new Set()} disabledB={opponentDisabledIds} selectedA={selectedIds} /></> : null}

      <section className={styles.matchupsSection}>
        <div className={styles.matchupsHeading}><div><p>Affectations officielles</p><h3>Simples et doubles du round</h3></div><span>La composition France est calculée automatiquement selon l’ITPR.</span></div>
        {!complete ? <p className={styles.matchupsEmpty}>{data.division === "open" ? "Sélectionne 4 MPO et 2 FPO pour afficher les paires." : "Sélectionne 3 MP40, Mehdi en MP50 et 2 FP40 pour afficher les paires."}</p> : <div className={styles.matchupsList}>{officialMatchups.map((matchup, matchIndex) => {
          const slots = matchup.format === "single" ? 1 : 2;
          const game = officialGames[matchIndex];
          return <article className={styles.matchupCard} key={matchup.id}>
            <div className={styles.matchupTop}><strong>{game.label}</strong><span className={styles.slotLabel}>{game.rosterSlots.join(" + ")}</span></div>
            <div className={styles.matchupSides}>
              <div><span>France</span><div className={styles.fixedPlayers}>{matchup.francePlayerIds.map((playerId) => <strong key={playerId}>{playerLabel(selectedPlayers.find((player) => player.id === playerId)!)}</strong>)}</div></div>
              <div><span>{opponentTeam?.country ?? "Adversaire à définir"}</span>{Array.from({ length: slots }, (_, index) => <select key={index} value={matchup.opponentPlayerIds[index] ?? ""} disabled={busy || !opponentTeam} onChange={(event) => setOpponentPlayer(matchup.id, index, event.target.value)}><option value="">Joueur {index + 1}</option>{opponentMatchPlayers.filter((player) => !opponentSelections.includes(player.id) || matchup.opponentPlayerIds[index] === player.id).map((player) => <option key={player.id} value={player.id}>{playerLabel(player)}</option>)}</select>)}</div>
            </div>
          </article>;
        })}</div>}
      </section>

      <details className={styles.notes} open={Boolean(internalNote)}><summary>Notes Staff</summary><label className={`${styles.field} ${styles.full}`}><textarea value={internalNote} disabled={busy} onChange={(event) => setInternalNote(event.target.value)} placeholder="Stratégie, points d’attention…" /></label></details>
      <div className={styles.actions}><button className={styles.save} type="button" disabled={busy} onClick={() => save("draft")}>{status === "published" ? "Brouillon" : "Enregistrer"}</button><button className={styles.readyButton} type="button" disabled={busy || !canReady} onClick={() => save("ready")}>Prêt</button><button className={styles.publishButton} type="button" disabled={busy || !canPublish} onClick={() => save("published")}>Publier</button></div>
      {message ? <p className={`${styles.message} ${message.kind === "success" ? styles.success : styles.error}`}>{message.text}</p> : null}
    </section>
  </div>;
}
