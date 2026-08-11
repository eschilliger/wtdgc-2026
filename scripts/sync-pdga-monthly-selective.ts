import { readFile } from "node:fs/promises";
import { db } from "../src/server/firebase/admin";
import { getPdgaPlayer } from "../src/server/pdga/client";
import { upsertPdgaProfile } from "../src/server/repositories/pdga.repository";

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
  string,
];

type Failure = { pdgaNumber: number; message: string };

function arg(name: string, fallback?: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function normalizeDate(value?: string | null) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = value.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (!match) return null;
  const months: Record<string, string> = {
    Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
    Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
  };
  const month = months[match[2]];
  return month ? `${match[3]}-${month}-${match[1].padStart(2, "0")}` : null;
}

function parseRating(value?: string) {
  if (!value) return null;
  const rating = Number.parseInt(value, 10);
  return Number.isFinite(rating) ? rating : null;
}

async function loadPdgaNumbers() {
  const registrations: RegistrationRow[] = [];
  for (let i = 1; i <= 8; i += 1) {
    const file = `data/full/regs-${String(i).padStart(2, "0")}.json`;
    const data = JSON.parse(await readFile(file, "utf8")) as { registrations: RegistrationRow[] };
    registrations.push(...data.registrations);
  }

  return [...new Set(
    registrations
      .filter((row) => row[2] === "player" && row[5])
      .map((row) => row[5] as number),
  )].sort((a, b) => a - b);
}

async function main() {
  const effectiveDate = arg("--effective-date");
  if (!effectiveDate || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) {
    throw new Error("Missing or invalid --effective-date (expected YYYY-MM-DD).");
  }

  const pdgaNumbers = await loadPdgaNumbers();
  const startedAt = new Date().toISOString();
  const syncId = `pdga-monthly-${effectiveDate}`;

  let checked = 0;
  let alreadyUpToDate = 0;
  let updatedProfiles = 0;
  let createdHistoryEntries = 0;
  let repairedHistoryEntries = 0;
  let notInCurrentRelease = 0;
  let unrated = 0;
  const failures: Failure[] = [];

  for (const [index, pdgaNumber] of pdgaNumbers.entries()) {
    try {
      const player = await getPdgaPlayer(pdgaNumber);
      checked += 1;

      if (!player) {
        failures.push({ pdgaNumber, message: "PDGA profile not found" });
        console.error(`[${index + 1}/${pdgaNumbers.length}] #${pdgaNumber}: profile not found.`);
        continue;
      }

      const rating = parseRating(player.rating);
      const apiEffectiveDate = normalizeDate(player.rating_effective_date);

      if (rating === null || apiEffectiveDate === null) {
        unrated += 1;
        console.log(`[${index + 1}/${pdgaNumbers.length}] #${pdgaNumber}: no current rating/date; skipped.`);
        continue;
      }

      if (apiEffectiveDate !== effectiveDate) {
        notInCurrentRelease += 1;
        console.log(
          `[${index + 1}/${pdgaNumbers.length}] #${pdgaNumber}: PDGA date ${apiEffectiveDate}, expected ${effectiveDate}; no mutation.`,
        );
        continue;
      }

      const profileRef = db.collection("pdgaProfiles").doc(String(pdgaNumber));
      const [profileSnapshot, historySnapshot] = await Promise.all([
        profileRef.get(),
        profileRef.collection("ratingHistory").doc(effectiveDate).get(),
      ]);

      const profileData = profileSnapshot.data() as {
        currentRating?: number | null;
        ratingEffectiveDate?: string | null;
      } | undefined;
      const historyData = historySnapshot.data() as { rating?: number } | undefined;

      const profileCurrent =
        profileSnapshot.exists &&
        profileData?.currentRating === rating &&
        normalizeDate(profileData?.ratingEffectiveDate) === effectiveDate;
      const historyCurrent = historySnapshot.exists && historyData?.rating === rating;

      if (profileCurrent && historyCurrent) {
        alreadyUpToDate += 1;
        console.log(`[${index + 1}/${pdgaNumbers.length}] #${pdgaNumber}: already up to date.`);
        continue;
      }

      const syncedAt = new Date().toISOString();
      await upsertPdgaProfile(
        {
          ...player,
          rating: String(rating),
          rating_effective_date: effectiveDate,
        },
        syncedAt,
      );

      if (!profileCurrent) updatedProfiles += 1;
      if (!historySnapshot.exists) createdHistoryEntries += 1;
      else if (!historyCurrent) repairedHistoryEntries += 1;

      console.log(
        `[${index + 1}/${pdgaNumbers.length}] #${pdgaNumber}: synchronized` +
          `${profileCurrent ? "" : " profile"}${historyCurrent ? "" : " history"}.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ pdgaNumber, message });
      console.error(`[${index + 1}/${pdgaNumbers.length}] #${pdgaNumber}: ${message}`);
    }

    if (index < pdgaNumbers.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }

  const completedAt = new Date().toISOString();
  const selectiveSync = {
    startedAt,
    completedAt,
    effectiveDate,
    totalPlayers: pdgaNumbers.length,
    checked,
    alreadyUpToDate,
    updatedProfiles,
    createdHistoryEntries,
    repairedHistoryEntries,
    notInCurrentRelease,
    unrated,
    failureCount: failures.length,
    failures,
  };

  await db.collection("syncLogs").doc(syncId).set(
    {
      type: "pdga-monthly-rating-sync",
      status: failures.length ? "sync-partial" : "selective-sync-complete",
      selectiveSync,
    },
    { merge: true },
  );

  console.log(
    `Selective monthly sync complete: ${alreadyUpToDate} already current, ${updatedProfiles} profiles updated, ` +
      `${createdHistoryEntries} history entries created, ${repairedHistoryEntries} repaired, ` +
      `${notInCurrentRelease} without the target release, ${unrated} unrated, ${failures.length} failures.`,
  );

  if (failures.length) {
    throw new Error(`${failures.length} PDGA player(s) failed. Re-run is safe: current players will be skipped.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
