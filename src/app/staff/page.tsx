import Link from "next/link";
import { DefaultOpenRoster } from "../../components/staff/DefaultOpenRoster";
import authStyles from "../../components/auth/Auth.module.css";
import roundStyles from "../../components/staff/StaffRounds.module.css";
import { requireStaffAccess } from "../../server/auth/session";
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

        <DefaultOpenRoster team={franceTeam} roster={roster} />

        <section className={roundStyles.section}>
          <div className={roundStyles.header}>
            <h2>Rounds · France Open</h2>
            <p>Prépare les compositions et les informations de chaque round.</p>
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
