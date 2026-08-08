import { getPdgaPlayerStatistics } from "./client";
import { extractPdgaGender, type PdgaGender } from "./statistics";

export type PdgaGenderSource = "player-statistics" | "details-page" | "default-m";

function textContent(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractGenderFromPdgaDetailsHtml(html: string): PdgaGender | null {
  const text = textContent(html);
  const labelled = text.match(/(?:gender|sex)\s*:?\s*(male|female|man|woman|m|f)\b/i);
  if (labelled) return extractPdgaGender({ gender: labelled[1] });

  const division = text.match(/\b(FPO|FP\d{2}|FA\d|FW\d|MJ\d|FJ\d|MPO|MP\d{2}|MA\d|MM\d)\b/i)?.[1]?.toUpperCase();
  if (division?.startsWith("F")) return "F";
  if (division?.startsWith("M")) return "M";

  return null;
}

async function fetchGenderFromDetailsPage(pdgaNumber: number): Promise<PdgaGender | null> {
  const response = await fetch(`https://www.pdga.com/player/${pdgaNumber}/details`, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "WTDGC-2026-Scout/1.0 (+https://www.pdga.com)",
    },
    cache: "no-store",
  });

  if (!response.ok) return null;
  return extractGenderFromPdgaDetailsHtml(await response.text());
}

export async function resolvePdgaGender(pdgaNumber: number): Promise<{
  gender: PdgaGender;
  source: PdgaGenderSource;
}> {
  try {
    const statistics = await getPdgaPlayerStatistics(2026, pdgaNumber);
    const gender = extractPdgaGender(statistics);
    if (gender) return { gender, source: "player-statistics" };
  } catch (error) {
    console.warn(`PDGA player-statistics gender lookup failed for #${pdgaNumber}`, error);
  }

  try {
    const gender = await fetchGenderFromDetailsPage(pdgaNumber);
    if (gender) return { gender, source: "details-page" };
  } catch (error) {
    console.warn(`PDGA details-page gender lookup failed for #${pdgaNumber}`, error);
  }

  return { gender: "M", source: "default-m" };
}
