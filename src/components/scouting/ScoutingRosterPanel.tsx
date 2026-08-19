"use client";

import Link from "next/link";
import type { ComparisonPlayer, ComparisonTeam } from "../TeamComparison";
import styles from "./ScoutingRosterPanel.module.css";

function rating(player: ComparisonPlayer) {
  return player.referenceRating ?? player.rating;
}

function comparePlayers(a: ComparisonPlayer, b: ComparisonPlayer) {
  const ar = rating(a) ?? -1;
  const br = rating(b) ?? -1;
  if (ar !== br) return br - ar;
  return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, "fr");
}

export function nominalSixIds(team: ComparisonTeam) {
  const men = team.players.filter((player) => player.gender === "M").sort(comparePlayers).slice(0, 4);
  const women = team.players.filter((player) => player.gender === "F").sort(comparePlayers).slice(0, 2);
  return new Set([...men, ...women].map((player) => player.id));
}

function trend(value: number | null | undefined) {
  if (value == null) return "—";
  const sign = value > 0 ? "+" : "";
  const arrow = value >= 4 ? "↗" : value <= -4 ? "↘" : "→";
  return `${sign}${value} ${arrow}`;
}

function flagEmoji(code: string) {
  if (!/^[A-Z]{2}$/.test(code)) return "🏳️";
  return String.fromCodePoint(...[...code].map((char) => 127397 + char.charCodeAt(0)));
}

function PlayerName({ player, division }: { player: ComparisonPlayer; division: "open" | "masters" }) {
  const name = <><span className="player-name-first">{player.firstName}</span>{" "}<span className="player-name-last">{player.lastName}</span></>;
  return player.pdgaNumber ? <Link className="player-link" href={`/player/${player.pdgaNumber}?division=${division}`}>{name}</Link> : <strong>{name}</strong>;
}

export function ScoutingRosterPanel({
  team,
  selectedIds,
  editable = false,
  onToggle,
  title,
  helper,
}: {
  team: ComparisonTeam;
  selectedIds?: Set<string>;
  editable?: boolean;
  onToggle?: (player: ComparisonPlayer) => void;
  title?: string;
  helper?: string;
}) {
  const activeIds = selectedIds ?? nominalSixIds(team);
  const sorted = [...team.players].sort(comparePlayers);
  const selected = sorted.filter((player) => activeIds.has(player.id)).sort(comparePlayers);
  const rankById = new Map(selected.map((player, index) => [player.id, index + 1] as const));
  const selectedRatings = selected.map(rating).filter((value): value is number => value != null);
  const average = selectedRatings.length === 6 ? Math.round(selectedRatings.reduce((sum, value) => sum + value, 0) / 6) : null;

  return (
    <article className={`team-card team-card--v42 ${styles.panel}`}>
      <div className="team-card__header">
        <div>
          <span className="team-country-kicker">{flagEmoji(team.countryCode)} {team.country}</span>
          <h3>{title ?? (team.country === "France" ? "Équipe de France" : team.country)}</h3>
          {helper ? <p>{helper}</p> : null}
        </div>
        <div className="team-rating-block">
          <span>rating WTDGC</span>
          <strong>{average ?? "—"}</strong>
        </div>
      </div>

      <div className="scenario-story">
        <strong>{editable ? "Composition du match" : "Six de référence"}</strong>
        <div><span>{selected.length}/6 joueurs sélectionnés</span></div>
      </div>

      <div className="team-roster">
        {sorted.map((player) => {
          const isSelected = activeIds.has(player.id);
          const rank = rankById.get(player.id) ?? null;
          const refRating = rating(player);
          const statusClass = isSelected ? "starter" : "substitute";
          return (
            <div className={`player-row player-row--scenario ${isSelected ? "player-row--selected" : "player-row--substitute"}`} key={player.id}>
              <div className="player-ranks">
                <strong>{rank ? `J${rank}` : "R"}</strong>
                <span>{rank ? `réf. #${rank}` : "rempl."}</span>
                <span className={`player-gender-picto player-gender-picto--${player.gender === "F" ? "female" : "male"}`} aria-label={player.gender === "F" ? "Féminine" : "Homme"}>{player.gender === "F" ? "F" : "H"}</span>
              </div>
              <div className="player-row__main">
                <div className="player-name-line">
                  <PlayerName player={player} division={team.division} />
                  <span className={`player-status player-status--${statusClass} player-status--desktop-only`}>
                    <span className="player-status__desktop">{isSelected ? "Titulaire" : "Remplaçant"}</span>
                  </span>
                </div>
                <span className="player-meta-line">{player.gender === "F" ? "Féminine" : "Homme"}{player.pdgaNumber ? ` · PDGA #${player.pdgaNumber}` : ""}</span>
                <div className="player-mobile-core">
                  <div className="player-mobile-rating"><span>Rating</span><strong>{refRating ?? "—"}</strong></div>
                  <div className="player-mobile-trend"><span>Évolution sur 12 mois</span><strong>{trend(player.trend12Months)}</strong></div>
                </div>
              </div>
              <div className="player-row__actions">
                <div className="player-row__rating">
                  <strong>{refRating ?? "—"}</strong>
                  <span>{player.referenceRating != null ? "rating WTDGC" : "rating PDGA"}</span>
                  {player.rating != null && player.referenceRating != null ? <small>PDGA live {player.rating}</small> : null}
                  <small className="player-rating-trend">12 mois {trend(player.trend12Months)}</small>
                </div>
                {editable ? <button type="button" className="player-toggle player-toggle--desktop" onClick={() => onToggle?.(player)}>{isSelected ? "Retirer" : "Sélectionner"}</button> : null}
              </div>
              {editable ? (
                <div className="player-mobile-actions">
                  <span className={`player-status player-status--${statusClass}`}><span className="player-status__mobile">{isSelected ? "Titulaire" : "Remplaçant"}</span></span>
                  <label className="player-switch">
                    <input type="checkbox" checked={isSelected} onChange={() => onToggle?.(player)} aria-label={`${isSelected ? "Retirer" : "Sélectionner"} ${player.firstName} ${player.lastName}`} />
                    <i aria-hidden="true" />
                  </label>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </article>
  );
}
