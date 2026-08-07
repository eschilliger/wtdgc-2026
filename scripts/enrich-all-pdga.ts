import { readFile } from "node:fs/promises";
import { getPdgaPlayer, getPdgaPlayerStatistics } from "../src/server/pdga/client";
import { upsertPdgaProfile, upsertPdgaYearlyStats } from "../src/server/repositories/pdga.repository";

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

function argNumber(name: string, fallback: number) {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) return fallback;
  const value = Number.parseInt(process.argv[index + 1], 10);
  return Number.isFinite(value) ? value : fallback;
}

async function loadPdgaNumbers() {
  const registrations: RegistrationRow[] = [];
  for (let i = 1; i <= 8; i += 1) {
    const name = `data/full/regs-${String(i).padStart(2, "0")}.json`;
    const chunk = JSON.parse(await readFile(name, "utf8")) as { registrations: RegistrationRow[] };
    registrations.push(...chunk.registrations);
  }
  return [...new Set(registrations.filter((r) => r[2] === "player" && r[5]).map((r) => r[5] as number))].sort(
    (a, b) => a - b,
  );
}

async function main() {
  const all = await loadPdgaNumbers();
  const offset = Math.max(0, argNumber("--offset", 0));
  const limit = Math.max(1, Math.min(100, argNumber("--limit", 50)));
  const selected = all.slice(offset, offset + limit);
  const syncedAt = new Date().toISOString();
  const failures: Array<{ pdgaNumber: number; message: string }> = [];
  let enriched = 0;

  if (!selected.length) {
    throw new Error(`No PDGA numbers selected. Total=${all.length}, offset=${offset}, limit=${limit}.`);
  }

  for (const pdgaNumber of selected) {
    try {
      const profile = await getPdgaPlayer(pdgaNumber);
      if (!profile) throw new Error("Profile not found");
      await upsertPdgaProfile(profile, syncedAt);
      const stats = await getPdgaPlayerStatistics(2026, pdgaNumber);
      await upsertPdgaYearlyStats(pdgaNumber, 2026, stats, syncedAt);
      enriched += 1;
      console.log(`Enriched #${pdgaNumber}: ${profile.first_name} ${profile.last_name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ pdgaNumber, message });
      console.error(`Failed #${pdgaNumber}: ${message}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  console.log(
    `PDGA batch complete: ${enriched}/${selected.length} enriched. Offset=${offset}, limit=${limit}, total unique players=${all.length}.`,
  );
  if (failures.length) {
    console.error("Failures:", failures);
    throw new Error(`${failures.length} PDGA profile(s) failed in this batch.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
