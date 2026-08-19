import { notFound } from "next/navigation";
import authStyles from "../../../../../components/auth/Auth.module.css";
import { OpenRoundEditor } from "../../../../../components/staff/OpenRoundEditor";
import type { WtdgcRoundNumber } from "../../../../../domain/wtdgc/competition";
import { requireStaffAccess } from "../../../../../server/auth/session";
import { loadRoundManagement } from "../../../../../server/repositories/round-management.repository";

function parseRound(value: string): WtdgcRoundNumber | null {
  const round = Number.parseInt(value, 10);
  return round >= 1 && round <= 8 ? round as WtdgcRoundNumber : null;
}

export default async function StaffMastersRoundPage({ params }: { params: Promise<{ round: string }> }) {
  await requireStaffAccess();
  const { round: rawRound } = await params;
  const roundNumber = parseRound(rawRound);
  if (!roundNumber) notFound();
  const data = await loadRoundManagement("masters", roundNumber);
  return <main className={authStyles.area}><div className={authStyles.areaInner}><OpenRoundEditor data={data} /></div></main>;
}
