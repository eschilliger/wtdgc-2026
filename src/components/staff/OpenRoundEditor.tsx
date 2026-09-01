"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ComparisonPlayer } from "../TeamComparison";
import { ComparisonTeamCard } from "../comparison/ComparisonTeamCard";
import { ComparisonSummary } from "../comparison/ComparisonDuel";
import { nominalSixIds } from "../scouting/ScoutingRosterPanel";
import { StaffDivisionSwitch } from "./StaffDivisionSwitch";
import { type WtdgcRoundPublicationStatus } from "../../domain/wtdgc/competition";
import { averageEventRating, franceRoundSix, isMehdi, nominalSix, roundGameAssignments, slotAssignmentsFromSelection, validateFranceRoster } from "../../domain/wtdgc/round-assignments";
import type { RoundManagementData, RoundMatchup } from "../../server/repositories/round-management.repository";
import styles from "./OpenRoundEditor.module.css";

function statusLabel(status: WtdgcRoundPublicationStatus) { return status === "published" ? "Publié" : "Brouillon"; }
function statusClass(status: WtdgcRoundPublicationStatus) { return status === "published" ? styles.published : styles.draft; }
function rating(player: ComparisonPlayer) { return player.referenceRating ?? player.rating ?? -1; }
function playerLabel(player: ComparisonPlayer) { return `${player.firstName} ${player.lastName}`.trim(); }
function formatRating(value: number | null) { return value === null ? "—" : Number.isInteger(value) ? String(value) : value.toFixed(1); }
function signedRating(value: number | null) { return value === null ? "—" : value > 0 ? `+${formatRating(value)}` : formatRating(value); }
function fallbackRosterIds(data: RoundManagementData) {
  if (data.division === "open") return nominalSixIds(data.franceTeam);
  const men = data.franceTeam.players.filter((player) => player.gender === "M" && !isMehdi(player)).sort((a, b) => rating(b) - rating(a)).slice(0, 3);
  const mehdi = data.franceTeam.players.find(isMehdi);
  const women = data.franceTeam.players.filter((player) => player.gender === "F").sort((a, b) => rating(b) - rating(a)).slice(0, 2);
  return new Set([...men, ...(mehdi ? [mehdi] : []), ...women].map((player) => player.id));
}

function disabledIdsForSelection(data: RoundManagementData, targetIds: Set<string>) {
  const disabledIds = new Set<string>();
  for (let index = 0; index < data.franceTeam.players.length; index += 1) {
    const active = franceRoundSix(data.division, data.franceTeam.players.filter((player) => !disabledIds.has(player.id)));
    const extra = active.find((player) => !targetIds.has(player.id));
    if (!extra) break;
    disabledIds.add(extra.id);
  }
  return disabledIds;
}

