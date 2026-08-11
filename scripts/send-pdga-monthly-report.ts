import { readFile } from "node:fs/promises";
import { db } from "../src/server/firebase/admin";

function arg(name: string, fallback?: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

async function main() {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.PDGA_REPORT_TO ?? "eschilliger@gmail.com";
  const from = process.env.PDGA_REPORT_FROM ?? "WTDGC Scout <onboarding@resend.dev>";
  const jsonPath = arg("--json", "pdga-monthly-report.json")!;
  const htmlPath = arg("--html", "pdga-monthly-report.html")!;
  if (!apiKey) throw new Error("RESEND_API_KEY secret is missing");

  const report = JSON.parse(await readFile(jsonPath, "utf8")) as { syncId: string; effectiveDate: string; changed: number; withCurrentRelease: number };
  const html = await readFile(htmlPath, "utf8");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `WTDGC 2026 — ratings PDGA ${report.effectiveDate} (${report.changed} changements)`,
      html,
    }),
  });

  const payload = await response.text();
  if (!response.ok) throw new Error(`Resend failed (${response.status}): ${payload}`);
  let messageId: string | null = null;
  try { messageId = (JSON.parse(payload) as { id?: string }).id ?? null; } catch { /* ignore */ }

  await db.collection("syncLogs").doc(report.syncId).set({
    status: "email-sent",
    emailSentAt: new Date().toISOString(),
    emailTo: to,
    emailProvider: "resend",
    emailMessageId: messageId,
  }, { merge: true });
  console.log(`Report sent to ${to}${messageId ? ` (${messageId})` : ""}.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
