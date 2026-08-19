"use client";

import Link from "next/link";
import type { ComparisonPlayer, ComparisonTeam } from "../TeamComparison";

type SelectedPlayer = ComparisonPlayer & { referenceRating: number };

export function flagEmoji(code: string) {
  if (!/^[A-Z]{2}$/.test(code)) return "🏳️";
  return String.fromCodePoint(...[...code].map((char) => 127397 + char.charCodeAt(0)));
}

export function referenceRating(player: ComparisonPlayer) {
  return player.referenceRating ?? player.rating;
}

export function compareByReference(a: ComparisonPlayer, b: ComparisonPlayer) {
  if (a.officialRank != null && b.officialRank != null && a.officialRank !== b.officialRank) return a.officialRank - b.officialRank;
  const ratingA = referenceRating(a) ?? -1;
  const ratingB = referenceRating(b) ?? -1;
  if (ratingA !== ratingB) return ratingB - ratingA;
  return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, "fr");
}

function average(values: number[]) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

export function signed(value: number | null) {
  if (value === null) return "—";
  return value > 0 ? `+${value}` : String(value);
}

function trendArrow(value: number | null | undefined) {
  if (value == null) return "";
  if (value >= 4) return "↗";
  if (value <= -4) return "↘";
  return "→";
}

function trendLabel(value: number | null) {
  if (value === null) return "dynamique indisponible";
  if (value >= 10) return "hausse nette ↗";
  if (value >= 4) return "en hausse ↗";
  if (value <= -10) return "baisse nette ↘";
  if (value <= -4) return "en baisse ↘";
  return "stable →";
}

export function lineupSummary(players: ComparisonPlayer[], disabledIds = new Set<string>()) {
  const activeRated = players
    .filter((player) => !disabledIds.has(player.id))
    .map((player) => ({ ...player, referenceRating: referenceRating(player) }))
    .filter((player): player is SelectedPlayer => player.referenceRating !== null)
    .sort(compareByReference);

  const menPool = activeRated.filter((player) => player.gender === "M");
  const womenPool = activeRated.filter((player) => player.gender === "F");
  const men = menPool.slice(0, 4);
  const women = womenPool.slice(0, 2);
  return buildSummary(men, women, menPool, womenPool);
}

function lineupFromSelection(players: ComparisonPlayer[], selectedIds: Set<string>) {
  const rated = players
    .filter((player) => selectedIds.has(player.id))
    .map((player) => ({ ...player, referenceRating: referenceRating(player) }))
    .filter((player): player is SelectedPlayer => player.referenceRating !== null)
    .sort(compareByReference);
  const men = rated.filter((player) => player.gender === "M");
  const women = rated.filter((player) => player.gender === "F");
  const allRated = players
    .map((player) => ({ ...player, referenceRating: referenceRating(player) }))
    .filter((player): player is SelectedPlayer => player.referenceRating !== null)
    .sort(compareByReference);
  return buildSummary(men, women, allRated.filter((player) => player.gender === "M"), allRated.filter((player) => player.gender === "F"));
}

function buildSummary(men: SelectedPlayer[], women: SelectedPlayer[], menPool: SelectedPlayer[], womenPool: SelectedPlayer[]) {
  const selected = [...men, ...women].sort(compareByReference);
  const selectedIds = new Set(selected.map((player) => player.id));
  const complete = men.length === 4 && women.length === 2;
  const liveRatings = selected.map((player) => player.rating).filter((rating): rating is number => rating !== null);
  const trends = selected.map((player) => player.trend12Months).filter((trend): trend is number => trend != null);
  return {
    average: complete ? average(selected.map((player) => player.referenceRating)) : null,
    liveAverage: complete && liveRatings.length === 6 ? average(liveRatings) : null,
    trend12Months: complete && trends.length === 6 ? average(trends) : null,
    trendCount: trends.length,
    menAverage: average(men.map((player) => player.referenceRating)),
    womenAverage: average(women.map((player) => player.referenceRating)),
    menCount: men.length,
    womenCount: women.length,
    menBenchGap: men.length === 4 && menPool[4] ? men[3].referenceRating - menPool[4].referenceRating : null,
    womenBenchGap: women.length === 2 && womenPool[2] ? women[1].referenceRating - womenPool[2].referenceRating : null,
    menHasBackup: Boolean(menPool[4]),
    womenHasBackup: Boolean(womenPool[2]),
    complete,
    selected,
    selectedIds,
  };
}

