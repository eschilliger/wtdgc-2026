import "server-only";
import { db } from "@/server/firebase/admin";
import type { PdgaApiPlayer } from "@/server/pdga/types";

export async function upsertPdgaProfile(player: PdgaApiPlayer, syncedAt: string) {
  const pdgaNumber = Number.parseInt(player.pdga_number, 10);
  if (!Number.isFinite(pdgaNumber)) return;

  await db.collection("pdgaProfiles").doc(String(pdgaNumber)).set(
    {
      pdgaNumber,
      firstName: player.first_name,
      lastName: player.last_name,
      membershipStatus: player.membership_status ?? null,
      membershipExpirationDate: player.membership_expiration_date ?? null,
      classification: player.classification ?? null,
      city: player.city ?? null,
      stateProv: player.state_prov ?? null,
      country: player.country ?? null,
      rating: player.rating ? Number.parseInt(player.rating, 10) : null,
      ratingEffectiveDate: player.rating_effective_date ?? null,
      officialStatus: player.official_status ?? null,
      officialExpirationDate: player.official_expiration_date ?? null,
      lastModified: player.last_modified ?? null,
      syncedAt,
    },
    { merge: true },
  );
}

export async function upsertPdgaYearlyStats(pdgaNumber: number, year: number, payload: unknown, syncedAt: string) {
  await db
    .collection("pdgaProfiles")
    .doc(String(pdgaNumber))
    .collection("yearlyStats")
    .doc(String(year))
    .set({ pdgaNumber, year, payload, syncedAt }, { merge: true });
}
