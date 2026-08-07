import { db } from "@/server/firebase/admin";
import type { PdgaApiPlayer } from "@/server/pdga/types";

function parseRating(value?: string) {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function ratingHistoryId(effectiveDate: string | null, rating: number | null) {
  if (effectiveDate) return effectiveDate;
  if (rating !== null) return `rating-${rating}`;
  return null;
}

export async function upsertPdgaProfile(player: PdgaApiPlayer, syncedAt: string) {
  const pdgaNumber = Number.parseInt(player.pdga_number, 10);
  if (!Number.isFinite(pdgaNumber)) return;

  const rating = parseRating(player.rating);
  const ratingEffectiveDate = player.rating_effective_date ?? null;
  const profileRef = db.collection("pdgaProfiles").doc(String(pdgaNumber));

  await profileRef.set(
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
      currentRating: rating,
      ratingEffectiveDate,
      officialStatus: player.official_status ?? null,
      officialExpirationDate: player.official_expiration_date ?? null,
      lastModified: player.last_modified ?? null,
      syncedAt,
    },
    { merge: true },
  );

  const historyId = ratingHistoryId(ratingEffectiveDate, rating);
  if (historyId && rating !== null) {
    const historyRef = profileRef.collection("ratingHistory").doc(historyId);
    const existing = await historyRef.get();
    await historyRef.set(
      {
        pdgaNumber,
        rating,
        effectiveDate: ratingEffectiveDate,
        ...(existing.exists ? {} : { firstSeenAt: syncedAt }),
        lastSeenAt: syncedAt,
        source: "pdga-api",
      },
      { merge: true },
    );
  }
}

export async function upsertPdgaYearlyStats(pdgaNumber: number, year: number, payload: unknown, syncedAt: string) {
  await db
    .collection("pdgaProfiles")
    .doc(String(pdgaNumber))
    .collection("yearlyStats")
    .doc(String(year))
    .set({ pdgaNumber, year, payload, syncedAt }, { merge: true });
}
