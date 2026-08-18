import { db } from "../src/server/firebase/admin";

const EVENT_ID = "wtdgc-2026";

async function main() {
  const rounds = await db.collection("events").doc(EVENT_ID).collection("competitionRounds").get();
  const writer = db.bulkWriter();
  let initialized = 0;
  let alreadySet = 0;

  for (const roundDoc of rounds.docs) {
    const data = roundDoc.data() as { publicationStatus?: string };
    if (data.publicationStatus === "draft" || data.publicationStatus === "ready" || data.publicationStatus === "published") {
      alreadySet += 1;
      continue;
    }

    writer.set(roundDoc.ref, {
      publicationStatus: "draft",
      publishedAt: null,
      publishedBy: null,
      publicationUpdatedAt: new Date().toISOString(),
    }, { merge: true });
    initialized += 1;
  }

  await writer.close();
  console.log(`Round publication status: ${initialized} initialized as draft, ${alreadySet} already set.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
