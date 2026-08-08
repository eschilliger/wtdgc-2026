"use client";

import { useMemo, useState } from "react";

export type SeasonStat = {
  label: string;
  value: string;
  hint?: string;
};

export type SeasonStatsData = {
  year: number;
  syncedAt?: string | null;
  stats: SeasonStat[];
};

type Props = {
  seasons: SeasonStatsData[];
};

export default function SeasonStats({ seasons }: Props) {
  const available = useMemo(() => seasons.filter((season) => season.stats.length > 0).sort((a, b) => b.year - a.year), [seasons]);
  const [year, setYear] = useState(available[0]?.year ?? seasons[0]?.year ?? 2026);
  const selected = available.find((season) => season.year === year) ?? available[0];

  if (!selected) {
    return <p className="empty-state">Aucune statistique saison exploitable n'est encore disponible pour ce joueur.</p>;
  }

  return (
    <>
      <div className="season-toolbar" role="group" aria-label="Saison PDGA">
        {seasons.sort((a, b) => b.year - a.year).map((season) => (
          <button
            type="button"
            key={season.year}
            className={selected.year === season.year ? "active" : ""}
            disabled={!season.stats.length}
            onClick={() => setYear(season.year)}
          >
            {season.year}
          </button>
        ))}
      </div>

      <div className="stats-grid stats-grid--curated">
        {selected.stats.map((stat) => (
          <div className="stat-tile stat-tile--curated" key={stat.label}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
            {stat.hint ? <small>{stat.hint}</small> : null}
          </div>
        ))}
      </div>
      {selected.syncedAt ? <p className="season-sync">Synchronisée le {selected.syncedAt}</p> : null}
    </>
  );
}
