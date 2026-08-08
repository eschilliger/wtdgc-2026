import type { DocumentReference } from "firebase-admin/firestore";
import { db } from "../src/server/firebase/admin";

type RatingDoc = {
  rating?: number;
  effectiveDate?: string;
};

function subtractMonths(dateString: string, months: number) {
  const date = new Date(`${dateString}T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() - months);
  return date.toISOString().slice(0, 10);
}

async function ratingAtOrBefore(profileRef: DocumentReference, date: string) {
  const snapshot = await profileRef
    .collection("ratingHistory")
    .where("effectiveDate", "<=", date)
    .orderBy("effectiveDate", "desc")
    .limit(1)
    .get();
  const data = snapshot.docs[0]?.data() as RatingDoc | undefined;
  return Number.isFinite(data?.rating) ? data!.rating! : null;
}

async function main() {
  const profiles = await db.collection("pdgaProfiles").get();
  const computedAt = new Date().toISOString();
  let updated = 0;
  let skipped = 0;

  for (const [index, profileDoc] of profiles.docs.entries()) {
    const profileRef = profileDoc.ref;
    const latestSnapshot = await profileRef.collection("ratingHistory").orderBy("effectiveDate", "desc").limit(1).get();
    const latest = latestSnapshot.docs[0]?.data() as RatingDoc | undefined;
    if (!latest?.effectiveDate || !Number.isFinite(latest.rating)) {
      skipped += 1;
      continue;
    }

    const rating3MonthsAgo = await ratingAtOrBefore(profileRef, subtractMonths(latest.effectiveDate, 3));
    const rating6MonthsAgo = await ratingAtOrBefore(profileRef, subtractMonths(latest.effectiveDate, 6));
    const rating12MonthsAgo = await ratingAtOrBefore(profileRef, subtractMonths(latest.effectiveDate, 12));

    await profileRef.set({
      scoutingMetrics: {
        computedAt,
        latestRatingDate: latest.effectiveDate,
        latestRating: latest.rating,
        rating3MonthsAgo,
        rating6MonthsAgo,
        rating12MonthsAgo,
        trend3Months: rating3MonthsAgo === null ? null : latest.rating - rating3MonthsAgo,
        trend6Months: rating6MonthsAgo === null ? null : latest.rating - rating6MonthsAgo,
        trend12Months: rating12MonthsAgo === null ? null : latest.rating - rating12MonthsAgo,
      },
    }, { merge: true });

    updated += 1;
    console.log(`[${index + 1}/${profiles.size}] ${profileDoc.id}: 12m=${rating12MonthsAgo === null ? "n/a" : latest.rating - rating12MonthsAgo}`);
  }

  await db.collection("syncLogs").add({
    type: "pdga-scouting-metrics",
    startedAt: computedAt,
    completedAt: new Date().toISOString(),
    totalProfiles: profiles.size,
    updated,
    skipped,
  });

  console.log(`Scouting metrics complete: ${updated} updated, ${skipped} skipped.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
