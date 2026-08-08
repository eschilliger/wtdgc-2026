"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type ComparisonPlayer = {
  id: string;
  firstName: string;
  lastName: string;
  pdgaNumber: number | null;
  rating: number | null;
  gender: "M" | "F" | null;
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

type Props = {
  teams: ComparisonTeam[];
};

type TeamSummary = ReturnType<typeof teamRatingSummary>;

function flagEmoji(code: string) {
  if (!/^[A-Z]{2}$/.test(code)) return "🏳️";
  return String.fromCodePoint(...[...code].map((char) => 127397 + char.charCodeAt(0)));
}

function playerReferenceRating(player: ComparisonPlayer) {
  return player.referenceRating ?? player.rating;
}

function rankPlayers(players: ComparisonPlayer[]) {
  return [...players].sort((a, b) => {
    const officialA = a.officialRank ?? Number.POSITIVE_INFINITY;
    const officialB = b.officialRank ?? Number.POSITIVE_INFINITY;
    if (officialA !== officialB) return officialA - officialB;

    const ratingA = playerReferenceRating(a) ?? -1;
    const ratingB = playerReferenceRating(b) ?? -1;
    if (ratingA !== ratingB) return ratingB - ratingA;

    return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, "fr");
  });
}

function average(values: number[]) {
  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[middle];
}

function teamRatingSummary(players: ComparisonPlayer[], disabledIds = new Set<string>()) {
  const activePlayers = players.filter((player) => !disabledIds.has(player.id));
  const rated = activePlayers
    .map((player) => ({ ...player, referenceRating: playerReferenceRating(player) }))
    .filter((player): player is ComparisonPlayer & { referenceRating: number } => player.referenceRating !== null);

  const ranked = (gender: "M" | "F", limit: number) => rated
    .filter((player) => player.gender === gender)
    .sort((a, b) => b.referenceRating - a.referenceRating)
    .slice(0, limit);

  const men = ranked("M", 4);
  const women = ranked("F", 2);
  const selected = [...men, ...women];
  const complete = men.length === 4 && women.length === 2;
  const selectedRatings = selected.map((player) => player.referenceRating);
  const ratedMen = rated.filter((player) => player.gender === "M").sort((a, b) => b.referenceRating - a.referenceRating);
  const ratedWomen = rated.filter((player) => player.gender === "F").sort((a, b) => b.referenceRating - a.referenceRating);

  return {
    average: complete ? average(selectedRatings) : null,
    complete,
    menCount: men.length,
    womenCount: women.length,
    selectedIds: new Set(selected.map((player) => player.id)),
    menAverage: average(men.map((player) => player.referenceRating)),
    womenAverage: average(women.map((player) => player.referenceRating)),
    median: median(selectedRatings),
    bestMan: ratedMen[0] ?? null,
    bestWoman: ratedWomen[0] ?? null,
    selectedCount: selected.length,
  };
}

function signed(value: number | null) {
  if (value === null) return "—";
  return value > 0 ? `+${value}` : String(value);
}