export function OpenRoundEditor({ data }: { data: RoundManagementData }) {
  const initialDisabled = useMemo(() => {
    const ids = data.roster?.selectedPlayerIds?.length ? data.roster.selectedPlayerIds : data.defaultSelectedPlayerIds;
    const targetIds = ids.length ? new Set(ids) : fallbackRosterIds(data);
    return disabledIdsForSelection(data, targetIds);
  }, [data]);
  const [franceDisabledIds, setFranceDisabledIds] = useState(initialDisabled);
  const [opponentTeamId, setOpponentTeamId] = useState(data.opponentTeamId ?? "");
  const [opponentDisabledIds, setOpponentDisabledIds] = useState(new Set(data.opponentDisabledPlayerIds));
  const [opponentMp50PlayerId, setOpponentMp50PlayerId] = useState(data.opponentMp50PlayerId ?? "");
  const [scheduledStart, setScheduledStart] = useState(data.scheduledStart ?? "");
  const [course, setCourse] = useState(data.course ?? "");
  const [startingHole, setStartingHole] = useState(data.startingHole ?? "");
  const [internalNote, setInternalNote] = useState(data.internalNote);
  const [status, setStatus] = useState<WtdgcRoundPublicationStatus>(data.publicationStatus);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const selectedPlayers = franceRoundSix(data.division, data.franceTeam.players.filter((player) => !franceDisabledIds.has(player.id)));
  const selectedIds = new Set(selectedPlayers.map((player) => player.id));
  const rosterValidation = validateFranceRoster(data.division, selectedPlayers);
  const { menCount, womenCount, mp40Count, hasMehdi, complete } = rosterValidation;
  const slotAssignments = slotAssignmentsFromSelection(data.division, selectedPlayers);
  const officialGames = roundGameAssignments(data.division, data.roundNumber);
  const opponentTeam = data.teams.find((team) => team.id === opponentTeamId) ?? null;
  const opponentAvailableTeam = opponentTeam ? { ...opponentTeam, players: opponentTeam.players.filter((player) => !opponentDisabledIds.has(player.id)) } : null;
  const opponentSelectedPlayers = nominalSix(opponentAvailableTeam?.players ?? []);
  const opponentSelectedIds = new Set(opponentSelectedPlayers.map((player) => player.id));
  const effectiveOpponentMp50Id = opponentSelectedPlayers.some((player) => player.id === opponentMp50PlayerId && player.gender === "M") ? opponentMp50PlayerId : "";
  const opponentSlotAssignments = slotAssignmentsFromSelection(data.division, opponentSelectedPlayers, { mp50PlayerId: effectiveOpponentMp50Id });
  const officialMatchups = officialGames.map((game, index) => ({
    id: game.game,
    order: index + 1,
    game: game.game,
    format: game.format,
    francePlayerIds: game.rosterSlots.map((slot) => slotAssignments[slot]).filter((id): id is string => Boolean(id)),
    opponentPlayerIds: game.rosterSlots.map((slot) => opponentSlotAssignments[slot]).filter((id): id is string => Boolean(id)),
  } satisfies RoundMatchup));
  const opponentsComplete = opponentSelectedPlayers.length === 6 && (data.division === "open" || Boolean(effectiveOpponentMp50Id));
  const canPublish = complete && Boolean(opponentTeamId) && opponentsComplete && Boolean(scheduledStart);
  const divisionLabel = data.division === "open" ? "Open" : "Masters";

  function toggleFrancePlayer(player: ComparisonPlayer) {
    if (busy) return;
    setMessage(null);
    setFranceDisabledIds((current) => {
      const next = new Set(current);
      if (next.has(player.id)) next.delete(player.id); else next.add(player.id);
      return next;
    });
  }
  function toggleOpponentPlayer(playerId: string) {
    setOpponentDisabledIds((current) => {
      const next = new Set(current);
      if (next.has(playerId)) next.delete(playerId); else { next.add(playerId); if (playerId === opponentMp50PlayerId) setOpponentMp50PlayerId(""); }
      return next;
    });
  }
  function useDefaultRoster() {
    const targetIds = data.defaultSelectedPlayerIds.length ? new Set(data.defaultSelectedPlayerIds) : fallbackRosterIds(data);
    setFranceDisabledIds(disabledIdsForSelection(data, targetIds));
    setMessage(null);
  }
  function resetDuel() { useDefaultRoster(); setOpponentDisabledIds(new Set()); setOpponentMp50PlayerId(""); }

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
          opponentMp50PlayerId: effectiveOpponentMp50Id || null,
          scheduledStart: scheduledStart || null,
          course: course || null,
          startingHole: startingHole || null,
          selectedPlayerIds: selectedPlayers.map((player) => player.id),
          slotAssignments,
          matchups: officialMatchups,
          internalNote,
        }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Enregistrement impossible.");
      setStatus(nextStatus);
      setMessage({ kind: "success", text: nextStatus === "published" ? "Round publié." : "Brouillon enregistré." });
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
        <label className={styles.field}>Adversaire<select value={opponentTeamId} disabled={busy} onChange={(event) => { setOpponentTeamId(event.target.value); setOpponentDisabledIds(new Set()); setOpponentMp50PlayerId(""); }}><option value="">Non défini</option>{data.teams.map((team) => <option key={team.id} value={team.id}>{team.country}</option>)}</select></label>
        <label className={styles.field}>Départ · heure locale<input type="datetime-local" value={scheduledStart} disabled={busy} onChange={(event) => setScheduledStart(event.target.value)} /></label>
        <label className={styles.field}>Parcours / lieu<input value={course} disabled={busy} onChange={(event) => setCourse(event.target.value)} placeholder="À définir" /></label>
        <label className={styles.field}>Trou de départ<input value={startingHole} disabled={busy} onChange={(event) => setStartingHole(event.target.value)} placeholder="Ex. 1, 7A…" /></label>
      </div>

      <div className={styles.rosterActions}><span>{data.division === "open" ? `${menCount}/4 MPO · ${womenCount}/2 FPO` : `${mp40Count}/3 MP40 · ${hasMehdi ? "Mehdi MP50 ✓" : "Mehdi MP50 manquant"} · ${womenCount}/2 FP40`}</span><button className={styles.secondary} type="button" disabled={busy} onClick={useDefaultRoster}>Roster par défaut</button></div>
      <div className={`comparison-grid ${styles.comparison}`}>
        <ComparisonTeamCard team={data.franceTeam} disabledIds={franceDisabledIds} scenarioIds={selectedIds} mp50PlayerId={data.division === "masters" ? selectedPlayers.find(isMehdi)?.id : null} lockedPlayerIds={new Set(data.division === "masters" ? selectedPlayers.filter(isMehdi).map((player) => player.id) : [])} onTogglePlayer={(id) => { const player = data.franceTeam.players.find((candidate) => candidate.id === id); if (player) toggleFrancePlayer(player); }} onReset={useDefaultRoster} />
        {opponentTeam ? <ComparisonTeamCard team={opponentTeam} disabledIds={opponentDisabledIds} scenarioIds={opponentSelectedIds} mp50PlayerId={effectiveOpponentMp50Id || null} onTogglePlayer={toggleOpponentPlayer} onReset={() => { setOpponentDisabledIds(new Set()); setOpponentMp50PlayerId(""); }} /> : <article className={`team-card ${styles.emptyOpponent}`}><div className="team-card__header"><div><div className="team-card__identity"><p className="team-card__eyebrow">Adversaire</p><h3>À sélectionner</h3></div></div></div></article>}
      </div>
      {opponentTeam ? <ComparisonSummary teamA={data.franceTeam} teamB={opponentTeam} disabledA={franceDisabledIds} disabledB={opponentDisabledIds} selectedA={selectedIds} selectedB={opponentSelectedIds} onResetDuel={resetDuel} /> : null}

      {data.division === "masters" && opponentTeam ? <section className={styles.mp50Section}><div><strong>MP50 adverse</strong><span>À renseigner lorsque le Match Roster adverse est connu.</span></div><select value={effectiveOpponentMp50Id} disabled={busy} onChange={(event) => setOpponentMp50PlayerId(event.target.value)}><option value="">MP50 à définir</option>{opponentSelectedPlayers.filter((player) => player.gender === "M").map((player) => <option key={player.id} value={player.id}>{playerLabel(player)}</option>)}</select></section> : null}

      <section className={styles.matchupsSection}>
        <div className={styles.matchupsHeading}><div><p>Affectations officielles</p><h3>Simples et doubles du round</h3></div><span>Les deux compositions alimentent automatiquement les affectations selon l’ITPR.</span></div>
        {!complete ? <p className={styles.matchupsEmpty}>{data.division === "open" ? "Sélectionne 4 MPO et 2 FPO pour afficher les paires." : "Sélectionne 3 MP40, Mehdi en MP50 et 2 FP40 pour afficher les paires."}</p> : <div className={styles.matchupsList}>{officialMatchups.map((matchup, matchIndex) => {
          const game = officialGames[matchIndex];
          const francePlayers = game.rosterSlots.map((slot) => selectedPlayers.find((candidate) => candidate.id === slotAssignments[slot])).filter((player): player is ComparisonPlayer => Boolean(player));
          const opponentPlayers = game.rosterSlots.map((slot) => opponentSelectedPlayers.find((candidate) => candidate.id === opponentSlotAssignments[slot])).filter((player): player is ComparisonPlayer => Boolean(player));
          const franceAverage = francePlayers.length === game.rosterSlots.length ? averageEventRating(francePlayers) : null;
          const opponentAverage = opponentPlayers.length === game.rosterSlots.length ? averageEventRating(opponentPlayers) : null;
          const ratingGap = franceAverage !== null && opponentAverage !== null ? franceAverage - opponentAverage : null;
          return <article className={styles.matchupCard} key={matchup.id}>
            <div className={styles.matchupTop}><strong>{game.label}</strong><span className={styles.slotLabel}>{game.rosterSlots.join(" + ")}</span></div>
            <div className={styles.matchupSides}>
              <div><span>France</span><div className={styles.fixedPlayers}>{game.rosterSlots.map((slot) => { const player = selectedPlayers.find((candidate) => candidate.id === slotAssignments[slot]); return player ? <strong key={slot}>{playerLabel(player)}</strong> : <em key={slot}>{slot} à définir</em>; })}</div></div>
              <div><span>{opponentTeam?.country ?? "Adversaire à définir"}</span><div className={styles.fixedPlayers}>{game.rosterSlots.map((slot) => { const player = opponentSelectedPlayers.find((candidate) => candidate.id === opponentSlotAssignments[slot]); return player ? <strong key={slot}>{playerLabel(player)}</strong> : <em key={slot}>{slot} à définir</em>; })}</div></div>
            </div>
            <div className={styles.matchupRating}><span>{game.format === "double" ? "Rating moyen" : "Rating"} France <strong>{formatRating(franceAverage)}</strong></span><b className={ratingGap === null || ratingGap === 0 ? styles.ratingEven : ratingGap > 0 ? styles.ratingPositive : styles.ratingNegative}>Écart {signedRating(ratingGap)}</b><span>{opponentTeam?.country ?? "Adversaire"} <strong>{formatRating(opponentAverage)}</strong></span></div>
          </article>;
        })}</div>}
      </section>

      <details className={styles.notes} open={Boolean(internalNote)}><summary>Notes Staff</summary><label className={`${styles.field} ${styles.full}`}><textarea value={internalNote} disabled={busy} onChange={(event) => setInternalNote(event.target.value)} placeholder="Stratégie, points d’attention…" /></label></details>
      <div className={styles.actionHelp}><span><strong>Brouillon</strong> sauvegarde de travail, invisible aux joueurs.</span><span><strong>Publié</strong> composition complète, visible dans Mes matchs.</span></div>
      <div className={styles.actions}><button className={styles.save} type="button" disabled={busy} onClick={() => save("draft")}>{status === "published" ? "Repasser en brouillon" : "Enregistrer le brouillon"}</button><button className={styles.publishButton} type="button" disabled={busy || !canPublish} onClick={() => save("published")}>Publier</button></div>
      {message ? <p className={`${styles.message} ${message.kind === "success" ? styles.success : styles.error}`}>{message.text}</p> : null}
    </section>
  </div>;
}
