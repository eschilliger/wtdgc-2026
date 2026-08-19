"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ComparisonPlayer } from "../TeamComparison";
import { ComparisonTeamCard } from "../comparison/ComparisonTeamCard";
import { ComparisonSummary, LineupMatchups } from "../comparison/ComparisonDuel";
import { nominalSixIds } from "../scouting/ScoutingRosterPanel";
import { StaffDivisionSwitch } from "./StaffDivisionSwitch";
import { type OpenRosterSlot, type WtdgcRoundPublicationStatus } from "../../domain/wtdgc/competition";
import type { RoundManagementData, RoundMatchup } from "../../server/repositories/round-management.repository";
import styles from "./OpenRoundEditor.module.css";

function statusLabel(status: WtdgcRoundPublicationStatus) { return status === "published" ? "Publié" : status === "ready" ? "Prêt" : "Brouillon"; }
function statusClass(status: WtdgcRoundPublicationStatus) { return status === "published" ? styles.published : status === "ready" ? styles.ready : styles.draft; }
function rating(player: ComparisonPlayer) { return player.referenceRating ?? player.rating ?? -1; }
function playerLabel(player: ComparisonPlayer) { return `${player.firstName} ${player.lastName}`.trim(); }
function assignmentsFromSelection(players: ComparisonPlayer[], selectedIds: Set<string>) {
  const selected = players.filter((player) => selectedIds.has(player.id));
  const men = selected.filter((player) => player.gender === "M").sort((a, b) => rating(b) - rating(a));
  const women = selected.filter((player) => player.gender === "F").sort((a, b) => rating(b) - rating(a));
  return { MPO1: men[0]?.id ?? "", MPO2: men[1]?.id ?? "", MPO3: men[2]?.id ?? "", MPO4: men[3]?.id ?? "", FPO1: women[0]?.id ?? "", FPO2: women[1]?.id ?? "" } satisfies Partial<Record<OpenRosterSlot, string>>;
}