function Metric({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <div className="comparison-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

function impactIfDisabled(team: ComparisonTeam, playerId: string, disabledIds: Set<string>) {
  const nominal = teamRatingSummary(team.players, disabledIds);
  if (disabledIds.has(playerId) || nominal.average === null) return null;
  const nextDisabled = new Set(disabledIds);
  nextDisabled.add(playerId);
  const next = teamRatingSummary(team.players, nextDisabled);
  if (next.average === null) return null;
  return next.average - nominal.average;
}

function TeamCard({
  team,
  featured = false,
  disabledIds,
  onTogglePlayer,
}: {
  team: ComparisonTeam;
  featured?: boolean;
  disabledIds: Set<string>;
  onTogglePlayer: (playerId: string) => void;
}) {
  const nominalSummary = teamRatingSummary(team.players);
  const scenarioSummary = teamRatingSummary(team.players, disabledIds);
  const rankedPlayers = rankPlayers(team.players);
  const activeRankById = new Map(
    rankedPlayers
      .filter((player) => !disabledIds.has(player.id))
      .map((player, index) => [player.id, index + 1] as const),
  );
  const nominalDiff = nominalSummary.average !== null && scenarioSummary.average !== null
    ? scenarioSummary.average - nominalSummary.average
    : null;

  return (
    <article className={`team-card${featured ? " team-card--featured" : ""}`}>
      <div className="team-card__header">
        <div>
          <span className="team-card__flag" aria-hidden="true">{flagEmoji(team.countryCode)}</span>
          <div className="team-card__identity">
            <p className="team-card__eyebrow">{team.division === "open" ? "Open" : "Masters"}</p>
            <h3>{team.country}</h3>
          </div>
        </div>
        <div className="rating-summary">
          <strong>{scenarioSummary.average ?? "—"}</strong>
          <span>rating scénario · 4H + 2F</span>
          <small className={nominalDiff !== null && nominalDiff < 0 ? "scenario-diff scenario-diff--down" : "scenario-diff"}>
            {nominalSummary.average === null ? "référence incomplète" : `référence ${nominalSummary.average} · ${signed(nominalDiff)}`}
          </small>
        </div>
      </div>

      <div className="team-card__metrics">
        <Metric label="Top 4 hommes" value={scenarioSummary.menAverage ?? "—"} detail={`${scenarioSummary.menCount}/4 disponibles`} />
        <Metric label="Top 2 femmes" value={scenarioSummary.womenAverage ?? "—"} detail={`${scenarioSummary.womenCount}/2 disponibles`} />
        <Metric label="Médiane sélection" value={scenarioSummary.median ?? "—"} detail={`${disabledIds.size} désactivé${disabledIds.size > 1 ? "s" : ""}`} />
      </div>

      <div className="scenario-note">
        <strong>Classement provisoire</strong>
        <span>En attendant le classement WTDGC officiel, l'ordre J1…Jx utilise le rating PDGA actuel. Les égalités officielles pourront ensuite être imposées par le capitaine.</span>
      </div>

      <div className="player-list player-list--scenario">
        {rankedPlayers.map((player, index) => {
          const disabled = disabledIds.has(player.id);
          const officialRank = player.officialRank ?? index + 1;
          const scenarioRank = activeRankById.get(player.id) ?? null;
          const referenceRating = playerReferenceRating(player);
          const impact = impactIfDisabled(team, player.id, disabledIds);

          return (
            <div
              className={`player-row player-row--scenario${scenarioSummary.selectedIds.has(player.id) ? " player-row--selected" : ""}${disabled ? " player-row--disabled" : ""}`}
              key={player.id}
            >
              <div className="player-ranks" aria-label={`Rang ${disabled ? "désactivé" : `J${scenarioRank}`}`}>
                <strong>{disabled ? "—" : `J${scenarioRank}`}</strong>
                <span>{player.officialRank ? `off. J${officialRank}` : `prov. J${officialRank}`}</span>
              </div>

              <div className="player-row__main">
                {player.pdgaNumber ? (
                  <Link className="player-link" href={`/player/${player.pdgaNumber}`}>{player.firstName} {player.lastName}</Link>
                ) : (
                  <strong>{player.firstName} {player.lastName}</strong>
                )}
                <span>
                  {player.gender === "M" ? "Homme" : player.gender === "F" ? "Femme" : "Genre ?"}
                  {player.pdgaNumber ? ` · PDGA #${player.pdgaNumber}` : ""}
                  {scenarioSummary.selectedIds.has(player.id) ? " · retenu 4H+2F" : ""}
                </span>
                <small className="player-impact">
                  {disabled ? "hors scénario" : impact === null ? "impact indisponible" : `impact si absent : ${signed(impact)}`}
                </small>
              </div>

              <div className="player-row__actions">
                <div className="player-row__rating">
                  <strong>{referenceRating ?? "—"}</strong>
                  <span>{player.referenceRating != null ? "rating WTDGC" : "PDGA provisoire"}</span>
                </div>
                <button
                  type="button"
                  className={`player-toggle${disabled ? " player-toggle--restore" : ""}`}
                  onClick={() => onTogglePlayer(player.id)}
                  aria-pressed={disabled}
                >
                  {disabled ? "Réactiver" : "Désactiver"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function ComparisonSummary({
  teamA,
  teamB,
  disabledA,
  disabledB,
}: {
  teamA: ComparisonTeam;
  teamB: ComparisonTeam;
  disabledA: Set<string>;
  disabledB: Set<string>;
}) {
  const nominalA = teamRatingSummary(teamA.players);
  const nominalB = teamRatingSummary(teamB.players);
  const a = teamRatingSummary(teamA.players, disabledA);
  const b = teamRatingSummary(teamB.players, disabledB);
  const ratingGap = a.average !== null && b.average !== null ? a.average - b.average : null;
  const nominalGap = nominalA.average !== null && nominalB.average !== null ? nominalA.average - nominalB.average : null;
  const menGap = a.menAverage !== null && b.menAverage !== null ? a.menAverage - b.menAverage : null;
  const womenGap = a.womenAverage !== null && b.womenAverage !== null ? a.womenAverage - b.womenAverage : null;
  const leader = ratingGap === null || ratingGap === 0 ? null : ratingGap > 0 ? teamA : teamB;
  const swing = ratingGap !== null && nominalGap !== null ? ratingGap - nominalGap : null;

  return (
    <div className="duel-summary duel-summary--scenario">
      <div className="duel-summary__headline">
        <div>
          <p className="eyebrow">Simulation de composition</p>
          <h3>{leader ? `${flagEmoji(leader.countryCode)} ${leader.country} devant` : "Équilibre actuel"}</h3>
          <p className="duel-summary__copy">Les calculs utilisent uniquement les joueurs actifs avec la règle stricte 4 hommes + 2 femmes.</p>
        </div>
        <div className="duel-gap">
          <strong>{ratingGap === null ? "—" : Math.abs(ratingGap)}</strong>
          <span>points d'écart</span>
          {swing !== null ? <small>mouvement vs référence : {signed(swing)}</small> : null}
        </div>
      </div>

      <div className="duel-metrics">
        <Metric label="Écart scénario" value={ratingGap === null ? "—" : signed(ratingGap)} detail={`${teamA.country} - ${teamB.country}`} />
        <Metric label="Écart référence" value={nominalGap === null ? "—" : signed(nominalGap)} detail="sans absence" />
        <Metric label="Écart hommes" value={menGap === null ? "—" : signed(menGap)} detail="top 4 hommes" />
        <Metric label="Écart femmes" value={womenGap === null ? "—" : signed(womenGap)} detail="top 2 femmes" />
        <Metric label="Joueurs désactivés" value={disabledA.size + disabledB.size} detail={`${teamA.country} ${disabledA.size} · ${teamB.country} ${disabledB.size}`} />
      </div>
    </div>
  );
}

export default function TeamComparison({ teams }: Props) {
  const [division, setDivision] = useState<"open" | "masters">("open");
  const [teamAId, setTeamAId] = useState<string>("");
  const [teamBId, setTeamBId] = useState<string>("");
  const [disabledByTeam, setDisabledByTeam] = useState<Record<string, string[]>>({});

  const divisionTeams = useMemo(
    () => teams.filter((team) => team.division === division).sort((a, b) => a.country.localeCompare(b.country, "fr")),
    [teams, division],
  );

  const france = divisionTeams.find((team) => team.countryCode === "FR") ?? divisionTeams[0];
  const firstOpponent = divisionTeams.find((team) => team.id !== france?.id);
  const secondOpponent = divisionTeams.find((team) => team.id !== france?.id && team.id !== firstOpponent?.id);

  const effectiveTeamAId = divisionTeams.some((team) => team.id === teamAId) ? teamAId : france?.id ?? "";
  const effectiveTeamBId = divisionTeams.some((team) => team.id === teamBId && team.id !== effectiveTeamAId)
    ? teamBId
    : firstOpponent?.id ?? secondOpponent?.id ?? "";

  const teamA = divisionTeams.find((team) => team.id === effectiveTeamAId);
  const teamB = divisionTeams.find((team) => team.id === effectiveTeamBId);

  const disabledFor = (teamId: string) => new Set(disabledByTeam[teamId] ?? []);
  const togglePlayer = (teamId: string, playerId: string) => {
    setDisabledByTeam((current) => {
      const next = new Set(current[teamId] ?? []);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return { ...current, [teamId]: [...next] };
    });
  };

  const resetTeam = (teamId: string) => {
    setDisabledByTeam((current) => ({ ...current, [teamId]: [] }));
  };

  const switchDivision = (nextDivision: "open" | "masters") => {
    setDivision(nextDivision);
    setTeamAId("");
    setTeamBId("");
  };

  return (
    <>
      <section className="france-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Équipe de France</p>
            <h2>France en référence</h2>
          </div>
          <div className="division-toggle" role="group" aria-label="Catégorie">
            <button className={division === "open" ? "active" : ""} onClick={() => switchDivision("open")}>Open</button>
            <button className={division === "masters" ? "active" : ""} onClick={() => switchDivision("masters")}>Masters</button>
          </div>
        </div>
        {france ? (
          <>
            <div className="scenario-toolbar">
              <span>Mode simulation actif</span>
              <button type="button" onClick={() => resetTeam(france.id)}>Réinitialiser France</button>
            </div>
            <TeamCard
              team={france}
              featured
              disabledIds={disabledFor(france.id)}
              onTogglePlayer={(playerId) => togglePlayer(france.id, playerId)}
            />
          </>
        ) : <p>Aucune équipe France disponible dans cette catégorie.</p>}
      </section>

      <section className="comparison-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Scouting</p>
            <h2>Comparer et simuler deux équipes</h2>
            <p className="section-copy">Désactive un joueur pour faire remonter les suivants dans l'ordre J1…Jx. Le rating scénario est recalculé immédiatement avec 4 hommes et 2 femmes.</p>
          </div>
        </div>

        <div className="comparison-controls">
          <label>
            Équipe A
            <select value={effectiveTeamAId} onChange={(event) => setTeamAId(event.target.value)}>
              {divisionTeams.map((team) => (
                <option key={team.id} value={team.id}>{flagEmoji(team.countryCode)} {team.country}</option>
              ))}
            </select>
          </label>
          <div className="versus">VS</div>
          <label>
            Équipe B
            <select value={effectiveTeamBId} onChange={(event) => setTeamBId(event.target.value)}>
              {divisionTeams.filter((team) => team.id !== effectiveTeamAId).map((team) => (
                <option key={team.id} value={team.id}>{flagEmoji(team.countryCode)} {team.country}</option>
              ))}
            </select>
          </label>
        </div>

        {teamA && teamB ? (
          <>
            <ComparisonSummary
              teamA={teamA}
              teamB={teamB}
              disabledA={disabledFor(teamA.id)}
              disabledB={disabledFor(teamB.id)}
            />
            <div className="scenario-toolbar scenario-toolbar--comparison">
              <span>Les simulations sont indépendantes pour chaque équipe.</span>
              <div>
                <button type="button" onClick={() => resetTeam(teamA.id)}>Réinitialiser {teamA.country}</button>
                <button type="button" onClick={() => resetTeam(teamB.id)}>Réinitialiser {teamB.country}</button>
              </div>
            </div>
          </>
        ) : null}

        <div className="comparison-grid">
          {teamA && (
            <TeamCard
              team={teamA}
              disabledIds={disabledFor(teamA.id)}
              onTogglePlayer={(playerId) => togglePlayer(teamA.id, playerId)}
            />
          )}
          {teamB && (
            <TeamCard
              team={teamB}
              disabledIds={disabledFor(teamB.id)}
              onTogglePlayer={(playerId) => togglePlayer(teamB.id, playerId)}
            />
          )}
        </div>
      </section>
    </>
  );
}
