"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ComparisonTeamCard, flagEmoji } from "./comparison/ComparisonTeamCard";
import { ComparisonSummary, LineupMatchups } from "./comparison/ComparisonDuel";

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
    window.history.replaceState(null, "", `/compare?division=${next}`);
  };

  return <>
    <section className="france-section">
      <div className="section-heading"><div><p className="eyebrow">Équipe de France</p><h2>France en référence</h2></div><div className="division-toggle"><button className={division === "open" ? "active" : ""} onClick={() => switchDivision("open")}>Open</button><button className={division === "masters" ? "active" : ""} onClick={() => switchDivision("masters")}>Masters</button></div></div>
      {france ? <ComparisonTeamCard team={france} featured disabledIds={disabledFor(france.id)} onTogglePlayer={(id) => togglePlayer(france.id, id)} onReset={() => resetTeam(france.id)} /> : null}
    </section>
    <section className="comparison-section">
      <div className="section-heading"><div><p className="eyebrow">Comparateur</p><h2>Comparer deux équipes</h2></div></div>
      <div className="comparison-controls"><label>Équipe A<select value={effectiveTeamAId} onChange={(event) => setTeamAId(event.target.value)}>{divisionTeams.map((team) => <option key={team.id} value={team.id}>{flagEmoji(team.countryCode)} {team.country}</option>)}</select></label><div className="versus">VS</div><label>Équipe B<select value={effectiveTeamBId} onChange={(event) => setTeamBId(event.target.value)}>{divisionTeams.filter((team) => team.id !== effectiveTeamAId).map((team) => <option key={team.id} value={team.id}>{flagEmoji(team.countryCode)} {team.country}</option>)}</select></label></div>
      {teamA && teamB ? <>
        <ComparisonSummary teamA={teamA} teamB={teamB} disabledA={disabledFor(teamA.id)} disabledB={disabledFor(teamB.id)} onResetDuel={() => resetDuel(teamA.id, teamB.id)} />
        <div className="comparison-grid"><ComparisonTeamCard team={teamA} disabledIds={disabledFor(teamA.id)} onTogglePlayer={(id) => togglePlayer(teamA.id, id)} onReset={() => resetTeam(teamA.id)} /><ComparisonTeamCard team={teamB} disabledIds={disabledFor(teamB.id)} onTogglePlayer={(id) => togglePlayer(teamB.id, id)} onReset={() => resetTeam(teamB.id)} /></div>
        <LineupMatchups teamA={teamA} teamB={teamB} disabledA={disabledFor(teamA.id)} disabledB={disabledFor(teamB.id)} />
      </> : null}
    </section>
  </>;
}
