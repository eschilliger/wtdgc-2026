import { db } from "../src/server/firebase/admin";
import { getPdgaPlayer } from "../src/server/pdga/client";

const PROBES = [8431, 63655, 105676, 154224, 129367];
const TIME_ZONE = "Europe/Paris";

function parisParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    year: Number(value("year")),
    month: Number(value("month")),
    day: Number(value("day")),
    hour: Number(value("hour")),
    weekday: value("weekday"),
  };
}

function normalizeDate(value?: string) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = value.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (!match) return null;
  const months: Record<string, string> = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };
  const month = months[match[2]];
  return month ? `${match[3]}-${month}-${match[1].padStart(2, "0")}` : null;
}

async function main() {
  const now = parisParts();
  const expectedDate = `${now.year}-${String(now.month).padStart(2, "0")}-${String(now.day).padStart(2, "0")}`;
  const isSecondTuesday = now.weekday === "Tue" && now.day >= 8 && now.day <= 14;
  const manual = process.env.GITHUB_EVENT_NAME === "workflow_dispatch";

  if (!manual && (!isSecondTuesday || now.hour < 9)) {
    console.error(`No-op: Paris=${expectedDate} ${now.hour}:00, secondTuesday=${isSecondTuesday}.`);
    console.log("released=false");
    console.log("complete=false");
    console.log("needs_sync=false");
    console.log(`effective_date=${expectedDate}`);
    return;
  }

  const syncId = `pdga-monthly-${expectedDate}`;
  const existing = await db.collection("syncLogs").doc(syncId).get();
  const status = existing.data()?.status as string | undefined;
  if (status === "email-sent") {
    console.error(`Monthly sync ${syncId} already completed.`);
    console.log("released=false");
    console.log("complete=true");
    console.log("needs_sync=false");
    console.log(`effective_date=${expectedDate}`);
    return;
  }

  if (status === "data-synced") {
    console.error(`Monthly data sync ${syncId} already completed; email still pending.`);
    console.log("released=true");
    console.log("complete=false");
    console.log("needs_sync=false");
    console.log(`effective_date=${expectedDate}`);
    return;
  }

  const observations: string[] = [];
  let released = false;
  for (const pdgaNumber of PROBES) {
    try {
      const player = await getPdgaPlayer(pdgaNumber);
      const date = normalizeDate(player?.rating_effective_date);
      observations.push(`#${pdgaNumber}:${date ?? "n/a"}`);
      if (date === expectedDate) released = true;
    } catch (error) {
      observations.push(`#${pdgaNumber}:error`);
      console.error(error);
    }
  }

  console.error(`PDGA release probes: ${observations.join(", ")}`);
  console.log(`released=${released}`);
  console.log("complete=false");
  console.log(`needs_sync=${released}`);
  console.log(`effective_date=${expectedDate}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
