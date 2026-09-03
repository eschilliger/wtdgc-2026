import type { WtdgcDivision, WtdgcRoundNumber } from "../../domain/wtdgc/competition";
import { db } from "../firebase/admin";
import { WTDGC_EVENT_ID } from "./competition.repository";

export type StaffRoundUsage = {
  roundNumber: WtdgcRoundNumber;
  publicationStatus: "draft" | "published";
  selectedPlayerIds: string[];
};

type RoundDoc = {
  division?: WtdgcDivision;
  roundNumber?: number;
  publicationStatus?: string;
  roster?: { selectedPlayerIds?: string[] } | null;
};

export async function loadStaffPlayerUsage(division: WtdgcDivision): Promise<StaffRoundUsage[]> {
  const snapshot = await db
    .collection("events")
    .doc(WTDGC_EVENT_ID)
    .collection("competitionRounds")
    .where("division", "==", division)
    .get();

  return snapshot.docs
    .map((doc) => doc.data() as RoundDoc)
    .map((round) => ({
      roundNumber: Number(round.roundNumber) as WtdgcRoundNumber,
      publicationStatus: round.publicationStatus === "published" ? "published" as const : "draft" as const,
      selectedPlayerIds: Array.isArray(round.roster?.selectedPlayerIds)
        ? round.roster.selectedPlayerIds.filter((id): id is string => typeof id === "string")
        : [],
    }))
    .filter((round) => round.roundNumber >= 1 && round.roundNumber <= 8)
    .sort((a, b) => a.roundNumber - b.roundNumber);
}
