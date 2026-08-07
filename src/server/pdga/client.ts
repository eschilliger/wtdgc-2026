import "server-only";
import type { PdgaApiPlayer, PdgaSession } from "./types";

const baseUrl = process.env.PDGA_API_BASE_URL ?? "https://api.pdga.com";
let sessionCache: PdgaSession | null = null;

function sessionCookie(session: PdgaSession) {
  return `${session.session_name}=${session.sessid}`;
}

async function login(): Promise<PdgaSession> {
  const username = process.env.PDGA_API_USERNAME;
  const password = process.env.PDGA_API_PASSWORD;

  if (!username || !password) {
    throw new Error("PDGA API credentials are not configured");
  }

  const response = await fetch(`${baseUrl}/services/json/user/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`PDGA login failed (${response.status})`);
  }

  const data = (await response.json()) as PdgaSession;

  if (!data.sessid || !data.session_name || !data.token) {
    throw new Error("Invalid PDGA login response");
  }

  sessionCache = data;
  return data;
}

async function getSession() {
  return sessionCache ?? login();
}

async function pdgaGet<T>(path: string, retry = true): Promise<T> {
  const session = await getSession();
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Cookie: sessionCookie(session) },
    cache: "no-store",
  });

  if ((response.status === 401 || response.status === 403) && retry) {
    sessionCache = null;
    await login();
    return pdgaGet<T>(path, false);
  }

  if (!response.ok) {
    throw new Error(`PDGA request failed (${response.status})`);
  }

  return response.json() as Promise<T>;
}

export async function getPdgaPlayer(pdgaNumber: number): Promise<PdgaApiPlayer | null> {
  const result = await pdgaGet<{ players?: PdgaApiPlayer[] }>(
    `/services/json/players?pdga_number=${encodeURIComponent(pdgaNumber)}`,
  );

  return result.players?.[0] ?? null;
}

export async function getPdgaPlayerStatistics(year: number, pdgaNumber?: number) {
  const params = new URLSearchParams({ year: String(year) });
  if (pdgaNumber) params.set("pdga_number", String(pdgaNumber));

  return pdgaGet<unknown>(`/services/json/player-statistics?${params.toString()}`);
}
