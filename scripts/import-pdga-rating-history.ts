import { db } from "../src/server/firebase/admin";
import { fetchPdgaRatingHistory } from "../src/server/pdga/history";

function readPdgaNumber() {
  const index = process.argv.indexOf("--pdga");
  const raw = index >= 0 ? process.argv[index + 1] : undefined;
  const value = Number.parseInt(raw ?? "105676", 10);
  if (!Number.isFinite(value) || value <= 0) throw new Error("Invalid --pdga value.");
  return value;
}

async function main() {
  const pdgaNumber = readPdgaNumber();
  const syncedAt = new Date().toISOString();
  const { url, entries } = await fetchPdgaRatingHistory(pdgaNumber);
  const profileRef = db.collection("pdgaProfiles").doc(String(pdgaNumber));
  const profile = await profileRef.get();

  if (!profile.exists) {
    throw new Error(`pdgaProfiles/${pdgaNumber} does not exist. Enrich the player first.`);
  }

  const writer = db.bulkWriter();
  let created = 0;
  let enriched = 0;

  for (const entry of entries) {
    const ref = profileRef.collection("ratingHistory").doc(entry.effectiveDate);
    const existing = await ref.get();

    writer.set(
      ref,
      {
        pdgaNumber,
        rating: entry.rating,
        effectiveDate: entry.effectiveDate,
        roundsUsed: entry.roundsUsed,
        historyPageSyncedAt: syncedAt,
        historyPageUrl: url,
        sourceHistoryPage: true,
        ...(existing.exists
          ? {}
          : {
              source: "pdga-history-page",
              firstSeenAt: syncedAt,
              lastSeenAt: syncedAt,
            }),
      },
      { merge: true },
    );

    if (existing.exists) enriched += 1;
    else created += 1;
  }

  await writer.close();

  await profileRef.set(
    {
      ratingHistoryBackfill: {
        source: "pdga-history-page",
        syncedAt,
        entryCount: entries.length,
        url,
      },
    },
    { merge: true },
  );

  console.log(
    `PDGA #${pdgaNumber} rating history imported: ${entries.length} entries (${created} created, ${enriched} enriched).`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
