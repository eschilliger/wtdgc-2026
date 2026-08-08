import { db } from "../src/server/firebase/admin";
import { getPdgaPlayerStatistics } from "../src/server/pdga/client";
import { upsertPdgaYearlyStats } from "../src/server/repositories/pdga.repository";

function arg(name: string, fallback: number) {
  const index = process.argv.indexOf(`--${name}`);
  const raw = index >= 0 ? process.argv[index + 1] : undefined;
  const value = Number.parseInt(raw ?? String(fallback), 10);
  return Number.isFinite(value) ? value : fallback;
}

function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function main() {
  const year = arg("year", 2025);
  const offset = Math.max(0, arg("offset", 0));
  const limit = Math.max(1, Math.min(100, arg("limit", 25)));
  const delayMs = Math.max(250, arg("delay-ms", 1200));
  const startedAt = new Date().toISOString();
  const profiles = await db.collection("pdgaProfiles").orderBy("pdgaNumber", "asc").get();
  const selected = profiles.docs.slice(offset, offset + limit);
  let succeeded = 0;
  const failures: Array<{ pdgaNumber: number; message: string }> = [];

  for (const [index, doc] of selected.entries()) {
    const pdgaNumber = Number.parseInt(doc.id, 10);
    if (!Number.isFinite(pdgaNumber)) continue;
    try {
      const payload = await getPdgaPlayerStatistics(year, pdgaNumber);
      await upsertPdgaYearlyStats(pdgaNumber, year, payload, new Date().toISOString());
      succeeded += 1;
      console.log(`[${index + 1}/${selected.length}] #${pdgaNumber}: ${year} stats imported.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ pdgaNumber, message });
      console.error(`[${index + 1}/${selected.length}] #${pdgaNumber}: ${message}`);
    }
    if (index < selected.length - 1) await sleep(delayMs);
  }

  await db.collection("syncLogs").add({
    type: "pdga-yearly-stats-batch", year, offset, limit, delayMs,
    selected: selected.length, succeeded, failed: failures.length, failures,
    startedAt, completedAt: new Date().toISOString(),
  });
  console.log(`Batch complete: ${succeeded} imported, ${failures.length} failed. year=${year}, offset=${offset}, limit=${limit}, total=${profiles.size}.`);
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
