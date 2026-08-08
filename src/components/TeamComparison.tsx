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

function teamRatingSummary(players: ComparisonPlayer[]) {
  const rated = players.filter((player): player is ComparisonPlayer & { rating: number } => player.rating !== null);
  const ranked = (gender: "M" | "F", limit: number) => rated
    .filter((player) => player.gender === gender)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, limit);

  const men = ranked("M", 4);
  const women = ranked("F", 2);
  const selected = [...men, ...women];
  const complete = men.length === 4 && women.length === 2;
  const selectedRatings = selected.map((player) => player.rating);
  const ratedMen = rated.filter((player) => player.gender === "M");
  const ratedWomen = rated.filter((player) => player.gender === "F");
  const bestMan = ratedMen.sort((a, b) => b.rating - a.rating)[0] ?? null;
  const bestWoman = ratedWomen.sort((a, b) => b.rating - a.rating)[0] ?? null;

  return {
    average: complete ? average(selectedRatings) : null,
    complete,
    menCount: men.length,
    womenCount: women.length,
    selectedIds: new Set(selected.map((player) => player.id)),
    menAverage: average(men.map((player) => player.rating)),
    womenAverage: average(women.map((player) => player.rating)),
    median: median(selectedRatings),
    bestMan,
    bestWoman,
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

function TeamCard({ team, featured = false }: { team: ComparisonTeam; featured?: boolean }) {
  const summary = teamRatingSummary(team.players);
  const sortedPlayers = [...team.players].sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));

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
          <strong>{summary.average ?? "—"}</strong>
          <span>{summary.complete ? "moyenne top 4H + 2F" : `${summary.menCount}/4 H · ${summary.womenCount}/2 F`}</span>
        </div>
      </div>

      <div className="team-card__metrics">
        <Metric label="Top 4 hommes" value={summary.menAverage ?? "—"} />
        <Metric label="Top 2 femmes" value={summary.womenAverage ?? "—"} />
        <Metric label="Médiane sélection" value={summary.median ?? "—"} />
      </div>

      <div className="player-list">
        {sortedPlayers.map((player) => (
          <div className={`player-row${summary.selectedIds.has(player.id) ? " player-row--selected" : ""}`} key={player.id}>
            <div className="player-row__main">
              {player.pdgaNumber ? (
                <Link className="player-link" href={`/player/${player.pdgaNumber}`}>{player.firstName} {player.lastName}</Link>
              ) : (
                <strong>{player.firstName} {player.lastName}</strong>
              )}
              <span>
                {player.pdgaNumber ? `PDGA #${player.pdgaNumber}` : "PDGA non renseigné"}
                {player.jerseyNumber ? ` · #${player.jerseyNumber}` : ""}
                {player.gender ? ` · ${player.gender}` : ""}
                {summary.selectedIds.has(player.id) ? " · retenu" : ""}
              </span>
            </div>
            <div className="player-row__rating">{player.rating ?? "—"}</div>
          </div>
        ))}
      </div>
    </article>
  );
}

