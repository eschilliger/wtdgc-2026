import { readFile } from "node:fs/promises";
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.GOOGLE_CLOUD_PROJECT || "wtdgc-2026";
const app = getApps()[0] ?? initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore(app);

type TeamRow = [string, string, string, "open" | "masters", string, string, string];
type RegistrationRow = [
  string,
  string,
  "player" | "nptm" | "npts",
  string,
  string,
  number | null,
  number | null,
  string,
  string | null,
  "wtdgc" | "pdga-api" | "pdga-site" | "unresolved",
];

type TeamCounts = { players: number; nptm: number; npts: number };

async function loadSnapshot() {
  const meta = JSON.parse(await readFile("data/full/meta.json", "utf8")) as {
    capturedAt: string;
    teams: TeamRow[];
  };
  const registrations: RegistrationRow[] = [];
  for (let i = 1; i <= 8; i += 1) {
    const name = `data/full/regs-${String(i).padStart(2, "0")}.json`;
    const chunk = JSON.parse(await readFile(name, "utf8")) as { registrations: RegistrationRow[] };
    registrations.push(...chunk.registrations);
  }
  return { ...meta, registrations };
}

async function main() {
  const source = await loadSnapshot();
  const importedAt = new Date().toISOString();

  const playerRows = source.registrations.filter((r) => r[2] === "player");
  const unresolvedPlayers = playerRows.filter((r) => !r[5]);
  const uniquePdga = new Set(playerRows.flatMap((r) => (r[5] ? [r[5]] : [])));

  if (source.teams.length !== 47 || source.registrations.length !== 463 || playerRows.length !== 399) {
    throw new Error(
      `Snapshot validation failed: ${source.teams.length} teams, ${source.registrations.length} registrations, ${playerRows.length} players.`,
    );
  }
  if (unresolvedPlayers.length) {
    throw new Error(`Refusing import: ${unresolvedPlayers.length} player(s) have no PDGA number.`);
  }

  const people = new Map<string, Record<string, unknown>>();
  const teamCounts = new Map<string, TeamCounts>();
  for (const row of source.registrations) {
    const [teamId, personId, role, firstName, lastName, pdgaNumber, jerseyNumber, jerseyNumberRaw, specificFunction, pdgaNumberSource] = row;
    people.set(personId, {
      id: personId,
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`.trim(),
      pdgaNumber,
      pdgaNumberSource,
      sourceUpdatedAt: source.capturedAt,
    });
    const counts = teamCounts.get(teamId) ?? { players: 0, nptm: 0, npts: 0 };
    const countKey: keyof TeamCounts = role === "player" ? "players" : role;
    counts[countKey] += 1;
    teamCounts.set(teamId, counts);
    void jerseyNumber;
    void jerseyNumberRaw;
    void specificFunction;
  }

  const writer = db.bulkWriter();
  writer.set(
    db.collection("events").doc("wtdgc-2026"),
    {
      id: "wtdgc-2026",
      name: "WTDGC 2026",
      year: 2026,
      hostCity: "Vilnius",
      hostCountry: "Lithuania",
      source: "wtdgc-dashboard-snapshot",
      sourceCapturedAt: source.capturedAt,
      updatedAt: importedAt,
    },
    { merge: true },
  );

  for (const [id, country, countryCode, division, teamCode, status, statusLabel] of source.teams) {
    writer.set(
      db.collection("teams").doc(id),
      {
        id,
        eventId: "wtdgc-2026",
        country,
        countryCode,
        division,
        teamCode,
        status,
        statusLabel,
        submitted: teamCounts.get(id) ?? { players: 0, nptm: 0, npts: 0 },
        sourceUpdatedAt: source.capturedAt,
      },
      { merge: true },
    );
  }

  for (const [personId, person] of people) {
    writer.set(db.collection("players").doc(personId), person, { merge: true });
  }

  for (const row of source.registrations) {
    const [teamId, personId, role, firstName, lastName, pdgaNumber, jerseyNumber, jerseyNumberRaw, specificFunction, pdgaNumberSource] = row;
    const id = `${teamId}-${personId}`;
    writer.set(
      db.collection("registrations").doc(id),
      {
        id,
        eventId: "wtdgc-2026",
        teamId,
        personId,
        role,
        firstName,
        lastName,
        pdgaNumber,
        jerseyNumber,
        jerseyNumberRaw,
        specificFunction,
        pdgaNumberSource,
        sourceUpdatedAt: source.capturedAt,
      },
      { merge: true },
    );
  }

  const syncId = `wtdgc-full-${importedAt.replace(/[^0-9]/g, "").slice(0, 14)}`;
  writer.set(
    db.collection("syncLogs").doc(syncId),
    {
      id: syncId,
      source: "wtdgc-dashboard-snapshot",
      sourceCapturedAt: source.capturedAt,
      importedAt,
      teamCount: source.teams.length,
      personCount: people.size,
      registrationCount: source.registrations.length,
      playerCount: playerRows.length,
      uniquePdgaCount: uniquePdga.size,
      status: "success",
    },
    { merge: true },
  );

  await writer.close();

  const teamsSnapshot = await db.collection("teams").where("eventId", "==", "wtdgc-2026").get();
  if (teamsSnapshot.size < 47) {
    throw new Error(`Post-import verification failed: expected at least 47 teams, found ${teamsSnapshot.size}.`);
  }

  console.log(
    `Full WTDGC import OK: ${source.teams.length} teams, ${people.size} people, ${source.registrations.length} registrations, ${uniquePdga.size} unique PDGA players.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
