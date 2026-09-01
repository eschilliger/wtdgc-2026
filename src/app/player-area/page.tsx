import Link from "next/link";
import styles from "../../components/auth/Auth.module.css";
import matchStyles from "../../components/player/PlayerMatches.module.css";
import { requirePlayerAccess } from "../../server/auth/session";
import { loadPlayerArea } from "../../server/repositories/player-area.repository";

function divisionLabel(division: "open" | "masters") { return division === "open" ? "Open" : "Masters"; }
function gameLabel(game: "singles-1" | "singles-2" | "doubles-1" | "doubles-2") {
  return game === "singles-1" ? "Simple 1" : game === "singles-2" ? "Simple 2" : game === "doubles-1" ? "Double 1" : "Double 2";
}
function formatStart(value: string | null) {
  if (!value) return "Horaire à confirmer";
  const [date, time] = value.split("T");
  if (!date) return value;
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}${time ? ` · ${time.slice(0, 5)}` : ""}`;
}
function formatRating(value: number | null) {
  if (value === null) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
function signedRating(value: number | null) {
  if (value === null) return "—";
  if (value > 0) return `+${formatRating(value)}`;
  return formatRating(value);
}

type PlayerAreaPageProps = {
  searchParams: Promise<{ round?: string | string[] }>;
};

export default async function PlayerAreaPage({ searchParams }: PlayerAreaPageProps) {
  const claims = await requirePlayerAccess();
  const { association, matches } = await loadPlayerArea(claims.uid);
  const params = await searchParams;
  const requestedRoundValue = Array.isArray(params.round) ? params.round[0] : params.round;
  const requestedRound = requestedRoundValue ? Number.parseInt(requestedRoundValue, 10) : null;
  const nextMatch = matches[0] ?? null;
  const selectedMatch = requestedRound !== null
    ? matches.find((match) => match.roundNumber === requestedRound) ?? nextMatch
    : nextMatch;

  return (
    <main className={styles.area}>
      <div className={styles.areaInner}>
        <header className={styles.areaHeader}><div><h1>Mes matchs</h1><p>{association?.playerDisplayName ?? claims.email ?? "Compte WTDGC"}</p></div></header>

        {!association ? (
          <section className={styles.placeholder}><strong>Aucun joueur associé à ce compte.</strong><p>Ton profil joueur doit être associé avant que tes matchs puissent apparaître ici.</p></section>
        ) : matches.length === 0 ? (
          <section className={styles.placeholder}><strong>Aucun match publié pour le moment.</strong><p>{divisionLabel(association.division)} · les prochains matchs apparaîtront ici dès leur publication.</p></section>
        ) : selectedMatch ? (
          <section className={matchStyles.section}>
            <div className={matchStyles.heading}><div><span>{divisionLabel(association.division)}</span><h2>Matchs publiés</h2></div></div>

            <nav className={matchStyles.roundSelector} aria-label="Choisir un round à afficher">
              {matches.map((match) => {
                const active = match.id === selectedMatch.id;
                const next = match.id === nextMatch?.id;
                return <Link key={match.id} href={`/player-area?round=${match.roundNumber}`} aria-current={active ? "page" : undefined} className={active ? matchStyles.activeRound : ""}>R{match.roundNumber}{next ? <span>Prochain</span> : null}</Link>;
              })}
            </nav>

            <div className={matchStyles.grid}>
              <article className={`${matchStyles.card} ${selectedMatch.id === nextMatch?.id ? matchStyles.next : ""}`} key={selectedMatch.id}>
                <div className={matchStyles.cardTop}>
                  <div><span className={matchStyles.round}>Round {selectedMatch.roundNumber}</span><h3>France · {selectedMatch.opponentCountry}</h3></div>
                  <div className={matchStyles.badges}>
                    <span className={`${matchStyles.playerStatus} ${selectedMatch.playerStatus === "starter" ? matchStyles.starter : matchStyles.substitute}`}>{selectedMatch.playerStatus === "starter" ? "Titulaire" : "Remplaçant"}</span>
                    {selectedMatch.id === nextMatch?.id ? <span className={matchStyles.nextBadge}>Prochain</span> : null}
                  </div>
                </div>

                <dl className={matchStyles.facts}>
                  <div><dt>Départ</dt><dd>{formatStart(selectedMatch.scheduledStart)}</dd></div>
                  <div><dt>Parcours</dt><dd>{selectedMatch.course || "À confirmer"}</dd></div>
                  <div><dt>Trou</dt><dd>{selectedMatch.startingHole || "À confirmer"}</dd></div>
                </dl>

                {selectedMatch.matchups.length ? (
                  <section className={matchStyles.assignments}>
                    <div className={matchStyles.assignmentsHeading}><div><span>Affectations officielles</span><strong>Simples et doubles du round</strong></div></div>
                    <div className={matchStyles.matchupsList}>
                      {selectedMatch.matchups.map((matchup) => (
                        <article className={`${matchStyles.assignment} ${matchup.includesPlayer ? matchStyles.myAssignment : ""}`} key={matchup.id}>
                          <div className={matchStyles.assignmentTop}>
                            <div className={matchStyles.gameTitle}><strong>{gameLabel(matchup.game)}</strong><span className={matchStyles.slotLabel}>{matchup.slotLabel || "Positions à confirmer"}</span></div>
                            {matchup.includesPlayer ? <strong className={matchStyles.myBadge}>Ma confrontation</strong> : null}
                          </div>

                          <div className={matchStyles.matchupSides}>
                            <div className={matchStyles.side}>
                              <span className={matchStyles.sideLabel}>France</span>
                              <div className={matchStyles.playersList}>
                                {matchup.francePlayers.map((player) => <div className={matchStyles.playerRow} key={player.id}><span className={matchStyles.playerSlot}>{player.slot}</span><strong>{player.name}</strong><b>{formatRating(player.rating)}</b></div>)}
                              </div>
                            </div>
                            <div className={matchStyles.side}>
                              <span className={matchStyles.sideLabel}>{selectedMatch.opponentCountry}</span>
                              <div className={matchStyles.playersList}>
                                {matchup.opponentPlayers.length ? matchup.opponentPlayers.map((player) => <div className={matchStyles.playerRow} key={player.id}><span className={matchStyles.playerSlot}>{player.slot}</span><strong>{player.name}</strong><b>{formatRating(player.rating)}</b></div>) : <div className={matchStyles.playerMissing}>Adversaire à renseigner</div>}
                              </div>
                            </div>
                          </div>

                          <div className={matchStyles.matchupRating}>
                            <span>{matchup.format === "double" ? "Rating moyen" : "Rating"} France <strong>{formatRating(matchup.franceRating)}</strong></span>
                            <b className={matchup.ratingGap === null || matchup.ratingGap === 0 ? matchStyles.ratingEven : matchup.ratingGap > 0 ? matchStyles.ratingPositive : matchStyles.ratingNegative}>Écart {signedRating(matchup.ratingGap)}</b>
                            <span>{matchup.format === "double" ? "Rating moyen" : "Rating"} {selectedMatch.opponentCountry} <strong>{formatRating(matchup.opponentRating)}</strong></span>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ) : <p className={matchStyles.noAssignment}>Aucune confrontation publiée pour le moment.</p>}
              </article>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