function ComparisonSummary({ teamA, teamB }: { teamA: ComparisonTeam; teamB: ComparisonTeam }) {
  const a = teamRatingSummary(teamA.players);
  const b = teamRatingSummary(teamB.players);
  const ratingGap = a.average !== null && b.average !== null ? a.average - b.average : null;
  const menGap = a.menAverage !== null && b.menAverage !== null ? a.menAverage - b.menAverage : null;
  const womenGap = a.womenAverage !== null && b.womenAverage !== null ? a.womenAverage - b.womenAverage : null;
  const leader = ratingGap === null || ratingGap === 0 ? null : ratingGap > 0 ? teamA : teamB;

  return (
    <div className="duel-summary">
      <div className="duel-summary__headline">
        <div>
          <p className="eyebrow">Lecture rapide</p>
          <h3>{leader ? `${flagEmoji(leader.countryCode)} ${leader.country} devant` : "Équilibre actuel"}</h3>
        </div>
        <div className="duel-gap">
          <strong>{ratingGap === null ? "—" : signed(Math.abs(ratingGap))}</strong>
          <span>écart rating WTDGC</span>
        </div>
      </div>

      <div className="duel-metrics">
        <Metric
          label="Rating WTDGC"
          value={ratingGap === null ? "—" : signed(ratingGap)}
          detail={`${teamA.country} vs ${teamB.country}`}
        />
        <Metric label="Écart hommes" value={menGap === null ? "—" : signed(menGap)} detail="top 4 hommes" />
        <Metric label="Écart femmes" value={womenGap === null ? "—" : signed(womenGap)} detail="top 2 femmes" />
        <Metric
          label="Meilleur homme"
          value={a.bestMan && b.bestMan ? Math.max(a.bestMan.rating, b.bestMan.rating) : a.bestMan?.rating ?? b.bestMan?.rating ?? "—"}
          detail={a.bestMan && b.bestMan
            ? (a.bestMan.rating >= b.bestMan.rating ? `${a.bestMan.firstName} ${a.bestMan.lastName}` : `${b.bestMan.firstName} ${b.bestMan.lastName}`)
            : a.bestMan ? `${a.bestMan.firstName} ${a.bestMan.lastName}` : b.bestMan ? `${b.bestMan.firstName} ${b.bestMan.lastName}` : undefined}
        />
        <Metric
          label="Meilleure femme"
          value={a.bestWoman && b.bestWoman ? Math.max(a.bestWoman.rating, b.bestWoman.rating) : a.bestWoman?.rating ?? b.bestWoman?.rating ?? "—"}
          detail={a.bestWoman && b.bestWoman
            ? (a.bestWoman.rating >= b.bestWoman.rating ? `${a.bestWoman.firstName} ${a.bestWoman.lastName}` : `${b.bestWoman.firstName} ${b.bestWoman.lastName}`)
            : a.bestWoman ? `${a.bestWoman.firstName} ${a.bestWoman.lastName}` : b.bestWoman ? `${b.bestWoman.firstName} ${b.bestWoman.lastName}` : undefined}
        />
      </div>
    </div>
  );
}

export default function TeamComparison({ teams }: Props) {
  const [division, setDivision] = useState<"open" | "masters">("open");

  const divisionTeams = useMemo(
    () => teams.filter((team) => team.division === division).sort((a, b) => a.country.localeCompare(b.country, "fr")),
    [teams, division],
  );

  const france = divisionTeams.find((team) => team.countryCode === "FR") ?? divisionTeams[0];
  const firstOpponent = divisionTeams.find((team) => team.id !== france?.id);
  const secondOpponent = divisionTeams.find((team) => team.id !== france?.id && team.id !== firstOpponent?.id);

  const [teamAId, setTeamAId] = useState<string>("");
  const [teamBId, setTeamBId] = useState<string>("");

  const effectiveTeamAId = divisionTeams.some((team) => team.id === teamAId) ? teamAId : france?.id ?? "";
  const effectiveTeamBId = divisionTeams.some((team) => team.id === teamBId && team.id !== effectiveTeamAId)
    ? teamBId
    : firstOpponent?.id ?? secondOpponent?.id ?? "";

  const teamA = divisionTeams.find((team) => team.id === effectiveTeamAId);
  const teamB = divisionTeams.find((team) => team.id === effectiveTeamBId);

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
        {france ? <TeamCard team={france} featured /> : <p>Aucune équipe France disponible dans cette catégorie.</p>}
      </section>

      <section className="comparison-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Scouting</p>
            <h2>Comparer deux équipes</h2>
            <p className="section-copy">Compare les ratings WTDGC (top 4 hommes + top 2 femmes), les écarts par genre et les joueurs les mieux classés.</p>
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

        {teamA && teamB ? <ComparisonSummary teamA={teamA} teamB={teamB} /> : null}

        <div className="comparison-grid">
          {teamA && <TeamCard team={teamA} />}
          {teamB && <TeamCard team={teamB} />}
        </div>
      </section>
    </>
  );
}
