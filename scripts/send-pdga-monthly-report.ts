import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { connect, type TLSSocket } from "node:tls";
import { db } from "../src/server/firebase/admin";

function arg(name: string, fallback?: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function encodeHeader(value: string) {
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function createLineReader(socket: TLSSocket) {
  const iterator = socket[Symbol.asyncIterator]();
  let buffer = "";

  return async function readLine(): Promise<string> {
    while (!buffer.includes("\r\n")) {
      const next = await iterator.next();
      if (next.done) throw new Error("Gmail SMTP connection closed unexpectedly");
      buffer += Buffer.isBuffer(next.value) ? next.value.toString("utf8") : String(next.value);
    }

    const end = buffer.indexOf("\r\n");
    const line = buffer.slice(0, end);
    buffer = buffer.slice(end + 2);
    return line;
  };
}

async function sendViaGmailSmtp(input: {
  username: string;
  appPassword: string;
  to: string;
  subject: string;
  html: string;
}) {
  const socket = connect({
    host: "smtp.gmail.com",
    port: 465,
    servername: "smtp.gmail.com",
    rejectUnauthorized: true,
  });

  await once(socket, "secureConnect");
  socket.setTimeout(30_000, () => socket.destroy(new Error("Gmail SMTP timeout")));
  const readLine = createLineReader(socket);

  async function response(expected: number | number[]) {
    const expectedCodes = Array.isArray(expected) ? expected : [expected];
    const first = await readLine();
    const code = Number.parseInt(first.slice(0, 3), 10);
    const multiline = first[3] === "-";

    if (multiline) {
      while (true) {
        const line = await readLine();
        if (line.startsWith(`${code} `)) break;
      }
    }

    if (!expectedCodes.includes(code)) {
      throw new Error(`Gmail SMTP returned ${code}: ${first.slice(4)}`);
    }
  }

  async function command(value: string, expected: number | number[]) {
    socket.write(`${value}\r\n`);
    await response(expected);
  }

  try {
    await response(220);
    await command("EHLO github-actions", 250);
    await command("AUTH LOGIN", 334);
    await command(Buffer.from(input.username, "utf8").toString("base64"), 334);
    await command(Buffer.from(input.appPassword, "utf8").toString("base64"), 235);
    await command(`MAIL FROM:<${input.username}>`, 250);
    await command(`RCPT TO:<${input.to}>`, [250, 251]);
    await command("DATA", 354);

    const headers = [
      `From: WTDGC Scout <${input.username}>`,
      `To: ${input.to}`,
      `Subject: ${encodeHeader(input.subject)}`,
      `Date: ${new Date().toUTCString()}`,
      "MIME-Version: 1.0",
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: 8bit",
    ].join("\r\n");

    const body = input.html
      .replace(/\r?\n/g, "\r\n")
      .replace(/^\./gm, "..");

    socket.write(`${headers}\r\n\r\n${body}\r\n.\r\n`);
    await response(250);
    await command("QUIT", 221);
  } finally {
    socket.end();
  }
}

async function main() {
  const username = process.env.GMAIL_SMTP_USERNAME ?? "eschilliger@gmail.com";
  const appPassword = process.env.GMAIL_APP_PASSWORD;
  const to = process.env.PDGA_REPORT_TO ?? "eschilliger@gmail.com";
  const jsonPath = arg("--json", "pdga-monthly-report.json")!;
  const htmlPath = arg("--html", "pdga-monthly-report.html")!;

  if (!appPassword) throw new Error("GMAIL_APP_PASSWORD secret is missing");

  const report = JSON.parse(await readFile(jsonPath, "utf8")) as {
    syncId: string;
    effectiveDate: string;
    changed: number;
    withCurrentRelease: number;
  };
  const html = await readFile(htmlPath, "utf8");
  const subject = `WTDGC 2026 — ratings PDGA ${report.effectiveDate} (${report.changed} changements)`;

  await sendViaGmailSmtp({ username, appPassword, to, subject, html });

  await db.collection("syncLogs").doc(report.syncId).set({
    status: "email-sent",
    emailSentAt: new Date().toISOString(),
    emailTo: to,
    emailFrom: username,
    emailProvider: "gmail-smtp",
  }, { merge: true });

  console.log(`Report sent to ${to} through Gmail SMTP.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
