import { db } from "../src/server/firebase/admin";

async function main() {
  const ref = db.collection("_healthchecks").doc("github-actions");
  const now = new Date().toISOString();

  await ref.set({
    source: "github-actions",
    checkedAt: now,
  });

  const snapshot = await ref.get();
  if (!snapshot.exists) {
    throw new Error("Firestore write succeeded but the healthcheck document could not be read back.");
  }

  const data = snapshot.data();
  if (data?.checkedAt !== now) {
    throw new Error("Firestore healthcheck document content did not match the written value.");
  }

  await ref.delete();
  console.log("Firebase Admin / Firestore connection OK.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
