"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

export type ComparisonPlayer = {
  id: string;
  firstName: string;
  lastName: string;
  pdgaNumber: number | null;
  rating: number | null;
  trend12Months?: number | null;
  gender: "M" | "F" | null;
  genderSource?: "profile" | "yearly-stats" | "default-m";
  jerseyNumber: number | null;
  referenceRating?: number | null;
  officialRank?: number | null;
  ratingSource?: "pdga" | "captain" | null;
};

export type ComparisonTeam = {
  id: string;
  country: string;
  countryCode: string;
  division: "open" | "masters";
  players: ComparisonPlayer[];
};

type Props = { teams: ComparisonTeam[] };
type SelectedPlayer = ComparisonPlayer & { referenceRating: number };

function flagEmoji(code: string) {
  if (!/^[A-Z]{2}$/.test(code)) return "🏳️";
  return String.fromCodePoint(...[...code].map((char) => 127397 + char.charCodeAt(0)));
}

function referenceRating(player: ComparisonPlayer) {
  return player.referenceRating ?? player.rating;
}

function compareByReference(a: ComparisonPlayer, b: ComparisonPlayer) {
  if (a.officialRank != null && b.officialRank != null && a.officialRank !== b.officialRank) return a.officialRank - b.officialRank;
  const ratingA = referenceRating(a) ?? -1;
  const ratingB = referenceRating(b) ?? -1;
  if (ratingA !== ratingB) return ratingB - ratingA;
  return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, "fr");
}

function average(values: number[]) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

