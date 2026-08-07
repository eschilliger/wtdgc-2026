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

function flagEmoji(code: string) {
  if (!/^[A-Z]{2}$/.test(code)) return "🏳️";
  return String.fromCodePoint(...[...code].map((char) => 127397 + char.charCodeAt(0)));
}

function teamRatingSummary(players: ComparisonPlayer[]) {
  const ranked = (gender: "M" | "F", limit: number) => players
    .filter((player) => player.gender === gender && player.rating !== null)
    .sort((a, b) => (b.rating as number) - (a.rating as number))
    .slice(0, limit);

  const men = ranked("M", 4);
  const women = ranked("F", 2);
  const selected = [...men, ...women];
  const complete = men.length === 4 && women.length === 2;

  if (!complete) {
    return { average: null, complete, menCount: men.length, womenCount: women.length, selectedIds: new Set(selected.map((p) => p.id)) };
  }

  const average = Math.round(
    selected.reduce((sum, player) => sum + (player.rating as number), 0) / selected.length,
  );

  return { average, complete, menCount: men.length, womenCount: women.length, selectedIds: new Set(selected.map((p) => p.id)) };
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

      <div className="player-list">
        {sortedPlayers.map((player) => (
          <div className="player-row" key={player.id}>
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
            <p className="section-copy">La France est proposée par défaut, mais tu peux sélectionner deux autres pays. La comparaison reste toujours dans la même catégorie.</p>
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

        <div className="comparison-grid">
          {teamA && <TeamCard team={teamA} />}
          {teamB && <TeamCard team={teamB} />}
        </div>
      </section>
    </>
  );
}
