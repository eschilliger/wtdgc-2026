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
  if (a.officialRank != null && b.officialRank != null && a.officialRank !== b.officialRank) {
    return a.officialRank - b.officialRank;
  }
  const ratingA = referenceRating(a) ?? -1;
  const ratingB = referenceRating(b) ?? -1;
  if (ratingA !== ratingB) return ratingB - ratingA;
  return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, "fr");
}

function average(values: number[]) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function lineupSummary(players: ComparisonPlayer[], disabledIds = new Set<string>()) {
  const activeRated = players
    .filter((player) => !disabledIds.has(player.id))
    .map((player) => ({ ...player, referenceRating: referenceRating(player) }))
    .filter((player): player is SelectedPlayer => player.referenceRating !== null)
    .sort(compareByReference);

  const men = activeRated.filter((player) => player.gender === "M").slice(0, 4);
  const women = activeRated.filter((player) => player.gender === "F").slice(0, 2);
  const selected = [...men, ...women].sort(compareByReference);
  const selectedIds = new Set(selected.map((player) => player.id));
  const selectedRatings = selected.map((player) => player.referenceRating);
  const complete = men.length === 4 && women.length === 2;

  const missingRatings = players.filter((player) => !disabledIds.has(player.id) && referenceRating(player) === null);
  const defaultedGender = players.filter((player) => player.genderSource === "default-m");

  return {
    average: complete ? average(selectedRatings) : null,
    menAverage: average(men.map((player) => player.referenceRating)),
    womenAverage: average(women.map((player) => player.referenceRating)),
    median: median(selectedRatings),
    menCount: men.length,
    womenCount: women.length,
    complete,
    selected,
    selectedIds,
    missingRatings,
    defaultedGender,
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
  const current = lineupSummary(team.players, disabledIds);
  if (!current.selectedIds.has(playerId)) return 0;
  if (current.average === null) return null;
  const nextDisabled = new Set(disabledIds);
  nextDisabled.add(playerId);
  const next = lineupSummary(team.players, nextDisabled);
  if (next.average === null) return null;
  return next.average - current.average;
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
  const nominal = lineupSummary(team.players);
  const scenario = lineupSummary(team.players, disabledIds);
  const allPlayers = [...team.players].sort(compareByReference);
  const scenarioRank = new Map(scenario.selected.map((player, index) => [player.id, index + 1] as const));
  const rosterReferenceRank = new Map(allPlayers.map((player, index) => [player.id, player.officialRank ?? index + 1] as const));
  const delta = nominal.average !== null && scenario.average !== null ? scenario.average - nominal.average : null;

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
          <strong>{scenario.average ?? "—"}</strong>
          <span>rating scénario · 4H + 2F</span>
          <small className={delta !== null && delta < 0 ? "scenario-diff scenario-diff--down" : "scenario-diff"}>
            {nominal.average === null ? "référence incomplète" : `référence ${nominal.average} · ${signed(delta)}`}
          </small>
        </div>
      </div>

      <div className="team-card__metrics">
        <Metric label="4 hommes retenus" value={scenario.menAverage ?? "—"} detail={`${scenario.menCount}/4`} />
        <Metric label="2 femmes retenues" value={scenario.womenAverage ?? "—"} detail={`${scenario.womenCount}/2`} />
        <Metric label="Médiane du six" value={scenario.median ?? "—"} detail={`${disabledIds.size} désactivé${disabledIds.size > 1 ? "s" : ""}`} />
      </div>

      {!scenario.complete ? (
        <div className="scenario-alert scenario-alert--error">
          <strong>Rating équipe impossible à calculer</strong>
          <span>
            Composition disponible : {scenario.menCount}/4 hommes et {scenario.womenCount}/2 femmes.
            {scenario.missingRatings.length
              ? ` Rating manquant pour ${scenario.missingRatings.map((player) => `${player.firstName} ${player.lastName}`).join(", ")}.`
              : " Il manque au moins un joueur éligible avec un rating exploitable."}
          </span>
        </div>
      ) : (
        <div className="scenario-note">
          <strong>Classement provisoire du six actif</strong>
          <span>J1 à J6 sont attribués uniquement aux 4 hommes + 2 femmes retenus. Les autres joueurs restent remplaçants jusqu'à leur entrée dans le six.</span>
        </div>
      )}

      {scenario.defaultedGender.length ? (
        <div className="scenario-alert scenario-alert--warning">
          <strong>Genre appliqué par défaut</strong>
          <span>{scenario.defaultedGender.map((player) => `${player.firstName} ${player.lastName}`).join(", ")} : genre PDGA non résolu, classé Homme selon la règle de fallback définie pour le scouting.</span>
        </div>
      ) : null}

      <div className="player-list player-list--scenario">
        {allPlayers.map((player) => {
          const disabled = disabledIds.has(player.id);
          const selected = scenario.selectedIds.has(player.id);
          const rank = scenarioRank.get(player.id) ?? null;
          const refRank = rosterReferenceRank.get(player.id) ?? null;
          const rating = referenceRating(player);
          const impact = impactIfDisabled(team, player.id, disabledIds);

          return (
            <div
              className={`player-row player-row--scenario${selected ? " player-row--selected" : " player-row--substitute"}${disabled ? " player-row--disabled" : ""}`}
              key={player.id}
            >
              <div className="player-ranks">
                <strong>{disabled ? "—" : rank ? `J${rank}` : "R"}</strong>
                <span>{disabled ? "désactivé" : rank ? (player.officialRank ? `off. J${player.officialRank}` : `réf. #${refRank}`) : `rempl. #${refRank}`}</span>
              </div>

              <div className="player-row__main">
                {player.pdgaNumber ? (
                  <Link className="player-link" href={`/player/${player.pdgaNumber}`}>{player.firstName} {player.lastName}</Link>
                ) : (
                  <strong>{player.firstName} {player.lastName}</strong>
                )}
                <span>
                  {player.gender === "F" ? "Femme" : "Homme"}
                  {player.genderSource === "default-m" ? "*" : ""}
                  {player.pdgaNumber ? ` · PDGA #${player.pdgaNumber}` : ""}
                  {selected ? " · retenu 4H+2F" : !disabled ? " · remplaçant" : ""}
                </span>
                <small className="player-impact">
                  {disabled
                    ? "hors scénario"
                    : !selected
                      ? "aucun impact immédiat tant qu'il reste remplaçant"
                      : impact === null
                        ? "absence : composition 4H+2F impossible"
                        : `impact si absent : ${signed(impact)}`}
                </small>
              </div>

              <div className="player-row__actions">
                <div className="player-row__rating">
                  <strong>{rating ?? "—"}</strong>
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

function ComparisonSummary({ teamA, teamB, disabledA, disabledB }: {
  teamA: ComparisonTeam;
  teamB: ComparisonTeam;
  disabledA: Set<string>;
  disabledB: Set<string>;
}) {
  const nominalA = lineupSummary(teamA.players);
  const nominalB = lineupSummary(teamB.players);
  const a = lineupSummary(teamA.players, disabledA);
  const b = lineupSummary(teamB.players, disabledB);
  const gap = a.average !== null && b.average !== null ? a.average - b.average : null;
  const nominalGap = nominalA.average !== null && nominalB.average !== null ? nominalA.average - nominalB.average : null;
  const menGap = a.menAverage !== null && b.menAverage !== null ? a.menAverage - b.menAverage : null;
  const womenGap = a.womenAverage !== null && b.womenAverage !== null ? a.womenAverage - b.womenAverage : null;
  const leader = gap === null || gap === 0 ? null : gap > 0 ? teamA : teamB;
  const swing = gap !== null && nominalGap !== null ? gap - nominalGap : null;

  return (
    <div className="duel-summary duel-summary--scenario">
      <div className="duel-summary__headline">
        <div>
          <p className="eyebrow">Simulation de composition</p>
          <h3>{gap === null ? "Comparaison incomplète" : leader ? `${flagEmoji(leader.countryCode)} ${leader.country} devant` : "Équilibre actuel"}</h3>
          <p className="duel-summary__copy">J1 à J6 correspondent au six actif, toujours composé de 4 hommes et 2 femmes.</p>
        </div>
        <div className="duel-gap">
          <strong>{gap === null ? "—" : Math.abs(gap)}</strong>
          <span>points d'écart</span>
          {swing !== null ? <small>mouvement vs référence : {signed(swing)}</small> : null}
        </div>
      </div>
      <div className="duel-metrics">
        <Metric label="Écart scénario" value={gap === null ? "—" : signed(gap)} detail={`${teamA.country} - ${teamB.country}`} />
        <Metric label="Écart référence" value={nominalGap === null ? "—" : signed(nominalGap)} detail="sans absence" />
        <Metric label="Écart hommes" value={menGap === null ? "—" : signed(menGap)} detail="4 hommes" />
        <Metric label="Écart femmes" value={womenGap === null ? "—" : signed(womenGap)} detail="2 femmes" />
        <Metric label="Désactivés" value={disabledA.size + disabledB.size} detail={`${teamA.country} ${disabledA.size} · ${teamB.country} ${disabledB.size}`} />
      </div>
    </div>
  );
}

export default function TeamComparison({ teams }: Props) {
  const [division, setDivision] = useState<"open" | "masters">("open");
  const [teamAId, setTeamAId] = useState("");
  const [teamBId, setTeamBId] = useState("");
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
      if (next.has(playerId)) next.delete(playerId); else next.add(playerId);
      return { ...current, [teamId]: [...next] };
    });
  };

  const resetTeam = (teamId: string) => setDisabledByTeam((current) => ({ ...current, [teamId]: [] }));
  const switchDivision = (next: "open" | "masters") => {
    setDivision(next);
    setTeamAId("");
    setTeamBId("");
  };

  return (
    <>
      <section className="france-section">
        <div className="section-heading">
          <div><p className="eyebrow">Équipe de France</p><h2>France en référence</h2></div>
          <div className="division-toggle" role="group" aria-label="Catégorie">
            <button className={division === "open" ? "active" : ""} onClick={() => switchDivision("open")}>Open</button>
            <button className={division === "masters" ? "active" : ""} onClick={() => switchDivision("masters")}>Masters</button>
          </div>
        </div>
        {france ? (
          <>
            <div className="scenario-toolbar"><span>Simulation France</span><button onClick={() => resetTeam(france.id)}>Réinitialiser</button></div>
            <TeamCard team={france} featured disabledIds={disabledFor(france.id)} onTogglePlayer={(id) => togglePlayer(france.id, id)} />
          </>
        ) : <p>Aucune équipe France disponible.</p>}
      </section>

      <section className="comparison-section">
        <div className="section-heading">
          <div><p className="eyebrow">Scouting</p><h2>Comparer deux équipes</h2><p className="section-copy">Le six actif est toujours construit avec 4 hommes + 2 femmes. Les rangs J1 à J6 sont recalculés après chaque désactivation.</p></div>
        </div>
        <div className="comparison-controls">
          <label>Équipe A<select value={effectiveTeamAId} onChange={(event) => setTeamAId(event.target.value)}>{divisionTeams.map((team) => <option key={team.id} value={team.id}>{flagEmoji(team.countryCode)} {team.country}</option>)}</select></label>
          <div className="versus">VS</div>
          <label>Équipe B<select value={effectiveTeamBId} onChange={(event) => setTeamBId(event.target.value)}>{divisionTeams.filter((team) => team.id !== effectiveTeamAId).map((team) => <option key={team.id} value={team.id}>{flagEmoji(team.countryCode)} {team.country}</option>)}</select></label>
        </div>

        {teamA && teamB ? (
          <>
            <div className="scenario-toolbar scenario-toolbar--comparison"><span>Scénarios indépendants</span><div><button onClick={() => resetTeam(teamA.id)}>Réinitialiser {teamA.country}</button><button onClick={() => resetTeam(teamB.id)}>Réinitialiser {teamB.country}</button></div></div>
            <ComparisonSummary teamA={teamA} teamB={teamB} disabledA={disabledFor(teamA.id)} disabledB={disabledFor(teamB.id)} />
            <div className="comparison-grid">
              <TeamCard team={teamA} disabledIds={disabledFor(teamA.id)} onTogglePlayer={(id) => togglePlayer(teamA.id, id)} />
              <TeamCard team={teamB} disabledIds={disabledFor(teamB.id)} onTogglePlayer={(id) => togglePlayer(teamB.id, id)} />
            </div>
          </>
        ) : null}
      </section>
    </>
  );
}