function signed(value: number | null) {
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

function lineupSummary(players: ComparisonPlayer[], disabledIds = new Set<string>()) {
  const activeRated = players
    .filter((player) => !disabledIds.has(player.id))
    .map((player) => ({ ...player, referenceRating: referenceRating(player) }))
    .filter((player): player is SelectedPlayer => player.referenceRating !== null)
    .sort(compareByReference);

  const menPool = activeRated.filter((player) => player.gender === "M");
  const womenPool = activeRated.filter((player) => player.gender === "F");
  const men = menPool.slice(0, 4);
  const women = womenPool.slice(0, 2);
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

  return (
    <div className="scenario-story">
      <strong>Scénario modifié</strong>
      <div>
        {exits.length ? <span>{exits.map((player) => `${player.firstName} ${player.lastName}`).join(", ")} sort</span> : null}
        {entries.length ? <span>{entries.map((player) => `${player.firstName} ${player.lastName}`).join(", ")} entre</span> : null}
        <span>{nominal.average ?? "—"} → {scenario.average ?? "—"}{delta !== null ? ` (${signed(delta)})` : ""}</span>
      </div>
    </div>
  );
}

function DepthSummary({ scenario }: { scenario: ReturnType<typeof lineupSummary> }) {
  const menGap = scenario.menHasBackup && scenario.menBenchGap != null ? `−${scenario.menBenchGap}` : "—";
  const womenGap = scenario.womenHasBackup && scenario.womenBenchGap != null ? `−${scenario.womenBenchGap}` : "—";

  return <>
    <div className="team-depth-desktop">
      <span>Hommes <strong>{menGap}</strong><small>{scenario.menHasBackup ? "4e → 5e" : "pas de 5e homme"}</small></span>
      <span>Féminines <strong>{womenGap}</strong><small>{scenario.womenHasBackup ? "2e → 3e" : "pas de 3e féminine"}</small></span>
    </div>
    <div className="team-depth-mobile">
      <div><span>Hommes</span><strong>{scenario.menHasBackup ? menGap : "Aucun remplaçant"}</strong><small>{scenario.menHasBackup ? "4e → 5e" : "pas de 5e homme"}</small></div>
      <div><span>Féminines</span><strong>{scenario.womenHasBackup ? womenGap : "Aucun remplaçant"}</strong><small>{scenario.womenHasBackup ? "2e → 3e" : "pas de 3e féminine"}</small></div>
    </div>
  </>;
}

function GenderPictogram({ gender }: { gender: "M" | "F" | null }) {
  if (!gender) return null;
  const label = gender === "F" ? "Féminine" : "Homme";

  return (
    <span className={`player-gender-picto player-gender-picto--${gender === "F" ? "female" : "male"}`} role="img" aria-label={label}>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        {gender === "F" ? <>
          <circle cx="12" cy="5" r="3" />
          <path d="M8.7 9.1c.8-1 2-1.6 3.3-1.6s2.5.6 3.3 1.6l2.2 6.1c.2.6-.2 1.3-.9 1.3h-1.7v4.2c0 .7-.5 1.3-1.2 1.3s-1.2-.6-1.2-1.3v-4.2h-1v4.2c0 .7-.5 1.3-1.2 1.3s-1.2-.6-1.2-1.3v-4.2H7.4c-.7 0-1.1-.7-.9-1.3l2.2-6.1Z" />
        </> : <>
          <circle cx="12" cy="5" r="3" />
          <path d="M8.2 9.1c.8-1 2.2-1.6 3.8-1.6s3 .6 3.8 1.6c.6.8.9 1.8.9 2.8v3.8c0 .7-.5 1.2-1.2 1.2s-1.2-.5-1.2-1.2V12h-.8v8.7c0 .7-.6 1.3-1.3 1.3s-1.3-.6-1.3-1.3V16h-.8v4.7c0 .7-.6 1.3-1.3 1.3s-1.3-.6-1.3-1.3V12h-.8v3.7c0 .7-.5 1.2-1.2 1.2S5 16.4 5 15.7v-3.8c0-1 .3-2 .9-2.8h2.3Z" />
        </>}
      </svg>
    </span>
  );
}

function PlayerName({ player, division }: { player: ComparisonPlayer; division: "open" | "masters" }) {
  const content = <><span className="player-name-first">{player.firstName}</span>{" "}<span className="player-name-last">{player.lastName}</span></>;
  return player.pdgaNumber
    ? <Link className="player-link" href={`/player/${player.pdgaNumber}?division=${division}`}>{content}</Link>
    : <strong>{content}</strong>;
}

function PlayerRow({
  player,
  team,
  disabledIds,
  rank,
  refRank,
  selected,
  division,
  onToggle,
}: {
  player: ComparisonPlayer;
  team: ComparisonTeam;
  disabledIds: Set<string>;
  rank: number | null;
  refRank: number | null;
  selected: boolean;
  division: "open" | "masters";
  onToggle: () => void;
}) {
  const disabled = disabledIds.has(player.id);
  const refRating = referenceRating(player);
  const impact = impactIfDisabled(team, player.id, disabledIds);
  const liveDelta = player.referenceRating != null && player.rating != null ? player.rating - player.referenceRating : null;
  const desktopStatusLabel = disabled ? "Indisponible" : selected ? "Titulaire" : "Remplaçant";
  const mobileStatusLabel = disabled ? "Indispo" : selected ? "Titulaire" : "Remplaçant";
  const statusClass = disabled ? "disabled" : selected ? "starter" : "substitute";
  const rankLabel = disabled ? "—" : rank ? `J${rank}` : "R";

  return (
    <div className={`player-row player-row--scenario${selected ? " player-row--selected" : " player-row--substitute"}${disabled ? " player-row--disabled" : ""}`}>
      <div className="player-ranks">
        <strong>{rankLabel}</strong>
        <span>{disabled ? "indispo" : rank ? (player.officialRank ? `off. J${player.officialRank}` : `réf. #${refRank}`) : `rempl. #${refRank}`}</span>
        <GenderPictogram gender={player.gender} />
      </div>

      <div className="player-row__main">
        <div className="player-name-line">
          <PlayerName player={player} division={division} />
          <span className={`player-status player-status--${statusClass}`}>
            <span className="player-status__desktop">{desktopStatusLabel}</span>
            <span className="player-status__mobile">{mobileStatusLabel}</span>
          </span>
        </div>
        <span className="player-meta-line">{player.gender === "F" ? "Féminine" : "Homme"}{player.pdgaNumber ? ` · PDGA #${player.pdgaNumber}` : ""}</span>
        <small className="player-impact">{disabled ? "hors scénario" : !selected ? "en attente d'une place dans le six" : impact === null ? "absence : composition impossible" : `impact absence : ${signed(impact)}`}</small>
        <div className="player-mobile-core">
          <div className="player-mobile-rating"><span>Rating</span><strong>{refRating ?? "—"}</strong></div>
          <div className="player-mobile-trend"><span>Évolution sur 12 mois</span><strong>{player.trend12Months == null ? "—" : `${signed(player.trend12Months)} ${trendArrow(player.trend12Months)}`}</strong></div>
        </div>
      </div>

      <div className="player-row__actions">
        <div className="player-row__rating">
          <strong>{refRating ?? "—"}</strong>
          <span>{player.referenceRating != null ? "rating WTDGC" : "rating PDGA"}</span>
          {liveDelta !== null ? <small>PDGA live {player.rating} · {signed(liveDelta)}</small> : null}
          {player.trend12Months != null ? <small className={`player-rating-trend${player.trend12Months >= 4 ? " player-trend--up" : player.trend12Months <= -4 ? " player-trend--down" : ""}`}>12 mois {signed(player.trend12Months)} {trendArrow(player.trend12Months)}</small> : null}
        </div>
        <button type="button" className={`player-toggle player-toggle--desktop${disabled ? " player-toggle--restore" : ""}`} onClick={onToggle}>{disabled ? "Réactiver" : "Désactiver"}</button>
      </div>

      <div className="player-mobile-actions">
        <label className="player-switch">
          <span>{disabled ? "Indispo" : "Actif"}</span>
          <input type="checkbox" checked={!disabled} onChange={onToggle} aria-label={`${disabled ? "Réactiver" : "Désactiver"} ${player.firstName} ${player.lastName}`} />
          <i aria-hidden="true" />
        </label>
      </div>
    </div>
  );
}

function TeamCard({ team, featured = false, disabledIds, onTogglePlayer, onReset }: {
  team: ComparisonTeam;
  featured?: boolean;
  disabledIds: Set<string>;
  onTogglePlayer: (playerId: string) => void;
  onReset: () => void;
}) {
  const nominal = lineupSummary(team.players);
  const scenario = lineupSummary(team.players, disabledIds);
  const allPlayers = [...team.players].sort(compareByReference);
  const scenarioRank = new Map(scenario.selected.map((player, index) => [player.id, index + 1] as const));
  const rosterReferenceRank = new Map(allPlayers.map((player, index) => [player.id, player.officialRank ?? index + 1] as const));
  const delta = nominal.average !== null && scenario.average !== null ? scenario.average - nominal.average : null;
  const liveVsReference = scenario.liveAverage !== null && scenario.average !== null ? scenario.liveAverage - scenario.average : null;

  return (
    <article className={`team-card${featured ? " team-card--featured" : ""}`}>
      <div className="team-card__header">
        <div><span className="team-card__flag" aria-hidden="true">{flagEmoji(team.countryCode)}</span><div className="team-card__identity"><p className="team-card__eyebrow">{team.division === "open" ? "Open" : "Masters"}</p><h3>{team.country}</h3></div></div>
        <div className="team-card__header-actions"><div className="rating-summary"><strong>{scenario.average ?? "—"}</strong><span>rating scénario · 4 hommes + 2 féminines</span><small className={delta !== null && delta < 0 ? "scenario-diff scenario-diff--down" : "scenario-diff"}>{nominal.average === null ? "référence incomplète" : `référence ${nominal.average} · ${signed(delta)}`}</small></div><button type="button" className="team-reset" onClick={onReset} disabled={disabledIds.size === 0}>Réinitialiser</button></div>
      </div>

      <div className="team-card__metrics team-card__metrics--v42">
        <Metric label="4 hommes retenus" value={scenario.menAverage ?? "—"} detail={`${scenario.menCount}/4`} />
        <Metric label="2 féminines retenues" value={scenario.womenAverage ?? "—"} detail={`${scenario.womenCount}/2`} />
        <Metric label="Rating PDGA live" value={scenario.liveAverage ?? "—"} detail={liveVsReference !== null ? `${signed(liveVsReference)} vs référence` : "six actif"} />
        <Metric label="Dynamique 12 mois" value={signed(scenario.trend12Months)} detail={scenario.trend12Months !== null ? trendLabel(scenario.trend12Months) : `${scenario.trendCount}/6 joueurs`} />
      </div>

      <div className="team-depth-strip team-depth-strip--v43"><span>Profondeur du banc</span><DepthSummary scenario={scenario} /></div>
      <TeamScenarioStory team={team} disabledIds={disabledIds} />
      {!scenario.complete
        ? <div className="scenario-alert scenario-alert--error"><strong>Rating équipe impossible à calculer</strong><span>Composition disponible : {scenario.menCount}/4 hommes et {scenario.womenCount}/2 féminines.</span></div>
        : <div className="scenario-note"><strong>Six actif</strong><span>Les rangs J1 à J6 sont recalculés dans le scénario, sans déplacer les joueurs dans la liste.</span></div>}

      <div className="player-list player-list--fixed-roster">
        {allPlayers.map((player) => <PlayerRow
          key={player.id}
          player={player}
          team={team}
          disabledIds={disabledIds}
          rank={scenarioRank.get(player.id) ?? null}
          refRank={rosterReferenceRank.get(player.id) ?? null}
          selected={scenario.selectedIds.has(player.id)}
          division={team.division}
          onToggle={() => onTogglePlayer(player.id)}
        />)}
      </div>
    </article>
  );
}

function LineupMatchups({ teamA, teamB, disabledA, disabledB }: { teamA: ComparisonTeam; teamB: ComparisonTeam; disabledA: Set<string>; disabledB: Set<string> }) {
  const a = lineupSummary(teamA.players, disabledA);
  const b = lineupSummary(teamB.players, disabledB);
  if (!a.complete || !b.complete) return null;

  return (
    <div className="lineup-matchups lineup-matchups--v43">
      <div className="lineup-matchups__heading"><div><p className="eyebrow">Lecture du six</p><h3>Joueur par joueur</h3></div><span>Lecture du six actif après tes choix de composition.</span></div>
      <div className="lineup-matchups__rows">
        {a.selected.map((playerA, index) => {
          const playerB = b.selected[index];
          const ratingA = referenceRating(playerA);
          const ratingB = referenceRating(playerB);
          const gap = ratingA !== null && ratingB !== null ? ratingA - ratingB : null;
          return <div className="lineup-matchup-row lineup-matchup-row--v43" key={`${playerA.id}-${playerB.id}`}>
            <strong className="lineup-rank">J{index + 1}</strong>
            <div className="lineup-matchup-player lineup-matchup-player--a"><span>{playerA.firstName} {playerA.lastName}</span><small>{playerA.trend12Months != null ? `12m ${signed(playerA.trend12Months)}` : ""}</small></div>
            <b className="lineup-rating">{ratingA ?? "—"}</b>
            <div className={`lineup-matchup-gap${gap !== null && gap > 0 ? " lineup-matchup-gap--a" : gap !== null && gap < 0 ? " lineup-matchup-gap--b" : ""}`}>{gap === null ? "—" : signed(gap)}</div>
            <b className="lineup-rating">{ratingB ?? "—"}</b>
            <div className="lineup-matchup-player lineup-matchup-player--b"><span>{playerB.firstName} {playerB.lastName}</span><small>{playerB.trend12Months != null ? `12m ${signed(playerB.trend12Months)}` : ""}</small></div>
          </div>;
        })}
      </div>
    </div>
  );
}

function ComparisonSummary({ teamA, teamB, disabledA, disabledB, onResetDuel }: { teamA: ComparisonTeam; teamB: ComparisonTeam; disabledA: Set<string>; disabledB: Set<string>; onResetDuel: () => void }) {
  const nominalA = lineupSummary(teamA.players);
  const nominalB = lineupSummary(teamB.players);
  const a = lineupSummary(teamA.players, disabledA);
  const b = lineupSummary(teamB.players, disabledB);
  const gap = a.average !== null && b.average !== null ? a.average - b.average : null;
  const nominalGap = nominalA.average !== null && nominalB.average !== null ? nominalA.average - nominalB.average : null;
  const menGap = a.menAverage !== null && b.menAverage !== null ? a.menAverage - b.menAverage : null;
  const womenGap = a.womenAverage !== null && b.womenAverage !== null ? a.womenAverage - b.womenAverage : null;
  const trendGap = a.trend12Months !== null && b.trend12Months !== null ? a.trend12Months - b.trend12Months : null;
  const leader = gap === null || gap === 0 ? null : gap > 0 ? teamA : teamB;
  const swing = gap !== null && nominalGap !== null ? gap - nominalGap : null;

  return (
    <div className="duel-summary duel-summary--scenario">
      <div className="duel-summary__headline"><div><p className="eyebrow">Simulation de composition</p><h3>{gap === null ? "Comparaison incomplète" : leader ? `${flagEmoji(leader.countryCode)} ${leader.country} devant` : "Équilibre actuel"}</h3></div><div className="duel-summary__actions"><div className="duel-gap"><strong>{gap === null ? "—" : Math.abs(gap)}</strong><span>points d'écart</span>{swing !== null ? <small>mouvement vs référence : {signed(swing)}</small> : null}</div><button type="button" className="duel-reset" onClick={onResetDuel} disabled={disabledA.size + disabledB.size === 0}>Réinitialiser le duel</button></div></div>
      <div className="duel-metrics"><Metric label="Écart scénario" value={gap === null ? "—" : signed(gap)} detail={`${teamA.country} - ${teamB.country}`} /><Metric label="Écart référence" value={nominalGap === null ? "—" : signed(nominalGap)} detail="sans absence" /><Metric label="Écart hommes" value={menGap === null ? "—" : signed(menGap)} detail="4 hommes" /><Metric label="Écart féminines" value={womenGap === null ? "—" : signed(womenGap)} detail="2 féminines" /><Metric label="Dynamique 12 mois" value={trendGap === null ? "—" : signed(trendGap)} detail={`${teamA.country} - ${teamB.country}`} /></div>
    </div>
  );
}

export default function TeamComparison({ teams }: Props) {
  const searchParams = useSearchParams();
  const initialDivision = searchParams.get("division") === "masters" ? "masters" : "open";
  const [division, setDivision] = useState<"open" | "masters">(initialDivision);
  const [teamAId, setTeamAId] = useState("");
  const [teamBId, setTeamBId] = useState("");
  const [disabledByTeam, setDisabledByTeam] = useState<Record<string, string[]>>({});

  const divisionTeams = useMemo(() => teams.filter((team) => team.division === division).sort((a, b) => a.country.localeCompare(b.country, "fr")), [teams, division]);
  const france = divisionTeams.find((team) => team.countryCode === "FR") ?? divisionTeams[0];
  const firstOpponent = divisionTeams.find((team) => team.id !== france?.id);
  const secondOpponent = divisionTeams.find((team) => team.id !== france?.id && team.id !== firstOpponent?.id);
  const effectiveTeamAId = divisionTeams.some((team) => team.id === teamAId) ? teamAId : france?.id ?? "";
  const effectiveTeamBId = divisionTeams.some((team) => team.id === teamBId && team.id !== effectiveTeamAId) ? teamBId : firstOpponent?.id ?? secondOpponent?.id ?? "";
  const teamA = divisionTeams.find((team) => team.id === effectiveTeamAId);
  const teamB = divisionTeams.find((team) => team.id === effectiveTeamBId);
  const disabledFor = (teamId: string) => new Set(disabledByTeam[teamId] ?? []);
  const togglePlayer = (teamId: string, playerId: string) => setDisabledByTeam((current) => {
    const next = new Set(current[teamId] ?? []);
    if (next.has(playerId)) next.delete(playerId); else next.add(playerId);
    return { ...current, [teamId]: [...next] };
  });
  const resetTeam = (teamId: string) => setDisabledByTeam((current) => ({ ...current, [teamId]: [] }));
  const resetDuel = (a: string, b: string) => setDisabledByTeam((current) => ({ ...current, [a]: [], [b]: [] }));
  const switchDivision = (next: "open" | "masters") => {
    setDivision(next);
    setTeamAId("");
    setTeamBId("");
    window.history.replaceState(null, "", `/?division=${next}`);
  };

  return <>
    <section className="france-section">
      <div className="section-heading"><div><p className="eyebrow">Équipe de France</p><h2>France en référence</h2></div><div className="division-toggle"><button className={division === "open" ? "active" : ""} onClick={() => switchDivision("open")}>Open</button><button className={division === "masters" ? "active" : ""} onClick={() => switchDivision("masters")}>Masters</button></div></div>
      {france ? <TeamCard team={france} featured disabledIds={disabledFor(france.id)} onTogglePlayer={(id) => togglePlayer(france.id, id)} onReset={() => resetTeam(france.id)} /> : null}
    </section>

    <section className="comparison-section">
      <div className="section-heading"><div><p className="eyebrow">Scouting</p><h2>Comparer deux équipes</h2></div></div>
      <div className="comparison-controls"><label>Équipe A<select value={effectiveTeamAId} onChange={(event) => setTeamAId(event.target.value)}>{divisionTeams.map((team) => <option key={team.id} value={team.id}>{flagEmoji(team.countryCode)} {team.country}</option>)}</select></label><div className="versus">VS</div><label>Équipe B<select value={effectiveTeamBId} onChange={(event) => setTeamBId(event.target.value)}>{divisionTeams.filter((team) => team.id !== effectiveTeamAId).map((team) => <option key={team.id} value={team.id}>{flagEmoji(team.countryCode)} {team.country}</option>)}</select></label></div>
      {teamA && teamB ? <>
        <ComparisonSummary teamA={teamA} teamB={teamB} disabledA={disabledFor(teamA.id)} disabledB={disabledFor(teamB.id)} onResetDuel={() => resetDuel(teamA.id, teamB.id)} />
        <div className="comparison-grid"><TeamCard team={teamA} disabledIds={disabledFor(teamA.id)} onTogglePlayer={(id) => togglePlayer(teamA.id, id)} onReset={() => resetTeam(teamA.id)} /><TeamCard team={teamB} disabledIds={disabledFor(teamB.id)} onTogglePlayer={(id) => togglePlayer(teamB.id, id)} onReset={() => resetTeam(teamB.id)} /></div>
        <LineupMatchups teamA={teamA} teamB={teamB} disabledA={disabledFor(teamA.id)} disabledB={disabledFor(teamB.id)} />
      </> : null}
    </section>
  </>;
}
