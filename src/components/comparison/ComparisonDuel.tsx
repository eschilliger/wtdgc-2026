"use client";

import { useState } from "react";
import type { ComparisonTeam } from "../TeamComparison";
import {
  flagEmoji,
  lineupSelectionSummary,
  lineupSummary,
  signed,
} from "./ComparisonTeamCard";

function Metric({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return <div className="comparison-metric"><span>{label}</span><strong>{value}</strong>{detail ? <small>{detail}</small> : null}</div>;
}

function scenarioFor(team: ComparisonTeam, disabledIds: Set<string>, selectedIds?: Set<string>) {
  return selectedIds ? lineupSelectionSummary(team.players, selectedIds) : lineupSummary(team.players, disabledIds);
}

export function ComparisonSummary({ teamA, teamB, disabledA, disabledB, selectedA, selectedB, onResetDuel }: {
  teamA: ComparisonTeam;
  teamB: ComparisonTeam;
  disabledA: Set<string>;
  disabledB: Set<string>;
  selectedA?: Set<string>;
  selectedB?: Set<string>;
  onResetDuel: () => void;
}) {
  const [helpOpen, setHelpOpen] = useState(false);
  const nominalA = lineupSummary(teamA.players);
  const nominalB = lineupSummary(teamB.players);
  const a = scenarioFor(teamA, disabledA, selectedA);
  const b = scenarioFor(teamB, disabledB, selectedB);
  const gap = a.average !== null && b.average !== null ? a.average - b.average : null;
  const nominalGap = nominalA.average !== null && nominalB.average !== null ? nominalA.average - nominalB.average : null;
  const menGap = a.menAverage !== null && b.menAverage !== null ? a.menAverage - b.menAverage : null;
  const womenGap = a.womenAverage !== null && b.womenAverage !== null ? a.womenAverage - b.womenAverage : null;
  const trendGap = a.trend12Months !== null && b.trend12Months !== null ? a.trend12Months - b.trend12Months : null;
  const leader = gap === null || gap === 0 ? null : gap > 0 ? teamA : teamB;
  const swing = gap !== null && nominalGap !== null ? gap - nominalGap : null;
  const menLabel = teamA.division === "open" ? "Écart MPO" : "Écart MP40 / MP50";
  const womenLabel = teamA.division === "open" ? "Écart FPO" : "Écart FP40";
  const menDetail = teamA.division === "open" ? "4 MPO" : "3 MP40 + 1 MP50";
  const womenDetail = teamA.division === "open" ? "2 FPO" : "2 FP40";

  return <div className="duel-summary duel-summary--scenario">
    <div className="duel-summary__headline">
      <div><div className="duel-summary__title-row"><p className="eyebrow">Simulation de composition</p><button type="button" className="duel-info" aria-label="Comprendre les statistiques de simulation" aria-expanded={helpOpen} onClick={() => setHelpOpen((open) => !open)}>i</button></div><h3>{gap === null ? "Comparaison incomplète" : leader ? `${flagEmoji(leader.countryCode)} ${leader.country} devant` : "Équilibre actuel"}</h3></div>
      <div className="duel-summary__actions"><div className="duel-gap"><strong>{gap === null ? "—" : Math.abs(gap)}</strong><span>points d'écart</span>{swing !== null ? <small>mouvement vs référence : {signed(swing)}</small> : null}</div><button type="button" className="duel-reset" onClick={onResetDuel}>Réinitialiser le duel</button></div>
    </div>
    {helpOpen ? <><button type="button" className="duel-info-backdrop" aria-label="Fermer l'aide" onClick={() => setHelpOpen(false)} /><aside className="duel-info-popover" role="dialog" aria-label="Comprendre la simulation"><div className="duel-info-popover__header"><strong>Comprendre la simulation</strong><button type="button" aria-label="Fermer" onClick={() => setHelpOpen(false)}>×</button></div><dl><div><dt>Écart scénario</dt><dd>Différence entre les deux compositions actuellement sélectionnées.</dd></div><div><dt>Écart référence</dt><dd>Différence entre les deux équipes sans modification.</dd></div><div><dt>Écart hommes</dt><dd>Comparaison des moyennes des 4 hommes retenus.</dd></div><div><dt>Écart féminines</dt><dd>Comparaison des moyennes des 2 féminines retenues.</dd></div><div><dt>Dynamique 12 mois</dt><dd>Différence entre les évolutions moyennes récentes.</dd></div></dl><p className="duel-info-popover__rule"><strong>+ = avantage {teamA.country}</strong><span>− = avantage {teamB.country}</span></p></aside></> : null}
    <div className="duel-metrics"><Metric label="Écart scénario" value={gap === null ? "—" : signed(gap)} detail={`${teamA.country} - ${teamB.country}`} /><Metric label="Écart référence" value={nominalGap === null ? "—" : signed(nominalGap)} detail="sans modification" /><Metric label={menLabel} value={menGap === null ? "—" : signed(menGap)} detail={menDetail} /><Metric label={womenLabel} value={womenGap === null ? "—" : signed(womenGap)} detail={womenDetail} /><Metric label="Dynamique 12 mois" value={trendGap === null ? "—" : signed(trendGap)} detail={`${teamA.country} - ${teamB.country}`} /></div>
  </div>;
}
