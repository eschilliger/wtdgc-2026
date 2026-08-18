import { WTDGC_REFERENCE_RATING_DATE } from "../src/domain/wtdgc/competition";
import { db } from "../src/server/firebase/admin";

type HistoryDoc = {
  rating?: number | null;
  effectiveDate?: string | null;
};

type ReferenceCandidate = {
  rating: number;
  observedDate: string;
  exact: boolean;
};

function normalizeDate(value?: string | null) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const match = value.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (!match) return null;

  const months: Record<string, string> = {
    Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
    Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
  };
  const month = months[match[2]];
  return month ? `${match[3]}-${month}-${match[1].padStart(2, "0")}` : null;
}

async function findReferenceCandidate(profileDoc: FirebaseFirestore.QueryDocumentSnapshot): Promise<ReferenceCandidate | null> {
  const exactDoc = await profileDoc.ref
    .collection("ratingHistory")
    .doc(WTDGC_REFERENCE_RATING_DATE)
    .get();
  const exactData = exactDoc.data() as HistoryDoc | undefined;
  const exactDate = normalizeDate(exactData?.effectiveDate) ?? normalizeDate(exactDoc.id);

  if (exactDoc.exists && exactDate === WTDGC_REFERENCE_RATING_DATE && typeof exactData?.rating === "number") {
    return {
      rating: exactData.rating,
      observedDate: WTDGC_REFERENCE_RATING_DATE,
      exact: true,
    };
  }

  // Some players do not receive an entry on every monthly release. In that case,
  // WTDGC uses the last PDGA rating observed on or before the reference date.
  // Reading the subcollection also tolerates older documents whose IDs/date fields
  // were stored in a non-ISO PDGA format.
  const historySnapshot = await profileDoc.ref.collection("ratingHistory").get();
  let best: ReferenceCandidate | null = null;

  for (const historyDoc of historySnapshot.docs) {
    const history = historyDoc.data() as HistoryDoc;
    if (typeof history.rating !== "number") continue;

    const observedDate = normalizeDate(history.effectiveDate) ?? normalizeDate(historyDoc.id);
    if (!observedDate || observedDate > WTDGC_REFERENCE_RATING_DATE) continue;

    if (!best || observedDate > best.observedDate) {
      best = {
        rating: history.rating,
        observedDate,
        exact: observedDate === WTDGC_REFERENCE_RATING_DATE,
      };
    }
  }

  return best;
}

async function main() {
  const profiles = await db.collection("pdgaProfiles").get();
  const writer = db.bulkWriter();
  let snapshotted = 0;
  let alreadyCurrent = 0;
  let exactReferenceCount = 0;
  let fallbackReferenceCount = 0;
  let missingHistory = 0;
  const missingPdgaNumbers: number[] = [];
  const fallbackPdgaNumbers: Array<{ pdgaNumber: number; observedDate: string; rating: number }> = [];

  for (const profileDoc of profiles.docs) {
    const profile = profileDoc.data() as {
      pdgaNumber?: number;
      wtdgcReferenceRating?: number | null;
      wtdgcReferenceRatingDate?: string | null;
      wtdgcReferenceRatingObservedDate?: string | null;
    };
    const pdgaNumber = profile.pdgaNumber ?? Number.parseInt(profileDoc.id, 10);

    if (
      profile.wtdgcReferenceRatingDate === WTDGC_REFERENCE_RATING_DATE &&
      typeof profile.wtdgcReferenceRating === "number" &&
      typeof profile.wtdgcReferenceRatingObservedDate === "string"
    ) {
      alreadyCurrent += 1;
      continue;
    }

    const candidate = await findReferenceCandidate(profileDoc);

    if (!candidate) {
      missingHistory += 1;
      if (Number.isFinite(pdgaNumber)) missingPdgaNumbers.push(pdgaNumber);
      continue;
    }

    const source = candidate.exact
      ? "pdga-august-2026"
      : "pdga-history-before-reference-date";

    writer.set(
      profileDoc.ref,
      {
        wtdgcReferenceRating: candidate.rating,
        // This is the fixed WTDGC reference date, not necessarily the date on which
        // this player's latest usable PDGA rating was observed.
        wtdgcReferenceRatingDate: WTDGC_REFERENCE_RATING_DATE,
        wtdgcReferenceRatingObservedDate: candidate.observedDate,
        wtdgcReferenceRatingSource: source,
        wtdgcReferenceRatingSnapshottedAt: new Date().toISOString(),
      },
      { merge: true },
    );

    if (candidate.exact) {
      exactReferenceCount += 1;
    } else {
      fallbackReferenceCount += 1;
      if (Number.isFinite(pdgaNumber)) {
        fallbackPdgaNumbers.push({ pdgaNumber, observedDate: candidate.observedDate, rating: candidate.rating });
      }
    }
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
      exactReferenceCount,
      fallbackReferenceCount,
      fallbackPdgaNumbers,
      missingHistory,
      missingPdgaNumbers,
      status: missingHistory ? "partial" : "success",
    },
    { merge: true },
  );

  console.log(
    `WTDGC reference snapshot ${WTDGC_REFERENCE_RATING_DATE}: ${snapshotted} written, ` +
      `${alreadyCurrent} already current, ${exactReferenceCount} exact, ${fallbackReferenceCount} fallback, ` +
      `${missingHistory} without any usable history on/before the reference date.`,
  );

  if (fallbackPdgaNumbers.length) {
    console.log(
      `Fallback ratings: ${fallbackPdgaNumbers
        .map((entry) => `#${entry.pdgaNumber}:${entry.rating}@${entry.observedDate}`)
        .join(", ")}`,
    );
  }

  if (missingPdgaNumbers.length) {
    console.log(`Missing usable history on/before ${WTDGC_REFERENCE_RATING_DATE} for PDGA: ${missingPdgaNumbers.join(", ")}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
