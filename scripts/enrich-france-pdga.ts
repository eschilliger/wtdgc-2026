import { getPdgaPlayer, getPdgaPlayerStatistics } from "../src/server/pdga/client";
import { upsertPdgaProfile, upsertPdgaYearlyStats } from "../src/server/repositories/pdga.repository";

const FRANCE_PDGA_NUMBERS = [
  63655,
  105676,
  153567,
  237823,
  154224,
  129367,
  135234,
  57287,
  93622,
  195584,
  189790,
  69452,
  8431,
  154229,
];

async function main() {
  const syncedAt = new Date().toISOString();
  let enriched = 0;

  for (const pdgaNumber of FRANCE_PDGA_NUMBERS) {
    const profile = await getPdgaPlayer(pdgaNumber);
    if (!profile) {
      console.warn(`No PDGA profile found for #${pdgaNumber}`);
      continue;
    }

    await upsertPdgaProfile(profile, syncedAt);
    const stats = await getPdgaPlayerStatistics(2026, pdgaNumber);
    await upsertPdgaYearlyStats(pdgaNumber, 2026, stats, syncedAt);
    enriched += 1;
    console.log(`Enriched PDGA #${pdgaNumber}: ${profile.first_name} ${profile.last_name}`);
  }

  if (enriched !== FRANCE_PDGA_NUMBERS.length) {
    throw new Error(`Expected ${FRANCE_PDGA_NUMBERS.length} France players, enriched ${enriched}.`);
  }

  console.log(`France PDGA enrichment complete: ${enriched} players.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
