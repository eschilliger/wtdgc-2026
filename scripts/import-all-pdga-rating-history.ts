import { readFile } from "node:fs/promises";
import { db } from "../src/server/firebase/admin";
import { fetchPdgaRatingHistory } from "../src/server/pdga/history";

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

function hasFlag(name: string) {
  return process.argv.includes(name);
}

async function loadPdgaNumbers() {
  const registrations: RegistrationRow[] = [];
  for (let i = 1; i <= 8; i += 1) {
    const name = `data/full/regs-${String(i).padStart(2, "0")}.json`;
    const chunk = JSON.parse(await readFile(name, "utf8")) as { registrations: RegistrationRow[] };
    registrations.push(...chunk.registrations);
  }

  return [...new Set(
    registrations
      .filter((row) => row[2] === "player" && row[5])
      .map((row) => row[5] as number),
  )].sort((a, b) => a - b);
}

async function importPlayer(pdgaNumber: number, force: boolean) {
  const profileRef = db.collection("pdgaProfiles").doc(String(pdgaNumber));
  const profile = await profileRef.get();
  if (!profile.exists) {
    return { status: "failed" as const, pdgaNumber, message: "PDGA profile missing in Firestore" };
  }

  const profileData = profile.data() as {
    ratingHistoryBackfill?: { source?: string; entryCount?: number };
  } | undefined;
  const priorBackfill = profileData?.ratingHistoryBackfill;

  if (!force && priorBackfill?.source === "pdga-history-page" && (priorBackfill.entryCount ?? 0) > 1) {
    return { status: "skipped" as const, pdgaNumber, entryCount: priorBackfill.entryCount ?? 0 };
  }

  const syncedAt = new Date().toISOString();
  const { url, entries } = await fetchPdgaRatingHistory(pdgaNumber);
  const writer = db.bulkWriter();

  for (const entry of entries) {
    const ref = profileRef.collection("ratingHistory").doc(entry.effectiveDate);
    writer.set(
      ref,
      {
        pdgaNumber,
        rating: entry.rating,
        effectiveDate: entry.effectiveDate,
        roundsUsed: entry.roundsUsed,
        historyPageSyncedAt: syncedAt,
        historyPageUrl: url,
        sourceHistoryPage: true,
        source: "pdga-history-page",
        lastSeenAt: syncedAt,
      },
      { merge: true },
    );
  }

  await writer.close();
  await profileRef.set(
    {
      ratingHistoryBackfill: {
        source: "pdga-history-page",
        syncedAt,
        entryCount: entries.length,
        url,
      },
    },
    { merge: true },
  );

  return { status: "success" as const, pdgaNumber, entryCount: entries.length };
}

async function main() {
  const all = await loadPdgaNumbers();
  const offset = Math.max(0, argNumber("--offset", 0));
  const limit = Math.max(1, Math.min(50, argNumber("--limit", 25)));
  const delayMs = Math.max(500, argNumber("--delay-ms", 1500));
  const force = hasFlag("--force");
  const selected = all.slice(offset, offset + limit);
  const startedAt = new Date().toISOString();

  if (!selected.length) {
    throw new Error(`No PDGA numbers selected. Total=${all.length}, offset=${offset}, limit=${limit}.`);
  }

  let successCount = 0;
  let skippedCount = 0;
  const failures: Array<{ pdgaNumber: number; message: string }> = [];

  for (const [index, pdgaNumber] of selected.entries()) {
    try {
      const result = await importPlayer(pdgaNumber, force);
      if (result.status === "success") {
        successCount += 1;
        console.log(`[${index + 1}/${selected.length}] #${pdgaNumber}: ${result.entryCount} history entries imported.`);
      } else if (result.status === "skipped") {
        skippedCount += 1;
        console.log(`[${index + 1}/${selected.length}] #${pdgaNumber}: skipped (${result.entryCount} entries already backfilled).`);
      } else {
        failures.push({ pdgaNumber, message: result.message });
        console.error(`[${index + 1}/${selected.length}] #${pdgaNumber}: ${result.message}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ pdgaNumber, message });
      console.error(`[${index + 1}/${selected.length}] #${pdgaNumber}: ${message}`);
    }

    if (index < selected.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  const completedAt = new Date().toISOString();
  const syncId = `pdga-rating-history-${completedAt.replace(/[^0-9]/g, "").slice(0, 14)}-${offset}`;
  await db.collection("syncLogs").doc(syncId).set({
    id: syncId,
    source: "pdga-history-page",
    type: "rating-history-batch",
    startedAt,
    completedAt,
    offset,
    limit,
    selectedCount: selected.length,
    totalPlayerCount: all.length,
    successCount,
    skippedCount,
    failureCount: failures.length,
    failures,
    delayMs,
    force,
    status: failures.length ? "partial" : "success",
  });

  console.log(
    `Batch complete: ${successCount} imported, ${skippedCount} skipped, ${failures.length} failed. Offset=${offset}, limit=${limit}, total=${all.length}.`,
  );

  if (failures.length) {
    console.error("Failures:", failures);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
