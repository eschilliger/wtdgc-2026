import type { ComparisonPlayer, ComparisonTeam } from "../TeamComparison";
import type { WtdgcDivision } from "../../domain/wtdgc/competition";
import { isMehdi } from "../../domain/wtdgc/round-assignments";
import type { StaffRoundUsage } from "../../server/repositories/staff-player-usage.repository";
import styles from "./StaffPlayerUsage.module.css";

function rating(player: ComparisonPlayer) {
  return player.referenceRating ?? player.rating ?? -1;
}

function rankPlayers(players: ComparisonPlayer[]) {
  return [...players].sort((a, b) => {
    const ratingGap = rating(b) - rating(a);
    if (ratingGap) return ratingGap;
    return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, "fr");
  });
}

function orderedRoster(division: WtdgcDivision, team: ComparisonTeam) {
  if (division === "open") {
    return [
      ...rankPlayers(team.players.filter((player) => player.gender === "M")).map((player) => ({ player, category: "MPO" })),
      ...rankPlayers(team.players.filter((player) => player.gender === "F")).map((player) => ({ player, category: "FPO" })),
    ];
  }

  const mp40 = rankPlayers(team.players.filter((player) => player.gender === "M" && !isMehdi(player)));
  const mp50 = team.players.find(isMehdi);
  const fp40 = rankPlayers(team.players.filter((player) => player.gender === "F"));

  return [
    ...mp40.map((player) => ({ player, category: "MP40" })),
    ...(mp50 ? [{ player: mp50, category: "MP50" }] : []),
    ...fp40.map((player) => ({ player, category: "FP40" })),
  ];
}

export function StaffPlayerUsage({ division, team, rounds }: { division: WtdgcDivision; team: ComparisonTeam; rounds: StaffRoundUsage[] }) {
  const roster = orderedRoster(division, team);
  const usageByRound = new Map(rounds.map((round) => [round.roundNumber, round] as const));

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <div>
          <h2>Utilisation des joueurs</h2>
          <p>Récapitulatif des compositions enregistrées par round. Ordre du roster initial {division === "open" ? "MPO puis FPO" : "MP40, MP50 puis FP40"}.</p>
        </div>
        <div className={styles.legend} aria-label="Légende des statuts">
          <span><i className={styles.publishedDot} />Publié</span>
          <span><i className={styles.draftDot} />Brouillon</span>
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Joueur</th>
              {Array.from({ length: 8 }, (_, index) => <th key={index}>R{index + 1}</th>)}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {roster.map(({ player, category }) => {
              const roundStates = Array.from({ length: 8 }, (_, index) => {
                const round = usageByRound.get(index + 1 as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8);
                const selected = round?.selectedPlayerIds.includes(player.id) ?? false;
                return { round, selected };
              });
              const total = roundStates.filter((state) => state.selected).length;

              return (
                <tr key={player.id}>
                  <th scope="row">
                    <span className={styles.category}>{category}</span>
                    <strong>{player.firstName} {player.lastName}</strong>
                  </th>
                  {roundStates.map(({ round, selected }, index) => (
                    <td key={index}>
                      {selected ? (
                        <span
                          className={`${styles.usageMark} ${round?.publicationStatus === "published" ? styles.published : styles.draft}`}
                          title={`Round ${index + 1} · ${round?.publicationStatus === "published" ? "Publié" : "Brouillon"}`}
                          aria-label={`Round ${index + 1} ${round?.publicationStatus === "published" ? "publié" : "brouillon"}`}
                        >✓</span>
                      ) : <span className={styles.empty}>—</span>}
                    </td>
                  ))}
                  <td><strong className={`${styles.total} ${total >= 8 ? styles.maxTotal : total >= 6 ? styles.highTotal : ""}`}>{total}</strong></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className={styles.help}>Le total compte les rounds où le joueur est sélectionné dans une composition enregistrée, y compris les brouillons.</p>
    </section>
  );
}
