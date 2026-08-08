import { db } from "../src/server/firebase/admin";
import { resolvePdgaGender } from "../src/server/pdga/gender";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const registrationsSnapshot = await db.collection("registrations").where("role", "==", "player").get();
  const playerIds = [...new Set(registrationsSnapshot.docs.map((doc) => String(doc.data().personId ?? "")).filter(Boolean))];
  const players = await Promise.all(playerIds.map((id) => db.collection("players").doc(id).get()));

  const pdgaNumbers = [...new Set(players
    .map((snapshot) => Number(snapshot.data()?.pdgaNumber))
    .filter((value) => Number.isFinite(value) && value > 0))]
    .sort((a, b) => a - b);

  let repaired = 0;
  let alreadyKnown = 0;
  let defaulted = 0;

  for (const [index, pdgaNumber] of pdgaNumbers.entries()) {
    const profileRef = db.collection("pdgaProfiles").doc(String(pdgaNumber));
    const profile = await profileRef.get();
    const existing = profile.data()?.gender;
    const existingSource = profile.data()?.genderSource;

    if ((existing === "M" || existing === "F") && existingSource !== "default-m") {
      alreadyKnown += 1;
      continue;
    }

    const resolved = await resolvePdgaGender(pdgaNumber);
    await profileRef.set({
      pdgaNumber,
      gender: resolved.gender,
      genderSource: resolved.source,
      genderResolvedAt: new Date().toISOString(),
    }, { merge: true });

    repaired += 1;
    if (resolved.source === "default-m") defaulted += 1;
    console.log(`[${index + 1}/${pdgaNumbers.length}] #${pdgaNumber}: ${resolved.gender} (${resolved.source})`);
    await sleep(750);
  }

  console.log(`Gender repair complete: ${repaired} repaired, ${alreadyKnown} already known, ${defaulted} defaulted to M.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
