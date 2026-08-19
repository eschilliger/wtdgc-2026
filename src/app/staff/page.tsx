import Link from "next/link";
import { DefaultOpenRoster } from "../../components/staff/DefaultOpenRoster";
import authStyles from "../../components/auth/Auth.module.css";
import roundStyles from "../../components/staff/StaffRounds.module.css";
import { requireStaffAccess, roleFromClaims } from "../../server/auth/session";
import { loadFranceOpenRosterData } from "../../server/repositories/france-roster.repository";
import { listOpenRoundsForStaff } from "../../server/repositories/round-management.repository";
import { loadScoutingTeams } from "../../server/repositories/scouting.repository";

export const dynamic = "force-dynamic";

function statusLabel(status: "draft" | "ready" | "published") {
  return status === "published" ? "Publié" : status === "ready" ? "Prêt" : "Brouillon";
}

function statusClass(status: "draft" | "ready" | "published") {
  return status === "published" ? roundStyles.published : status === "ready" ? roundStyles.ready : roundStyles.draft;
}

export default async function StaffPage() {
  const claims = await requireStaffAccess();
  const role = roleFromClaims(claims);
  const [{ roster }, rounds, openTeams] = await Promise.all([
    loadFranceOpenRosterData(),
    listOpenRoundsForStaff(),
    loadScoutingTeams("open"),
  ]);
  const franceTeam = openTeams.find((team) => team.country.trim().toLowerCase() === "france");
  if (!franceTeam) throw new Error("France Open scouting team not found.");

  return (
    <main className={authStyles.area}>
      <div className={authStyles.areaInner}>
        <header className={authStyles.areaHeader}>
          <div>
            <h1>Espace Staff</h1>
            <p>{claims.email ?? "Compte staff"}</p>
          </div>
        </header>
        {role === "admin" ? (
          <section className={authStyles.placeholder} style={{ marginBottom: 18 }}>
            <strong>Mode administrateur.</strong>
            <p>Tu disposes également de la vue Joueur et de l’Administration via la navigation principale.</p>
          </section>
        ) : null}
        <section className={authStyles.placeholder}>
          <strong>Préparation WTDGC privée.</strong>
          <p>Le Default Match Roster et les rounds en brouillon/prêts restent réservés au Staff/Admin. Seul un round explicitement publié pourra ensuite alimenter la vue « Mes matchs ».</p>
        </section>

        <DefaultOpenRoster team={franceTeam} roster={roster} />

        <section className={roundStyles.section}>
          <div className={roundStyles.header}>
            <h2>Rounds · France Open</h2>
            <p>Prépare chaque round à partir du roster par défaut, puis passe-le en Prêt et enfin en Publié lorsque les informations sont confirmées.</p>
          </div>
          <div className={roundStyles.grid}>
            {rounds.map((round) => (
              <Link className={roundStyles.card} href={`/staff/rounds/open/${round.roundNumber}`} key={round.id}>
                <div className={roundStyles.title}>
                  <strong>Round {round.roundNumber}</strong>
                  <span className={`${roundStyles.status} ${statusClass(round.publicationStatus)}`}>{statusLabel(round.publicationStatus)}</span>
                </div>
                <div className={roundStyles.meta}>{round.opponentTeamId ? "Adversaire renseigné" : "Adversaire à définir"}</div>
                <div className={roundStyles.meta}>{round.scheduledStart ? `Départ ${round.scheduledStart.replace("T", " ")}` : "Horaire à définir"}</div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
