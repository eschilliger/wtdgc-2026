import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseWtdgcCallbackPayload } from "../src/server/wtdgc/parser";
import { normalizeMember } from "../src/server/wtdgc/normalizer";
import { resolveMissingPdgaNumber } from "../src/server/wtdgc/pdga-resolver";

async function main() {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3] ?? "data/wtdgc-2026.normalized.json";

  if (!inputPath) {
    throw new Error("Usage: npm run import:wtdgc -- <callback.txt> [output.json]");
  }

  const payload = await readFile(resolve(inputPath), "utf8");
  const snapshot = parseWtdgcCallbackPayload(payload);

  const members = Object.entries(snapshot.details).flatMap(([teamKey, rawMembers]) =>
    rawMembers.map((member) => normalizeMember(teamKey, member)),
  );

  const resolved = [];
  for (const member of members) {
    resolved.push(await resolveMissingPdgaNumber(member));
  }

  const playerCount = resolved.filter((member) => member.teamRole === "Player").length;
  const unresolvedPlayers = resolved.filter(
    (member) => member.teamRole === "Player" && !member.pdgaNumberNormalized,
  );

  const result = {
    importedAt: new Date().toISOString(),
    teams: snapshot.summary,
    members: resolved,
    quality: {
      teamCount: snapshot.summary.length,
      playerCount,
      unresolvedPlayerCount: unresolvedPlayers.length,
      unresolvedPlayers: unresolvedPlayers.map(({ teamKey, fullName }) => ({ teamKey, fullName })),
    },
  };

  await writeFile(resolve(outputPath), JSON.stringify(result, null, 2), "utf8");
  console.log(`WTDGC import prepared: ${result.quality.teamCount} teams, ${playerCount} players.`);
  console.log(`Unresolved PDGA numbers: ${unresolvedPlayers.length}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
