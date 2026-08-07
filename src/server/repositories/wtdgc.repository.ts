import "server-only";
import { db } from "@/server/firebase/admin";

export interface FirestoreTeamRecord {
  id: string;
  eventId: string;
  country: string;
  countryCode: string;
  division: "open" | "masters";
  teamCode: string;
  status: string;
  statusLabel: string;
  declared: { players: number; nptm: number; npts: number };
  submitted: { players: number; nptm: number; npts: number };
  remaining: { players: number; nptm: number; npts: number };
  totalDeclared: number;
  totalSubmitted: number;
  totalRemaining: number;
  sourceUpdatedAt: string;
}

export interface FirestorePersonRecord {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  pdgaNumber: number | null;
  pdgaNumberSource: "wtdgc" | "pdga-api" | "pdga-site" | "unresolved";
  sourceUpdatedAt: string;
}

export interface FirestoreRegistrationRecord {
  id: string;
  eventId: string;
  teamId: string;
  personId: string;
  role: "player" | "nptm" | "npts";
  teamRoleRaw: string;
  specificFunction: string | null;
  jerseyNumber: number | null;
  jerseyNumberRaw: string;
  pdgaNumber: number | null;
  pdgaNumberRaw: string;
  pdgaNumberSource: "wtdgc" | "pdga-api" | "pdga-site" | "unresolved";
  sourceUpdatedAt: string;
}

export async function upsertWtdgcDataset(input: {
  event: Record<string, unknown>;
  teams: FirestoreTeamRecord[];
  people: FirestorePersonRecord[];
  registrations: FirestoreRegistrationRecord[];
  syncLog: Record<string, unknown>;
}) {
  const writer = db.bulkWriter();

  writer.set(db.collection("events").doc(String(input.event.id)), input.event, { merge: true });
  for (const team of input.teams) writer.set(db.collection("teams").doc(team.id), team, { merge: true });
  for (const person of input.people) writer.set(db.collection("players").doc(person.id), person, { merge: true });
  for (const registration of input.registrations) {
    writer.set(db.collection("registrations").doc(registration.id), registration, { merge: true });
  }

  const syncId = String(input.syncLog.id);
  writer.set(db.collection("syncLogs").doc(syncId), input.syncLog, { merge: true });
  await writer.close();
}