export function OpenRoundEditor({ data }: { data: RoundManagementData }) {
  const initialSelected = useMemo(() => {
    const ids = data.roster?.selectedPlayerIds?.length ? data.roster.selectedPlayerIds : data.defaultSelectedPlayerIds;
    return ids.length ? new Set(ids) : nominalSixIds(data.franceTeam);
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
  const menCount = selectedPlayers.filter((player) => player.gender === "M").length;
  const womenCount = selectedPlayers.filter((player) => player.gender === "F").length;
  const complete = menCount === 4 && womenCount === 2;
  const opponentTeam = data.teams.find((team) => team.id === opponentTeamId) ?? null;
  const opponentAvailableTeam = opponentTeam ? { ...opponentTeam, players: opponentTeam.players.filter((player) => !opponentDisabledIds.has(player.id)) } : null;
  const opponentActiveIds = opponentAvailableTeam ? nominalSixIds(opponentAvailableTeam) : new Set<string>();
  const opponentMatchPlayers = opponentTeam?.players.filter((player) => opponentActiveIds.has(player.id)) ?? [];
  const canReady = complete && Boolean(opponentTeamId);
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
      const limit = player.gender === "F" ? 2 : 4;
      if (count >= limit) {
        setMessage({ kind: "error", text: player.gender === "F" ? "La composition utilise 2 féminines." : "La composition utilise 4 hommes." });
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
    setSelectedIds(data.defaultSelectedPlayerIds.length ? new Set(data.defaultSelectedPlayerIds) : nominalSixIds(data.franceTeam));
    setMessage(null);
  }
  function resetDuel() { useDefaultRoster(); setOpponentDisabledIds(new Set()); }
  function addMatchup() {
    setMatchups((current) => [...current, { id: `match-${Date.now()}`, order: current.length + 1, format: "single", francePlayerIds: [], opponentPlayerIds: [] }]);
  }
  function removeMatchup(id: string) { setMatchups((current) => current.filter((item) => item.id !== id).map((item, index) => ({ ...item, order: index + 1 }))); }
  function setMatchFormat(id: string, format: "single" | "double") {
    setMatchups((current) => current.map((item) => item.id === id ? { ...item, format, francePlayerIds: item.francePlayerIds.slice(0, format === "single" ? 1 : 2), opponentPlayerIds: item.opponentPlayerIds.slice(0, format === "single" ? 1 : 2) } : item));
  }
  function setMatchPlayer(id: string, side: "francePlayerIds" | "opponentPlayerIds", index: number, playerId: string) {
    setMatchups((current) => current.map((item) => {
      if (item.id !== id) return item;
      const next = [...item[side]];
      if (playerId) next[index] = playerId; else next.splice(index, 1);
      return { ...item, [side]: next.filter(Boolean) };
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
          slotAssignments: data.division === "open" ? assignmentsFromSelection(data.franceTeam.players, selectedIds) : {},
          matchups,
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

      <div className={styles.rosterActions}><span>{menCount}/4 hommes · {womenCount}/2 féminines</span><button className={styles.secondary} type="button" disabled={busy} onClick={useDefaultRoster}>Roster par défaut</button></div>
      <div className={`comparison-grid ${styles.comparison}`}>
        <ComparisonTeamCard team={data.franceTeam} selectedIds={selectedIds} onTogglePlayer={(id) => { const player = data.franceTeam.players.find((candidate) => candidate.id === id); if (player) toggleFrancePlayer(player); }} onReset={useDefaultRoster} />
        {opponentTeam ? <ComparisonTeamCard team={opponentTeam} disabledIds={opponentDisabledIds} onTogglePlayer={toggleOpponentPlayer} onReset={() => setOpponentDisabledIds(new Set())} /> : <article className={`team-card ${styles.emptyOpponent}`}><div className="team-card__header"><div><div className="team-card__identity"><p className="team-card__eyebrow">Adversaire</p><h3>À sélectionner</h3></div></div></div></article>}
      </div>
      {opponentTeam ? <><ComparisonSummary teamA={data.franceTeam} teamB={opponentTeam} disabledA={new Set()} disabledB={opponentDisabledIds} selectedA={selectedIds} onResetDuel={resetDuel} /><LineupMatchups teamA={data.franceTeam} teamB={opponentTeam} disabledA={new Set()} disabledB={opponentDisabledIds} selectedA={selectedIds} /></> : null}

      <section className={styles.matchupsSection}>
        <div className={styles.matchupsHeading}><div><p>Organisation des matchs</p><h3>Confrontations du round</h3></div><button className={styles.secondary} type="button" disabled={busy || !opponentTeam} onClick={addMatchup}>+ Ajouter un match</button></div>
        {!opponentTeam ? <p className={styles.matchupsEmpty}>Sélectionne d’abord l’adversaire.</p> : matchups.length === 0 ? <p className={styles.matchupsEmpty}>Aucune confrontation définie pour ce round.</p> : <div className={styles.matchupsList}>{matchups.map((matchup, matchIndex) => {
          const slots = matchup.format === "single" ? 1 : 2;
          return <article className={styles.matchupCard} key={matchup.id}>
            <div className={styles.matchupTop}><strong>Match {matchIndex + 1}</strong><div className={styles.matchupControls}><select aria-label={`Format du match ${matchIndex + 1}`} value={matchup.format} disabled={busy} onChange={(event) => setMatchFormat(matchup.id, event.target.value as "single" | "double")}><option value="single">Simple</option><option value="double">Double</option></select><button type="button" disabled={busy} onClick={() => removeMatchup(matchup.id)}>Supprimer</button></div></div>
            <div className={styles.matchupSides}>
              <div><span>France</span>{Array.from({ length: slots }, (_, index) => <select key={index} value={matchup.francePlayerIds[index] ?? ""} disabled={busy} onChange={(event) => setMatchPlayer(matchup.id, "francePlayerIds", index, event.target.value)}><option value="">Joueur {index + 1}</option>{selectedPlayers.filter((player) => !matchup.francePlayerIds.includes(player.id) || matchup.francePlayerIds[index] === player.id).map((player) => <option key={player.id} value={player.id}>{playerLabel(player)}</option>)}</select>)}</div>
              <div><span>{opponentTeam.country}</span>{Array.from({ length: slots }, (_, index) => <select key={index} value={matchup.opponentPlayerIds[index] ?? ""} disabled={busy} onChange={(event) => setMatchPlayer(matchup.id, "opponentPlayerIds", index, event.target.value)}><option value="">Joueur {index + 1}</option>{opponentMatchPlayers.filter((player) => !matchup.opponentPlayerIds.includes(player.id) || matchup.opponentPlayerIds[index] === player.id).map((player) => <option key={player.id} value={player.id}>{playerLabel(player)}</option>)}</select>)}</div>
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
