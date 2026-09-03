import Link from "next/link";
import { cookies } from "next/headers";
import { DefaultOpenRoster } from "../../components/staff/DefaultOpenRoster";
import { StaffDivisionSwitch } from "../../components/staff/StaffDivisionSwitch";
import { StaffPlayerUsage } from "../../components/staff/StaffPlayerUsage";
import { ScoutingRosterPanel } from "../../components/scouting/ScoutingRosterPanel";
import authStyles from "../../components/auth/Auth.module.css";
import roundStyles from "../../components/staff/StaffRounds.module.css";
import type { WtdgcDivision } from "../../domain/wtdgc/competition";
import { requireStaffAccess } from "../../server/auth/session";
import { loadFranceOpenRosterData } from "../../server/repositories/france-roster.repository";
import { listRoundsForStaff } from "../../server/repositories/round-management.repository";
import { loadScoutingTeams } from "../../server/repositories/scouting.repository";
import { loadStaffPlayerUsage } from "../../server/repositories/staff-player-usage.repository";

export const dynamic = "force-dynamic";

function statusLabel(status: "draft" | "published") {
  return status === "published" ? "Publié" : "Brouillon";
}

function statusClass(status: "draft" | "published") {
  return status === "published" ? roundStyles.published : roundStyles.draft;
}

function parseDivision(value: string | undefined | null): WtdgcDivision | null {
  return value === "open" || value === "masters" ? value : null;
}

function RoundsSection({ division, rounds }: { division: WtdgcDivision; rounds: Awaited<ReturnType<typeof listRoundsForStaff>> }) {
  const label = division === "open" ? "Open" : "Masters";
  return (
    <section className={roundStyles.section}>
      <div className={roundStyles.header}>
        <h2>Rounds · France {label}</h2>
        <p>Prépare les compositions et les informations de chaque round.</p>
      </div>
      <div className={roundStyles.grid}>
        {rounds.map((round) => (
          <Link className={roundStyles.card} href={`/staff/rounds/${division}/${round.roundNumber}`} key={round.id}>
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
  );
}

export default async function StaffPage({ searchParams }: { searchParams: Promise<{ division?: string }> }) {
  const claims = await requireStaffAccess();
  const params = await searchParams;
  const cookieStore = await cookies();
  const division = parseDivision(params.division)
    ?? parseDivision(cookieStore.get("wtdgc_staff_division")?.value)
    ?? "open";

  if (division === "open") {
    const [{ roster }, rounds, openTeams, usage] = await Promise.all([
      loadFranceOpenRosterData(),
      listRoundsForStaff("open"),
      loadScoutingTeams("open"),
      loadStaffPlayerUsage("open"),
    ]);
    const franceTeam = openTeams.find((team) => team.country.trim().toLowerCase() === "france");
    if (!franceTeam) throw new Error("France Open scouting team not found.");

    return (
      <main className={authStyles.area}>
        <div className={authStyles.areaInner}>
          <header className={authStyles.areaHeader}>
            <div><h1>Espace Staff</h1><p>{claims.email ?? "Compte staff"}</p></div>
          </header>
          <StaffDivisionSwitch division={division} />
          <DefaultOpenRoster team={franceTeam} roster={roster} />
          <StaffPlayerUsage division={division} team={franceTeam} rounds={usage} />
          <RoundsSection division={division} rounds={rounds} />
        </div>
      </main>
    );
  }

  const [rounds, mastersTeams, usage] = await Promise.all([
    listRoundsForStaff("masters"),
    loadScoutingTeams("masters"),
    loadStaffPlayerUsage("masters"),
  ]);
  const franceMasters = mastersTeams.find((team) => team.country.trim().toLowerCase() === "france");
  if (!franceMasters) throw new Error("France Masters scouting team not found.");

  return (
    <main className={authStyles.area}>
      <div className={authStyles.areaInner}>
        <header className={authStyles.areaHeader}>
          <div><h1>Espace Staff</h1><p>{claims.email ?? "Compte staff"}</p></div>
        </header>
        <StaffDivisionSwitch division={division} />
        <section className={roundStyles.section}>
          <div className={roundStyles.header}>
            <h2>Équipe de France · Masters</h2>
            <p>Roster inscrit et données de référence de la division Masters.</p>
          </div>
          <ScoutingRosterPanel team={franceMasters} />
        </section>
        <StaffPlayerUsage division={division} team={franceMasters} rounds={usage} />
        <RoundsSection division={division} rounds={rounds} />
      </div>
    </main>
  );
}
