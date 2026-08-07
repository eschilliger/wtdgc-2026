import { readFile } from "node:fs/promises";
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.GOOGLE_CLOUD_PROJECT || "wtdgc-2026";
const app = getApps()[0] ?? initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore(app);

type Snapshot = {
  event: Record<string, unknown> & { id: string };
  source: Record<string, unknown>;
  teams: Array<Record<string, unknown> & { id: string }>;
  people: Array<Record<string, unknown> & { id: string }>;
  registrations: Array<Record<string, unknown> & { id: string }>;
};

async function main() {
  const raw = await readFile("data/france-2026.snapshot.json", "utf8");
  const snapshot = JSON.parse(raw) as Snapshot;
  const importedAt = new Date().toISOString();

  const writer = db.bulkWriter();

  writer.set(
    db.collection("events").doc(snapshot.event.id),
    { ...snapshot.event, source: snapshot.source, updatedAt: importedAt },
    { merge: true },
  );

  for (const team of snapshot.teams) {
    writer.set(
      db.collection("teams").doc(team.id),
      { ...team, eventId: snapshot.event.id, sourceUpdatedAt: importedAt },
      { merge: true },
    );
  }

  for (const person of snapshot.people) {
    writer.set(
      db.collection("players").doc(person.id),
      { ...person, sourceUpdatedAt: importedAt },
      { merge: true },
    );
  }

  for (const registration of snapshot.registrations) {
    writer.set(
      db.collection("registrations").doc(registration.id),
      { ...registration, eventId: snapshot.event.id, sourceUpdatedAt: importedAt },
      { merge: true },
    );
  }

  const syncId = `france-test-${importedAt.replace(/[^0-9]/g, "").slice(0, 14)}`;
  writer.set(
    db.collection("syncLogs").doc(syncId),
    {
      id: syncId,
      source: "france-test-snapshot",
      importedAt,
      teamCount: snapshot.teams.length,
      personCount: snapshot.people.length,
      registrationCount: snapshot.registrations.length,
      status: "success",
    },
    { merge: true },
  );

  await writer.close();

  const [open, masters] = await Promise.all([
    db.collection("teams").doc("fr-open").get(),
    db.collection("teams").doc("fr-masters").get(),
  ]);

  if (!open.exists || !masters.exists) {
    throw new Error("France team verification failed after Firestore import.");
  }

  console.log(
    `France import OK: ${snapshot.teams.length} teams, ${snapshot.people.length} people, ${snapshot.registrations.length} registrations.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
