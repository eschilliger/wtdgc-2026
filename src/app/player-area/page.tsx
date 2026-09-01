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

export default async function PlayerAreaPage() {
  const claims = await requirePlayerAccess();
  const { association, matches } = await loadPlayerArea(claims.uid);

  return (
    <main className={styles.area}>
      <div className={styles.areaInner}>
        <header className={styles.areaHeader}><div><h1>Mes matchs</h1><p>{association?.playerDisplayName ?? claims.email ?? "Compte WTDGC"}</p></div></header>

        {!association ? (
          <section className={styles.placeholder}><strong>Aucun joueur associé à ce compte.</strong><p>Ton profil joueur doit être associé avant que tes matchs puissent apparaître ici.</p></section>
        ) : matches.length === 0 ? (
          <section className={styles.placeholder}><strong>Aucun match publié pour le moment.</strong><p>{divisionLabel(association.division)} · les prochains matchs apparaîtront ici dès leur publication.</p></section>
        ) : (
          <section className={matchStyles.section}>
            <div className={matchStyles.heading}><div><span>{divisionLabel(association.division)}</span><h2>Matchs publiés</h2></div><strong>{matches.length}</strong></div>
            <div className={matchStyles.grid}>
              {matches.map((match, index) => (
                <article className={`${matchStyles.card} ${index === 0 ? matchStyles.next : ""}`} key={match.id}>
                  <div className={matchStyles.cardTop}>
                    <div><span className={matchStyles.round}>Round {match.roundNumber}</span><h3>France · {match.opponentCountry}</h3></div>
                    <div className={matchStyles.badges}>
                      <span className={`${matchStyles.playerStatus} ${match.playerStatus === "starter" ? matchStyles.starter : matchStyles.substitute}`}>{match.playerStatus === "starter" ? "Titulaire" : "Remplaçant"}</span>
                      {index === 0 ? <span className={matchStyles.nextBadge}>Prochain</span> : null}
                    </div>
                  </div>
                  <dl className={matchStyles.facts}>
                    <div><dt>Départ</dt><dd>{formatStart(match.scheduledStart)}</dd></div>
                    <div><dt>Parcours</dt><dd>{match.course || "À confirmer"}</dd></div>
                    <div><dt>Trou</dt><dd>{match.startingHole || "À confirmer"}</dd></div>
                  </dl>
                  {match.matchups.length ? <div className={matchStyles.assignments}>
                    <strong>Mes confrontations</strong>
                    {match.matchups.map((matchup) => <div className={matchStyles.assignment} key={matchup.id}>
                      <span>{gameLabel(matchup.game)}</span>
                      <p><b>{matchup.francePlayers.join(" + ")}</b><em>vs</em><b>{matchup.opponentPlayers.join(" + ")}</b></p>
                    </div>)}
                  </div> : match.playerStatus === "substitute" ? <p className={matchStyles.noAssignment}>Aucune confrontation attribuée pour le moment.</p> : null}
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