function Metric({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return <div className="comparison-metric"><span>{label}</span><strong>{value}</strong>{detail ? <small>{detail}</small> : null}</div>;
}

function impactIfDisabled(team: ComparisonTeam, playerId: string, disabledIds: Set<string>) {
  const current = lineupSummary(team.players, disabledIds);
  if (!current.selectedIds.has(playerId)) return 0;
  if (current.average === null) return null;
  const nextDisabled = new Set(disabledIds);
  nextDisabled.add(playerId);
  const next = lineupSummary(team.players, nextDisabled);
  return next.average === null ? null : next.average - current.average;
}

function TeamScenarioStory({ team, disabledIds }: { team: ComparisonTeam; disabledIds: Set<string> }) {
  if (!disabledIds.size) return null;
  const nominal = lineupSummary(team.players);
  const scenario = lineupSummary(team.players, disabledIds);
  const exits = nominal.selected.filter((player) => !scenario.selectedIds.has(player.id));
  const entries = scenario.selected.filter((player) => !nominal.selectedIds.has(player.id));
  const delta = nominal.average !== null && scenario.average !== null ? scenario.average - nominal.average : null;
  return <div className="scenario-story"><strong>Scénario modifié</strong><div>{exits.length ? <span>{exits.map((player) => `${player.firstName} ${player.lastName}`).join(", ")} sort</span> : null}{entries.length ? <span>{entries.map((player) => `${player.firstName} ${player.lastName}`).join(", ")} entre</span> : null}<span>{nominal.average ?? "—"} → {scenario.average ?? "—"}{delta !== null ? ` (${signed(delta)})` : ""}</span></div></div>;
}

function DepthSummary({ scenario }: { scenario: ReturnType<typeof lineupSummary> }) {
  const menGap = scenario.menHasBackup && scenario.menBenchGap != null ? `−${scenario.menBenchGap}` : "—";
  const womenGap = scenario.womenHasBackup && scenario.womenBenchGap != null ? `−${scenario.womenBenchGap}` : "—";
  return <><div className="team-depth-desktop"><span>Hommes <strong>{menGap}</strong><small>{scenario.menHasBackup ? "4e → 5e" : "pas de 5e homme"}</small></span><span>Féminines <strong>{womenGap}</strong><small>{scenario.womenHasBackup ? "2e → 3e" : "pas de 3e féminine"}</small></span></div><div className="team-depth-mobile"><div><span>Hommes</span><strong>{scenario.menHasBackup ? menGap : "Aucun remplaçant"}</strong><small>{scenario.menHasBackup ? "4e → 5e" : "pas de 5e homme"}</small></div><div><span>Féminines</span><strong>{scenario.womenHasBackup ? womenGap : "Aucun remplaçant"}</strong><small>{scenario.womenHasBackup ? "2e → 3e" : "pas de 3e féminine"}</small></div></div></>;
}

function GenderPictogram({ gender }: { gender: "M" | "F" | null }) {
  if (!gender) return null;
  const label = gender === "F" ? "Féminine" : "Homme";
  return <span className={`player-gender-picto player-gender-picto--${gender === "F" ? "female" : "male"}`} role="img" aria-label={label}>{gender === "F" ? "F" : "H"}</span>;
}

function PlayerName({ player, division }: { player: ComparisonPlayer; division: "open" | "masters" }) {
  const content = <><span className="player-name-first">{player.firstName}</span>{" "}<span className="player-name-last">{player.lastName}</span></>;
  return player.pdgaNumber ? <Link className="player-link" href={`/player/${player.pdgaNumber}?division=${division}`}>{content}</Link> : <strong>{content}</strong>;
}

function PlayerRow({ player, team, disabledIds, rank, refRank, selected, division, onToggle, selectionMode, interactionDisabled }: {
  player: ComparisonPlayer;
  team: ComparisonTeam;
  disabledIds: Set<string>;
  rank: number | null;
  refRank: number | null;
  selected: boolean;
  division: "open" | "masters";
  onToggle: () => void;
  selectionMode: boolean;
  interactionDisabled: boolean;
}) {
  const disabled = !selectionMode && disabledIds.has(player.id);
  const refRating = referenceRating(player);
  const impact = selectionMode ? null : impactIfDisabled(team, player.id, disabledIds);
  const liveDelta = player.referenceRating != null && player.rating != null ? player.rating - player.referenceRating : null;
  const desktopStatusLabel = disabled ? "Indisponible" : selected ? "Titulaire" : "Remplaçant";
  const mobileStatusLabel = disabled ? "Indispo" : selected ? "Titulaire" : "Remplaçant";
  const statusClass = disabled ? "disabled" : selected ? "starter" : "substitute";
  const rankLabel = disabled ? "—" : rank ? `J${rank}` : "R";
  const toggleLabel = selectionMode ? (selected ? "Retirer" : "Sélectionner") : (disabled ? "Réactiver" : "Désactiver");
  const checked = selectionMode ? selected : !disabled;

  return <div className={`player-row player-row--scenario${selected ? " player-row--selected" : " player-row--substitute"}${disabled ? " player-row--disabled" : ""}`}>
    <div className="player-ranks"><strong>{rankLabel}</strong><span>{disabled ? "indispo" : rank ? (player.officialRank ? `off. J${player.officialRank}` : `réf. #${refRank}`) : `rempl. #${refRank}`}</span><GenderPictogram gender={player.gender} /></div>
    <div className="player-row__main"><div className="player-name-line"><PlayerName player={player} division={division} /><span className={`player-status player-status--${statusClass} player-status--desktop-only`}><span className="player-status__desktop">{desktopStatusLabel}</span></span></div><span className="player-meta-line">{player.gender === "F" ? "Féminine" : "Homme"}{player.pdgaNumber ? ` · PDGA #${player.pdgaNumber}` : ""}</span><small className="player-impact">{selectionMode ? (selected ? "dans le six" : "en attente d'une place dans le six") : disabled ? "hors scénario" : !selected ? "en attente d'une place dans le six" : impact === null ? "absence : composition impossible" : `impact absence : ${signed(impact)}`}</small><div className="player-mobile-core"><div className="player-mobile-rating"><span>Rating</span><strong>{refRating ?? "—"}</strong></div><div className="player-mobile-trend"><span>Évolution sur 12 mois</span><strong>{player.trend12Months == null ? "—" : `${signed(player.trend12Months)} ${trendArrow(player.trend12Months)}`}</strong></div></div></div>
    <div className="player-row__actions"><div className="player-row__rating"><strong>{refRating ?? "—"}</strong><span>{player.referenceRating != null ? "rating WTDGC" : "rating PDGA"}</span>{liveDelta !== null ? <small>PDGA live {player.rating} · {signed(liveDelta)}</small> : null}{player.trend12Months != null ? <small className={`player-rating-trend${player.trend12Months >= 4 ? " player-trend--up" : player.trend12Months <= -4 ? " player-trend--down" : ""}`}>12 mois {signed(player.trend12Months)} {trendArrow(player.trend12Months)}</small> : null}</div><button type="button" className={`player-toggle player-toggle--desktop${disabled ? " player-toggle--restore" : ""}`} onClick={onToggle} disabled={interactionDisabled}>{toggleLabel}</button></div>
    <div className="player-mobile-actions"><span className={`player-status player-status--${statusClass}`}><span className="player-status__mobile">{mobileStatusLabel}</span></span><label className="player-switch"><input type="checkbox" checked={checked} onChange={onToggle} disabled={interactionDisabled} aria-label={`${toggleLabel} ${player.firstName} ${player.lastName}`} /><i aria-hidden="true" /></label></div>
  </div>;
}

export function ComparisonTeamCard({ team, featured = false, disabledIds = new Set<string>(), selectedIds, onTogglePlayer, onReset, interactionDisabled = false }: {
  team: ComparisonTeam;
  featured?: boolean;
  disabledIds?: Set<string>;
  selectedIds?: Set<string>;
  onTogglePlayer: (playerId: string) => void;
  onReset: () => void;
  interactionDisabled?: boolean;
}) {
  const selectionMode = selectedIds !== undefined;
  const nominal = lineupSummary(team.players);
  const scenario = selectedIds ? lineupFromSelection(team.players, selectedIds) : lineupSummary(team.players, disabledIds);
  const allPlayers = [...team.players].sort(compareByReference);
  const scenarioRank = new Map(scenario.selected.map((player, index) => [player.id, index + 1] as const));
  const rosterReferenceRank = new Map(allPlayers.map((player, index) => [player.id, player.officialRank ?? index + 1] as const));
  const delta = nominal.average !== null && scenario.average !== null ? scenario.average - nominal.average : null;
  const liveVsReference = scenario.liveAverage !== null && scenario.average !== null ? scenario.liveAverage - scenario.average : null;

  return <article className={`team-card${featured ? " team-card--featured" : ""}`}>
    <div className="team-card__header"><div><span className="team-card__flag" aria-hidden="true">{flagEmoji(team.countryCode)}</span><div className="team-card__identity"><p className="team-card__eyebrow">{team.division === "open" ? "Open" : "Masters"}</p><h3>{team.country}</h3></div></div><div className="team-card__header-actions"><div className="rating-summary"><strong>{scenario.average ?? "—"}</strong><span>rating scénario · 4 hommes + 2 féminines</span><small className={delta !== null && delta < 0 ? "scenario-diff scenario-diff--down" : "scenario-diff"}>{nominal.average === null ? "référence incomplète" : `référence ${nominal.average} · ${signed(delta)}`}</small></div><button type="button" className="team-reset" onClick={onReset} disabled={interactionDisabled || (selectionMode ? false : disabledIds.size === 0)}>Réinitialiser</button></div></div>
    <div className="team-card__metrics team-card__metrics--v42"><Metric label="4 hommes retenus" value={scenario.menAverage ?? "—"} detail={`${scenario.menCount}/4`} /><Metric label="2 féminines retenues" value={scenario.womenAverage ?? "—"} detail={`${scenario.womenCount}/2`} /><Metric label="Rating PDGA live" value={scenario.liveAverage ?? "—"} detail={liveVsReference !== null ? `${signed(liveVsReference)} vs référence` : "six actif"} /><Metric label="Dynamique 12 mois" value={signed(scenario.trend12Months)} detail={scenario.trend12Months !== null ? trendLabel(scenario.trend12Months) : `${scenario.trendCount}/6 joueurs`} /></div>
    <div className="team-depth-strip team-depth-strip--v43"><span>Profondeur du banc</span><DepthSummary scenario={scenario} /></div>
    {!selectionMode ? <TeamScenarioStory team={team} disabledIds={disabledIds} /> : null}
    {!scenario.complete ? <div className="scenario-alert scenario-alert--error"><strong>Rating équipe impossible à calculer</strong><span>Composition disponible : {scenario.menCount}/4 hommes et {scenario.womenCount}/2 féminines.</span></div> : <div className="scenario-note"><strong>Six actif</strong><span>Les rangs J1 à J6 sont recalculés dans le scénario, sans déplacer les joueurs dans la liste.</span></div>}
    <div className="player-list player-list--fixed-roster">{allPlayers.map((player) => <PlayerRow key={player.id} player={player} team={team} disabledIds={disabledIds} rank={scenarioRank.get(player.id) ?? null} refRank={rosterReferenceRank.get(player.id) ?? null} selected={scenario.selectedIds.has(player.id)} division={team.division} onToggle={() => onTogglePlayer(player.id)} selectionMode={selectionMode} interactionDisabled={interactionDisabled} />)}</div>
  </article>;
}
