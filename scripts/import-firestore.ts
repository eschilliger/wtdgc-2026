import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { upsertWtdgcDataset } from "../src/server/repositories/wtdgc.repository";
import { upsertPdgaProfile, upsertPdgaYearlyStats } from "../src/server/repositories/pdga.repository";
import { getPdgaPlayer, getPdgaPlayerStatistics } from "../src/server/pdga/client";
import { WTDGC_COUNTRY_ISO2, teamId } from "../src/server/wtdgc/countries";
import type { NormalizedWtdgcMember, WtdgcSummaryEntry } from "../src/server/wtdgc/types";

type PreparedImport = {
  importedAt: string;
  teams: WtdgcSummaryEntry[];
  members: NormalizedWtdgcMember[];
};

function personId(member: NormalizedWtdgcMember) {
  if (member.pdgaNumberNormalized) return `pdga-${member.pdgaNumberNormalized}`;
  const digest = createHash("sha1")
    .update(`${member.teamKey}|${member.fullName}|${member.teamRole}`)
    .digest("hex")
    .slice(0, 12);
  return `person-${digest}`;
}

function role(member: NormalizedWtdgcMember): "player" | "nptm" | "npts" {
  if (member.teamRole === "Player") return "player";
  if (member.teamRole.includes("NPTM")) return "nptm";
  return "npts";
}

async function main() {
  const inputPath = process.argv[2] ?? "data/wtdgc-2026.normalized.json";
  const enrichPdga = process.argv.includes("--enrich-pdga");
  const source = JSON.parse(await readFile(resolve(inputPath), "utf8")) as PreparedImport;
  const sourceUpdatedAt = source.importedAt || new Date().toISOString();
  const summaries = new Map(source.teams.map((team) => [`${team.country}|${team.division}`, team]));

  const teams = source.teams.map((team) => ({
    id: teamId(team.country, team.division),
    eventId: "wtdgc-2026",
    country: team.country,
    countryCode: WTDGC_COUNTRY_ISO2[team.country],
    division: team.division.toLowerCase() as "open" | "masters",
    teamCode: team.code,
    status: team.status,
    statusLabel: team.statusLabel,
    declared: team.declared,
    submitted: team.submitted,
    remaining: team.remaining,
    totalDeclared: team.totalDeclared,
    totalSubmitted: team.totalSubmitted,
    totalRemaining: team.totalRemaining,
    sourceUpdatedAt,
  }));

  const peopleMap = new Map<string, any>();
  const registrations = source.members.map((member) => {
    const [country, division] = member.teamKey.split("|");
    const id = personId(member);
    peopleMap.set(id, {
      id,
      firstName: member.givenName.trim(),
      lastName: member.familyName.trim(),
      fullName: member.fullName.trim(),
      pdgaNumber: member.pdgaNumberNormalized,
      pdgaNumberSource: member.pdgaResolutionSource,
      sourceUpdatedAt,
    });
    const tId = teamId(country, division);
    return {
      id: `${tId}-${id}`,
      eventId: "wtdgc-2026",
      teamId: tId,
      personId: id,
      role: role(member),
      teamRoleRaw: member.teamRole,
      specificFunction: member.specificFunction || null,
      jerseyNumber: member.jerseyNumberNormalized,
      jerseyNumberRaw: member.jerseyNumberRaw,
      pdgaNumber: member.pdgaNumberNormalized,
      pdgaNumberRaw: member.pdgaNumberRaw,
      pdgaNumberSource: member.pdgaResolutionSource,
      sourceUpdatedAt,
    };
  });

  const unresolvedPlayers = source.members.filter(
    (member) => member.teamRole === "Player" && !member.pdgaNumberNormalized,
  );
  if (unresolvedPlayers.length) {
    throw new Error(`Refusing Firestore import: ${unresolvedPlayers.length} player(s) still have no PDGA number.`);
  }

  const syncId = `wtdgc-${sourceUpdatedAt.replace(/[^0-9]/g, "").slice(0, 14)}`;
  await upsertWtdgcDataset({
    event: { id: "wtdgc-2026", name: "WTDGC 2026", year: 2026, hostCity: "Vilnius", hostCountry: "Lithuania" },
    teams,
    people: [...peopleMap.values()],
    registrations,
    syncLog: {
      id: syncId,
      source: "wtdgc-dashboard",
      sourceUpdatedAt,
      teamCount: teams.length,
      personCount: peopleMap.size,
      registrationCount: registrations.length,
      status: "success",
    },
  });

  if (enrichPdga) {
    const pdgaNumbers = [...new Set(source.members.flatMap((member) => member.pdgaNumberNormalized ?? []))];
    for (const pdgaNumber of pdgaNumbers) {
      const profile = await getPdgaPlayer(pdgaNumber);
      if (profile) await upsertPdgaProfile(profile, sourceUpdatedAt);
      const stats = await getPdgaPlayerStatistics(2026, pdgaNumber);
      await upsertPdgaYearlyStats(pdgaNumber, 2026, stats, sourceUpdatedAt);
    }
  }

  console.log(`Firestore import complete: ${teams.length} teams, ${peopleMap.size} people, ${registrations.length} registrations.`);
  console.log(`PDGA enrichment: ${enrichPdga ? "enabled" : "disabled"}.`);
  void summaries;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
