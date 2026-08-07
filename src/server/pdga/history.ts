export type PdgaRatingHistoryEntry = {
  effectiveDate: string;
  rating: number;
  roundsUsed: number;
};

const MONTHS: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

function stripTags(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function parseEffectiveDate(value: string) {
  const match = value.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (!match) return null;
  const [, day, monthName, year] = match;
  const month = MONTHS[monthName];
  if (!month) return null;
  return `${year}-${month}-${day.padStart(2, "0")}`;
}

export function parsePdgaRatingHistoryHtml(html: string): PdgaRatingHistoryEntry[] {
  const entries: PdgaRatingHistoryEntry[] = [];
  const rowRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(html))) {
    const cells = [...rowMatch[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => stripTags(match[1]));
    if (cells.length < 3) continue;

    const effectiveDate = parseEffectiveDate(cells[0]);
    const rating = Number.parseInt(cells[1], 10);
    const roundsUsed = Number.parseInt(cells[2], 10);
    if (!effectiveDate || !Number.isFinite(rating) || !Number.isFinite(roundsUsed)) continue;

    entries.push({ effectiveDate, rating, roundsUsed });
  }

  return entries.sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
}

export async function fetchPdgaRatingHistory(pdgaNumber: number) {
  const url = `https://www.pdga.com/player/${pdgaNumber}/history`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "WTDGC-2026-Scout/1.0 (+https://www.pdga.com)",
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`PDGA history request failed for #${pdgaNumber}: HTTP ${response.status}`);
  }

  const html = await response.text();
  const entries = parsePdgaRatingHistoryHtml(html);
  if (!entries.length) {
    throw new Error(`No rating history rows parsed for PDGA #${pdgaNumber}.`);
  }

  return { url, entries };
}
