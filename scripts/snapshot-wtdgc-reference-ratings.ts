import { WTDGC_REFERENCE_RATING_DATE } from "../src/domain/wtdgc/competition";
import { db } from "../src/server/firebase/admin";

type HistoryDoc = {
  rating?: number | null;
  effectiveDate?: string | null;
};

async function main() {
  const profiles = await db.collection("pdgaProfiles").get();
  const writer = db.bulkWriter();
  let snapshotted = 0;
  let alreadyCurrent = 0;
  let missingHistory = 0;
  const missingPdgaNumbers: number[] = [];

  for (const profileDoc of profiles.docs) {
    const profile = profileDoc.data() as {
      pdgaNumber?: number;
      wtdgcReferenceRating?: number | null;
      wtdgcReferenceRatingDate?: string | null;
    };
    const pdgaNumber = profile.pdgaNumber ?? Number.parseInt(profileDoc.id, 10);

    if (
      profile.wtdgcReferenceRatingDate === WTDGC_REFERENCE_RATING_DATE &&
      typeof profile.wtdgcReferenceRating === "number"
    ) {
      alreadyCurrent += 1;
      continue;
    }

    const historyDoc = await profileDoc.ref
      .collection("ratingHistory")
      .doc(WTDGC_REFERENCE_RATING_DATE)
      .get();
    const history = historyDoc.data() as HistoryDoc | undefined;

    if (!historyDoc.exists || history?.effectiveDate !== WTDGC_REFERENCE_RATING_DATE || typeof history.rating !== "number") {
      missingHistory += 1;
      if (Number.isFinite(pdgaNumber)) missingPdgaNumbers.push(pdgaNumber);
      continue;
    }

    writer.set(
      profileDoc.ref,
      {
        wtdgcReferenceRating: history.rating,
        wtdgcReferenceRatingDate: WTDGC_REFERENCE_RATING_DATE,
        wtdgcReferenceRatingSource: "pdga-august-2026",
        wtdgcReferenceRatingSnapshottedAt: new Date().toISOString(),
      },
      { merge: true },
    );
    snapshotted += 1;
  }

  await writer.close();

  const completedAt = new Date().toISOString();
  await db.collection("syncLogs").doc(`wtdgc-reference-ratings-${WTDGC_REFERENCE_RATING_DATE}`).set(
    {
      type: "wtdgc-reference-rating-snapshot",
      effectiveDate: WTDGC_REFERENCE_RATING_DATE,
      completedAt,
      totalProfiles: profiles.size,
      snapshotted,
      alreadyCurrent,
      missingHistory,
      missingPdgaNumbers,
      status: missingHistory ? "partial" : "success",
    },
    { merge: true },
  );

  console.log(
    `WTDGC reference snapshot ${WTDGC_REFERENCE_RATING_DATE}: ${snapshotted} written, ` +
      `${alreadyCurrent} already current, ${missingHistory} without a matching history entry.`,
  );

  if (missingPdgaNumbers.length) {
    console.log(`Missing August history for PDGA: ${missingPdgaNumbers.join(", ")}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
