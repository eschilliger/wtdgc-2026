"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ComparisonTeamCard,
  flagEmoji,
  lineupSummary,
  referenceRating,
  signed,
} from "./comparison/ComparisonTeamCard";

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

function Metric({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return <div className="comparison-metric"><span>{label}</span><strong>{value}</strong>{detail ? <small>{detail}</small> : null}</div>;
}

function LineupMatchups({ teamA, teamB, disabledA, disabledB }: { teamA: ComparisonTeam; teamB: ComparisonTeam; disabledA: Set<string>; disabledB: Set<string> }) {
  const a = lineupSummary(teamA.players, disabledA);
  const b = lineupSummary(teamB.players, disabledB);
  if (!a.complete || !b.complete) return null;

  return <div className="lineup-matchups lineup-matchups--v43">
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
  </div>;
}

function ComparisonSummary({ teamA, teamB, disabledA, disabledB, onResetDuel }: { teamA: ComparisonTeam; teamB: ComparisonTeam; disabledA: Set<string>; disabledB: Set<string>; onResetDuel: () => void }) {
  const [helpOpen, setHelpOpen] = useState(false);
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

  return <div className="duel-summary duel-summary--scenario">
    <div className="duel-summary__headline">
      <div><div className="duel-summary__title-row"><p className="eyebrow">Simulation de composition</p><button type="button" className="duel-info" aria-label="Comprendre les statistiques de simulation" aria-expanded={helpOpen} onClick={() => setHelpOpen((open) => !open)}>i</button></div><h3>{gap === null ? "Comparaison incomplète" : leader ? `${flagEmoji(leader.countryCode)} ${leader.country} devant` : "Équilibre actuel"}</h3></div>
      <div className="duel-summary__actions"><div className="duel-gap"><strong>{gap === null ? "—" : Math.abs(gap)}</strong><span>points d'écart</span>{swing !== null ? <small>mouvement vs référence : {signed(swing)}</small> : null}</div><button type="button" className="duel-reset" onClick={onResetDuel} disabled={disabledA.size + disabledB.size === 0}>Réinitialiser le duel</button></div>
    </div>
    {helpOpen ? <><button type="button" className="duel-info-backdrop" aria-label="Fermer l'aide" onClick={() => setHelpOpen(false)} /><aside className="duel-info-popover" role="dialog" aria-label="Comprendre la simulation"><div className="duel-info-popover__header"><strong>Comprendre la simulation</strong><button type="button" aria-label="Fermer" onClick={() => setHelpOpen(false)}>×</button></div><dl><div><dt>Écart scénario</dt><dd>Différence entre les deux équipes avec les absences actuellement simulées.</dd></div><div><dt>Écart référence</dt><dd>Différence entre les deux équipes sans aucune absence.</dd></div><div><dt>Écart hommes</dt><dd>Comparaison des moyennes des 4 hommes retenus.</dd></div><div><dt>Écart féminines</dt><dd>Comparaison des moyennes des 2 féminines retenues.</dd></div><div><dt>Dynamique 12 mois</dt><dd>Différence entre les évolutions moyennes récentes des deux équipes.</dd></div></dl><p className="duel-info-popover__rule"><strong>+ = avantage {teamA.country}</strong><span>− = avantage {teamB.country}</span></p></aside></> : null}
    <div className="duel-metrics"><Metric label="Écart scénario" value={gap === null ? "—" : signed(gap)} detail={`${teamA.country} - ${teamB.country}`} /><Metric label="Écart référence" value={nominalGap === null ? "—" : signed(nominalGap)} detail="sans absence" /><Metric label="Écart hommes" value={menGap === null ? "—" : signed(menGap)} detail="4 hommes" /><Metric label="Écart féminines" value={womenGap === null ? "—" : signed(womenGap)} detail="2 féminines" /><Metric label="Dynamique 12 mois" value={trendGap === null ? "—" : signed(trendGap)} detail={`${teamA.country} - ${teamB.country}`} /></div>
  </div>;
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
  const togglePlayer = (teamId: string, playerId: string) => setDisabledByTeam((current) => { const next = new Set(current[teamId] ?? []); if (next.has(playerId)) next.delete(playerId); else next.add(playerId); return { ...current, [teamId]: [...next] }; });
  const resetTeam = (teamId: string) => setDisabledByTeam((current) => ({ ...current, [teamId]: [] }));
  const resetDuel = (a: string, b: string) => setDisabledByTeam((current) => ({ ...current, [a]: [], [b]: [] }));
  const switchDivision = (next: "open" | "masters") => { setDivision(next); setTeamAId(""); setTeamBId(""); window.history.replaceState(null, "", `/compare?division=${next}`); };

  return <>
    <section className="france-section"><div className="section-heading"><div><p className="eyebrow">Équipe de France</p><h2>France en référence</h2></div><div className="division-toggle"><button className={division === "open" ? "active" : ""} onClick={() => switchDivision("open")}>Open</button><button className={division === "masters" ? "active" : ""} onClick={() => switchDivision("masters")}>Masters</button></div></div>{france ? <ComparisonTeamCard team={france} featured disabledIds={disabledFor(france.id)} onTogglePlayer={(id) => togglePlayer(france.id, id)} onReset={() => resetTeam(france.id)} /> : null}</section>
    <section className="comparison-section"><div className="section-heading"><div><p className="eyebrow">Comparateur</p><h2>Comparer deux équipes</h2></div></div><div className="comparison-controls"><label>Équipe A<select value={effectiveTeamAId} onChange={(event) => setTeamAId(event.target.value)}>{divisionTeams.map((team) => <option key={team.id} value={team.id}>{flagEmoji(team.countryCode)} {team.country}</option>)}</select></label><div className="versus">VS</div><label>Équipe B<select value={effectiveTeamBId} onChange={(event) => setTeamBId(event.target.value)}>{divisionTeams.filter((team) => team.id !== effectiveTeamAId).map((team) => <option key={team.id} value={team.id}>{flagEmoji(team.countryCode)} {team.country}</option>)}</select></label></div>{teamA && teamB ? <><ComparisonSummary teamA={teamA} teamB={teamB} disabledA={disabledFor(teamA.id)} disabledB={disabledFor(teamB.id)} onResetDuel={() => resetDuel(teamA.id, teamB.id)} /><div className="comparison-grid"><ComparisonTeamCard team={teamA} disabledIds={disabledFor(teamA.id)} onTogglePlayer={(id) => togglePlayer(teamA.id, id)} onReset={() => resetTeam(teamA.id)} /><ComparisonTeamCard team={teamB} disabledIds={disabledFor(teamB.id)} onTogglePlayer={(id) => togglePlayer(teamB.id, id)} onReset={() => resetTeam(teamB.id)} /></div><LineupMatchups teamA={teamA} teamB={teamB} disabledA={disabledFor(teamA.id)} disabledB={disabledFor(teamB.id)} /></> : null}</section>
  </>;
}
