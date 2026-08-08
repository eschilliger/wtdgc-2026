"use client";

import { useMemo, useState, type PointerEvent } from "react";
import styles from "./RatingHistoryChart.module.css";

export type RatingHistoryPoint = {
  rating: number;
  effectiveDate: string;
  roundsUsed?: number | null;
};

type Period = "6m" | "1y" | "3y" | "all";

type Props = {
  history: RatingHistoryPoint[];
  currentRating?: number | null;
};

function parseDate(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatMonth(value: string) {
  const date = parseDate(value);
  if (!date) return value;
  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
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

function trendLabel(value: number | null) {
  if (value === null) return "données insuffisantes";
  const absolute = Math.abs(value);
  if (absolute <= 3) return "stable";
  if (absolute <= 9) return value > 0 ? "légère hausse" : "légère baisse";
  return value > 0 ? "hausse nette" : "baisse nette";
}

function trendClass(value: number | null) {
  if (value === null || Math.abs(value) <= 3) return undefined;
  return value > 0 ? styles.up : styles.down;
}

export default function RatingHistoryChart({ history, currentRating = null }: Props) {
  const [period, setPeriod] = useState<Period>("3y");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [pinned, setPinned] = useState(false);

  const sortedHistory = useMemo(
    () => [...history].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate)),
    [history],
  );

  const filteredHistory = useMemo(() => {
    if (period === "all" || !sortedHistory.length) return sortedHistory;
    const latestDate = parseDate(sortedHistory[sortedHistory.length - 1].effectiveDate);
    if (!latestDate) return sortedHistory;
    const cutoff = new Date(latestDate);
    if (period === "6m") cutoff.setUTCMonth(cutoff.getUTCMonth() - 6);
    else cutoff.setUTCFullYear(cutoff.getUTCFullYear() - (period === "1y" ? 1 : 3));
    return sortedHistory.filter((item) => {
      const date = parseDate(item.effectiveDate);
      return date ? date >= cutoff : true;
    });
  }, [period, sortedHistory]);

  const chart = useMemo(() => {
    if (filteredHistory.length < 2) return null;
    const ratings = filteredHistory.map((item) => item.rating);
    const rawMin = Math.min(...ratings);
    const rawMax = Math.max(...ratings);
    const padding = Math.max(10, Math.ceil((rawMax - rawMin) * 0.12));
    const chartMin = Math.floor((rawMin - padding) / 10) * 10;
    const chartMax = Math.ceil((rawMax + padding) / 10) * 10;
    const span = Math.max(1, chartMax - chartMin);
    const dates = filteredHistory.map((item) => parseDate(item.effectiveDate)?.getTime() ?? 0);
    const firstTime = dates[0];
    const lastTime = dates[dates.length - 1];
    const timeSpan = Math.max(1, lastTime - firstTime);

    const points = filteredHistory.map((item, index) => ({
      ...item,
      x: 4 + ((dates[index] - firstTime) / timeSpan) * 94,
      y: 91 - ((item.rating - chartMin) / span) * 78,
    }));

    const tickStep = span <= 80 ? 20 : span <= 160 ? 25 : 50;
    const ticks: number[] = [];
    const firstTick = Math.ceil(chartMin / tickStep) * tickStep;
    for (let value = firstTick; value <= chartMax; value += tickStep) ticks.push(value);

    return {
      points,
      polyline: points.map((point) => `${point.x},${point.y}`).join(" "),
      chartMin,
      chartMax,
      span,
      ticks,
    };
  }, [filteredHistory]);

  const current = currentRating ?? (sortedHistory.length ? sortedHistory[sortedHistory.length - 1].rating : null);
  const best = sortedHistory.length ? Math.max(...sortedHistory.map((item) => item.rating)) : null;
  const delta3 = deltaFromMonths(sortedHistory, current, 3);
  const delta6 = deltaFromMonths(sortedHistory, current, 6);
  const delta12 = deltaFromMonths(sortedHistory, current, 12);
  const active = chart && activeIndex !== null ? chart.points[activeIndex] : null;

  const nearestIndex = (event: PointerEvent<SVGSVGElement>) => {
    if (!chart) return null;
    const rect = event.currentTarget.getBoundingClientRect();
    const xPercent = Math.min(98, Math.max(4, ((event.clientX - rect.left) / rect.width) * 100));
    let nearest = 0;
    let distance = Number.POSITIVE_INFINITY;
    chart.points.forEach((point, index) => {
      const candidate = Math.abs(point.x - xPercent);
      if (candidate < distance) {
        nearest = index;
        distance = candidate;
      }
    });
    return nearest;
  };

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const next = nearestIndex(event);
    if (next !== null) setActiveIndex(next);
  };

  const handlePointerDown = (event: PointerEvent<SVGSVGElement>) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const next = nearestIndex(event);
    if (next !== null) setActiveIndex(next);
    setPinned(true);
  };

  const recentHistory = [...filteredHistory].reverse().slice(0, 8);

  return (
    <div className={styles.root}>
      <div className={styles.kpis}>
        <div><span>Rating actuel</span><strong>{current ?? "—"}</strong></div>
        <div><span>Record</span><strong>{best ?? "—"}</strong></div>
        <div><span>3 mois</span><strong className={trendClass(delta3)}>{signed(delta3)}</strong><small>{trendLabel(delta3)}</small></div>
        <div><span>6 mois</span><strong className={trendClass(delta6)}>{signed(delta6)}</strong><small>{trendLabel(delta6)}</small></div>
        <div><span>12 mois</span><strong className={trendClass(delta12)}>{signed(delta12)}</strong><small>{trendLabel(delta12)}</small></div>
      </div>

      <div className={styles.toolbar} role="group" aria-label="Période de l'historique">
        <button className={period === "6m" ? styles.active : ""} onClick={() => { setPeriod("6m"); setPinned(false); }}>6 mois</button>
        <button className={period === "1y" ? styles.active : ""} onClick={() => { setPeriod("1y"); setPinned(false); }}>1 an</button>
        <button className={period === "3y" ? styles.active : ""} onClick={() => { setPeriod("3y"); setPinned(false); }}>3 ans</button>
        <button className={period === "all" ? styles.active : ""} onClick={() => { setPeriod("all"); setPinned(false); }}>Tout</button>
      </div>

      {chart ? (
        <div className={styles.wrap}>
          <svg
            className={styles.chart}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            role="img"
            aria-label="Courbe interactive d'évolution du rating. Sur mobile, touchez ou faites glisser le doigt pour sélectionner un relevé."
            onPointerMove={handlePointerMove}
            onPointerDown={handlePointerDown}
            onPointerLeave={() => { if (!pinned) setActiveIndex(null); }}
          >
            {chart.ticks.map((tick) => {
              const y = 91 - ((tick - chart.chartMin) / chart.span) * 78;
              return <line key={tick} className={tick % 100 === 0 ? styles.milestone : styles.gridLine} x1="4" y1={y} x2="98" y2={y} />;
            })}
            {current !== null ? (
              <line
                className={styles.currentLine}
                x1="4"
                y1={91 - ((current - chart.chartMin) / chart.span) * 78}
                x2="98"
                y2={91 - ((current - chart.chartMin) / chart.span) * 78}
              />
            ) : null}
            <polyline points={chart.polyline} />
            {active ? (
              <>
                <line className={styles.cursor} x1={active.x} y1="10" x2={active.x} y2="91" />
                <circle className={styles.dot} cx={active.x} cy={active.y} r="1.8" />
              </>
            ) : null}
          </svg>

          <div className={styles.yAxis} aria-hidden="true">
            {chart.ticks.map((tick) => (
              <span
                key={tick}
                className={tick % 100 === 0 ? styles.majorTick : ""}
                style={{ top: `${91 - ((tick - chart.chartMin) / chart.span) * 78}%` }}
              >{tick}</span>
            ))}
          </div>

          {active ? (
            <div
              className={`${styles.tooltip}${active.x > 72 ? ` ${styles.tooltipLeft}` : ""}`}
              style={{ left: `${active.x}%`, top: `${active.y}%` }}
              aria-live="polite"
            >
              <strong>{active.rating}</strong>
              <span>{formatMonth(active.effectiveDate)}</span>
              {active.roundsUsed != null ? <small>{active.roundsUsed} rounds utilisés</small> : null}
            </div>
          ) : null}

          <div className={styles.axis} aria-hidden="true">
            <span>{formatMonth(chart.points[0].effectiveDate)}</span>
            <span>{formatMonth(chart.points[chart.points.length - 1].effectiveDate)}</span>
          </div>
          <p className={styles.touchHint}>Sur mobile : touchez ou glissez sur la courbe pour afficher un relevé.</p>
        </div>
      ) : (
        <p className="empty-state">Il faut au moins deux ratings historisés pour tracer une tendance.</p>
      )}

      <div className={styles.historyList} aria-label="Derniers ratings">
        {recentHistory.map((item, index) => {
          const previous = recentHistory[index + 1];
          const delta = previous ? item.rating - previous.rating : null;
          return (
            <div className={styles.historyRow} key={item.effectiveDate}>
              <span>{formatMonth(item.effectiveDate)}</span>
              <strong>{item.rating}</strong>
              <small>{item.roundsUsed != null ? `${item.roundsUsed} rounds` : "—"}</small>
              <b className={delta !== null && Math.abs(delta) >= 4 ? (delta > 0 ? styles.up : styles.down) : undefined}>{delta === null ? "" : signed(delta)}</b>
            </div>
          );
        })}
      </div>
    </div>
  );
}
