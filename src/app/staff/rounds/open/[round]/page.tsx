import { notFound } from "next/navigation";
import { LogoutButton } from "../../../../../components/auth/LogoutButton";
import authStyles from "../../../../../components/auth/Auth.module.css";
import { OpenRoundEditor } from "../../../../../components/staff/OpenRoundEditor";
import type { WtdgcRoundNumber } from "../../../../../domain/wtdgc/competition";
import { requireStaffAccess } from "../../../../../server/auth/session";
import { loadOpenRoundManagement } from "../../../../../server/repositories/round-management.repository";

function parseRound(value: string): WtdgcRoundNumber | null {
  const round = Number.parseInt(value, 10);
  return round >= 1 && round <= 8 ? round as WtdgcRoundNumber : null;
}

export default async function StaffOpenRoundPage({ params }: { params: Promise<{ round: string }> }) {
  const claims = await requireStaffAccess();
  const { round: rawRound } = await params;
  const roundNumber = parseRound(rawRound);
  if (!roundNumber) notFound();

  const data = await loadOpenRoundManagement(roundNumber);

  return (
    <main className={authStyles.area}>
      <div className={authStyles.areaInner}>
        <header className={authStyles.areaHeader}>
          <div>
            <h1>Préparation du round</h1>
            <p>{claims.email ?? "Compte staff"} · France Open</p>
          </div>
          <LogoutButton />
        </header>
        <OpenRoundEditor data={data} />
      </div>
    </main>
  );
}
