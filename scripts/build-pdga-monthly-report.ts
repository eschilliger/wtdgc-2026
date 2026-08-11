import { readFile, writeFile } from "node:fs/promises";
import { db } from "../src/server/firebase/admin";

type RegistrationRow = [string, string, "player" | "nptm" | "npts", string, string, number | null, number | null, string, string | null, string];
type PlayerDelta = { pdgaNumber: number; name: string; team: string | null; current: number; previous: number | null; delta: number | null };
type SelectiveSync = {
  totalPlayers?: number;
  checked?: number;
  alreadyUpToDate?: number;
  updatedProfiles?: number;
  createdHistoryEntries?: number;
  repairedHistoryEntries?: number;
  notInCurrentRelease?: number;
  unrated?: number;
  failureCount?: number;
};

function arg(name: string, fallback?: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

async function loadRegistrationMap() {
  const map = new Map<number, { name: string; team: string }>();
  for (let i = 1; i <= 8; i += 1) {
    const file = `data/full/regs-${String(i).padStart(2, "0")}.json`;
    const data = JSON.parse(await readFile(file, "utf8")) as { registrations: RegistrationRow[] };
    for (const row of data.registrations) {
      if (row[2] === "player" && row[5]) map.set(row[5], { name: `${row[3]} ${row[4]}`, team: row[0] });
    }
  }
  return map;
}

function esc(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char] ?? char);
}

async function main() {
  const effectiveDate = arg("--effective-date");
  const outJson = arg("--json", "pdga-monthly-report.json")!;
  const outHtml = arg("--html", "pdga-monthly-report.html")!;
  if (!effectiveDate) throw new Error("Missing --effective-date");

  const registrationMap = await loadRegistrationMap();
  const profiles = await db.collection("pdgaProfiles").get();
  const deltas: PlayerDelta[] = [];
  let withCurrentRelease = 0;
  let unchanged = 0;
  let changed = 0;
  let missingCurrentRelease = 0;

  for (const profile of profiles.docs) {
    const pdgaNumber = Number(profile.id);
    const history = await profile.ref.collection("ratingHistory").orderBy("effectiveDate", "desc").limit(2).get();
    const latest = history.docs[0]?.data() as { effectiveDate?: string; rating?: number } | undefined;
    const previous = history.docs[1]?.data() as { rating?: number } | undefined;
    if (latest?.effectiveDate !== effectiveDate || typeof latest.rating !== "number") {
      missingCurrentRelease += 1;
      continue;
    }
    withCurrentRelease += 1;
    const previousRating = typeof previous?.rating === "number" ? previous.rating : null;
    const delta = previousRating === null ? null : latest.rating - previousRating;
    if (delta === 0) unchanged += 1;
    else if (delta !== null) changed += 1;
    const registration = registrationMap.get(pdgaNumber);
    const data = profile.data() as { firstName?: string; lastName?: string };
    const profileName = `${data.firstName ?? ""} ${data.lastName ?? ""}`.trim();
    deltas.push({
      pdgaNumber,
      name: registration?.name ?? (profileName || `PDGA #${pdgaNumber}`),
      team: registration?.team ?? null,
      current: latest.rating,
      previous: previousRating,
      delta,
    });
  }

  const comparable = deltas.filter((item): item is PlayerDelta & { delta: number } => item.delta !== null);
  const increases = comparable.filter((item) => item.delta > 0).sort((a, b) => b.delta - a.delta);
  const decreases = comparable.filter((item) => item.delta < 0).sort((a, b) => a.delta - b.delta);
  const france = deltas.filter((item) => item.team?.startsWith("fr-"));
  const franceOpen = france.filter((item) => item.team === "fr-open").sort((a, b) => b.current - a.current);
  const franceMasters = france.filter((item) => item.team === "fr-masters").sort((a, b) => b.current - a.current);
  const syncId = `pdga-monthly-${effectiveDate}`;
  const syncSnapshot = await db.collection("syncLogs").doc(syncId).get();
  const selectiveSync = (syncSnapshot.data()?.selectiveSync ?? null) as SelectiveSync | null;
  const completedAt = new Date().toISOString();

  const report = {
    syncId,
    effectiveDate,
    completedAt,
    totalProfiles: profiles.size,
    withCurrentRelease,
    missingCurrentRelease,
    changed,
    unchanged,
    increases: increases.length,
    decreases: decreases.length,
    biggestIncrease: increases[0] ?? null,
    biggestDecrease: decreases[0] ?? null,
    selectiveSync,
    franceOpen,
    franceMasters,
  };

  await db.collection("syncLogs").doc(syncId).set({ ...report, type: "pdga-monthly-rating-sync", status: "data-synced" }, { merge: true });
  await writeFile(outJson, JSON.stringify(report, null, 2), "utf8");

  const rows = (players: PlayerDelta[]) => players.map((p) => `<tr><td>${esc(p.name)}</td><td>#${p.pdgaNumber}</td><td>${p.current}</td><td>${p.delta === null ? "—" : `${p.delta > 0 ? "+" : ""}${p.delta}`}</td></tr>`).join("");
  const selectiveSummary = selectiveSync
    ? `<p><strong>Synchronisation :</strong> ${selectiveSync.checked ?? 0} joueurs contrôlés, ${selectiveSync.alreadyUpToDate ?? 0} déjà à jour, ${selectiveSync.updatedProfiles ?? 0} profils mis à jour, ${selectiveSync.createdHistoryEntries ?? 0} historiques créés, ${selectiveSync.repairedHistoryEntries ?? 0} historiques réparés, ${selectiveSync.failureCount ?? 0} erreur(s).</p>`
    : "";
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#17202a"><h2>WTDGC 2026 — mise à jour ratings PDGA</h2><p><strong>Date effective :</strong> ${esc(effectiveDate)}</p>${selectiveSummary}<p>${withCurrentRelease} profils avec la nouvelle date sur ${profiles.size}. ${changed} ratings modifiés, ${unchanged} inchangés. ${increases.length} hausses, ${decreases.length} baisses.</p><p><strong>Plus forte hausse :</strong> ${report.biggestIncrease ? `${esc(report.biggestIncrease.name)} ${report.biggestIncrease.delta > 0 ? "+" : ""}${report.biggestIncrease.delta}` : "n/a"}<br><strong>Plus forte baisse :</strong> ${report.biggestDecrease ? `${esc(report.biggestDecrease.name)} ${report.biggestDecrease.delta}` : "n/a"}</p><h3>France Open</h3><table cellpadding="6" cellspacing="0" border="1"><tr><th>Joueur</th><th>PDGA</th><th>Rating</th><th>Δ</th></tr>${rows(franceOpen)}</table><h3>France Masters</h3><table cellpadding="6" cellspacing="0" border="1"><tr><th>Joueur</th><th>PDGA</th><th>Rating</th><th>Δ</th></tr>${rows(franceMasters)}</table><p style="color:#748193">Rapport généré ${esc(completedAt)}.</p></body></html>`;
  await writeFile(outHtml, html, "utf8");
  console.log(JSON.stringify(report));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
