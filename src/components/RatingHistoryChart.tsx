"use client";

import { useMemo, useState, type PointerEvent } from "react";

export type RatingHistoryPoint = {
  rating: number;
  effectiveDate: string;
  roundsUsed?: number | null;
};

type Period = "1y" | "3y" | "all";

type Props = {
  history: RatingHistoryPoint[];
  currentRating?: number | null;
};

function parseDate(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatTooltipDate(value: string) {
  const date = parseDate(value);
  if (!date) return value;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatShortDate(value: string) {
  const date = parseDate(value);
  if (!date) return value;
  return new Intl.DateTimeFormat("fr-FR", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

function ratingAtOrBefore(history: RatingHistoryPoint[], target: Date) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const date = parseDate(history[index].effectiveDate);
    if (date && date <= target) return history[index].rating;
  }
  return null;
}

function deltaFromMonths(history: RatingHistoryPoint[], current: number | null, months: number) {
  if (current === null || !history.length) return null;
  const latestDate = parseDate(history[history.length - 1].effectiveDate);
  if (!latestDate) return null;
  const target = new Date(latestDate);
  target.setUTCMonth(target.getUTCMonth() - months);
  const previous = ratingAtOrBefore(history, target);
  return previous === null ? null : current - previous;
}

function signed(value: number | null) {
  if (value === null) return "—";
  return value > 0 ? `+${value}` : String(value);
}

export default function RatingHistoryChart({ history, currentRating = null }: Props) {
  const [period, setPeriod] = useState<Period>("3y");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const sortedHistory = useMemo(
    () => [...history].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate)),
    [history],
  );

  const filteredHistory = useMemo(() => {
    if (period === "all" || !sortedHistory.length) return sortedHistory;
    const latestDate = parseDate(sortedHistory[sortedHistory.length - 1].effectiveDate);
    if (!latestDate) return sortedHistory;
    const cutoff = new Date(latestDate);
    cutoff.setUTCFullYear(cutoff.getUTCFullYear() - (period === "1y" ? 1 : 3));
    return sortedHistory.filter((item) => {
      const date = parseDate(item.effectiveDate);
      return date ? date >= cutoff : true;
    });
  }, [period, sortedHistory]);

  const chart = useMemo(() => {
    if (filteredHistory.length < 2) return null;
    const ratings = filteredHistory.map((item) => item.rating);
    const min = Math.min(...ratings);
    const max = Math.max(...ratings);
    const padding = Math.max(8, Math.ceil((max - min) * 0.15));
    const chartMin = min - padding;
    const chartMax = max + padding;
    const span = Math.max(1, chartMax - chartMin);
    const points = filteredHistory.map((item, index) => ({
      ...item,
      x: (index / (filteredHistory.length - 1)) * 100,
      y: 92 - ((item.rating - chartMin) / span) * 76,
    }));
    return {
      points,
      polyline: points.map((point) => `${point.x},${point.y}`).join(" "),
      min,
      max,
    };
  }, [filteredHistory]);

  const current = currentRating ?? (sortedHistory.length ? sortedHistory[sortedHistory.length - 1].rating : null);
  const best = sortedHistory.length ? Math.max(...sortedHistory.map((item) => item.rating)) : null;
  const delta3 = deltaFromMonths(sortedHistory, current, 3);
  const delta6 = deltaFromMonths(sortedHistory, current, 6);
  const delta12 = deltaFromMonths(sortedHistory, current, 12);
  const hovered = chart && hoveredIndex !== null ? chart.points[hoveredIndex] : null;

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!chart) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const index = Math.round(ratio * (chart.points.length - 1));
    setHoveredIndex(index);
  };

  return (
    <div className="rating-history-v2">
      <div className="rating-kpis">
        <div><span>Rating actuel</span><strong>{current ?? "—"}</strong></div>
        <div><span>Record</span><strong>{best ?? "—"}</strong></div>
        <div><span>3 mois</span><strong className={delta3 !== null && delta3 > 0 ? "trend-up" : delta3 !== null && delta3 < 0 ? "trend-down" : ""}>{signed(delta3)}</strong></div>
        <div><span>6 mois</span><strong className={delta6 !== null && delta6 > 0 ? "trend-up" : delta6 !== null && delta6 < 0 ? "trend-down" : ""}>{signed(delta6)}</strong></div>
        <div><span>12 mois</span><strong className={delta12 !== null && delta12 > 0 ? "trend-up" : delta12 !== null && delta12 < 0 ? "trend-down" : ""}>{signed(delta12)}</strong></div>
      </div>

      <div className="chart-toolbar" role="group" aria-label="Période de l'historique">
        <button className={period === "1y" ? "active" : ""} onClick={() => setPeriod("1y")}>1 an</button>
        <button className={period === "3y" ? "active" : ""} onClick={() => setPeriod("3y")}>3 ans</button>
        <button className={period === "all" ? "active" : ""} onClick={() => setPeriod("all")}>Tout</button>
      </div>

      {chart ? (
        <div className="rating-chart-wrap">
          <svg
            className="rating-chart rating-chart--interactive"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            role="img"
            aria-label="Courbe interactive d'évolution du rating"
            onPointerMove={handlePointerMove}
            onPointerLeave={() => setHoveredIndex(null)}
          >
            <line x1="0" y1="92" x2="100" y2="92" />
            <polyline points={chart.polyline} />
            {hovered ? (
              <>
                <line className="rating-chart__cursor" x1={hovered.x} y1="8" x2={hovered.x} y2="92" />
                <circle className="rating-chart__dot" cx={hovered.x} cy={hovered.y} r="1.8" />
              </>
            ) : null}
          </svg>

          {hovered ? (
            <div
              className={`rating-tooltip${hovered.x > 72 ? " rating-tooltip--left" : ""}`}
              style={{ left: `${hovered.x}%`, top: `${hovered.y}%` }}
              aria-live="polite"
            >
              <strong>{hovered.rating}</strong>
              <span>{formatTooltipDate(hovered.effectiveDate)}</span>
              {hovered.roundsUsed != null ? <small>{hovered.roundsUsed} rounds utilisés</small> : null}
            </div>
          ) : null}

          <div className="rating-chart-axis" aria-hidden="true">
            <span>{formatShortDate(chart.points[0].effectiveDate)}</span>
            <span>{formatShortDate(chart.points[chart.points.length - 1].effectiveDate)}</span>
          </div>
        </div>
      ) : (
        <p className="empty-state">Il faut au moins deux ratings historisés pour tracer une tendance.</p>
      )}

      <div className="rating-history-list">
        {[...filteredHistory].reverse().slice(0, 8).map((item) => (
          <div key={item.effectiveDate}>
            <span>{formatTooltipDate(item.effectiveDate)}</span>
            <strong>{item.rating}</strong>
            {item.roundsUsed != null ? <small>{item.roundsUsed} rounds</small> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
