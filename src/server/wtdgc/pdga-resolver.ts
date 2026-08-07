import type { PdgaApiPlayer } from "@/server/pdga/types";
import { searchPdgaPlayers } from "@/server/pdga/client";
import { findKnownPdgaResolution } from "./known-pdga-resolutions";
import type { NormalizedWtdgcMember } from "./types";

const COUNTRY_CODE_BY_TEAM_COUNTRY: Record<string, string> = {
  Finland: "FI",
  France: "FR",
  Germany: "DE",
  Austria: "AT",
  Australia: "AU",
  Canada: "CA",
  Colombia: "CO",
  Croatia: "HR",
  Czechia: "CZ",
  Denmark: "DK",
  Estonia: "EE",
  Hungary: "HU",
  Iceland: "IS",
  Ireland: "IE",
  Italy: "IT",
  Japan: "JP",
  Latvia: "LV",
  Lithuania: "LT",
  Netherlands: "NL",
  Norway: "NO",
  Poland: "PL",
  Romania: "RO",
  Slovakia: "SK",
  Spain: "ES",
  Switzerland: "CH",
  Ukraine: "UA",
  "Great Britain": "GB",
  "South Africa": "ZA",
  "United States of America": "US",
};

function simplify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function candidateScore(member: NormalizedWtdgcMember, candidate: PdgaApiPlayer) {
  let score = 0;
  if (simplify(candidate.first_name) === simplify(member.givenName)) score += 4;
  if (simplify(candidate.last_name) === simplify(member.familyName)) score += 5;
  if (simplify(`${candidate.first_name} ${candidate.last_name}`) === simplify(member.fullName)) score += 4;
  return score;
}

export async function resolveMissingPdgaNumber(member: NormalizedWtdgcMember) {
  if (member.teamRole !== "Player" || member.pdgaNumberNormalized) return member;

  const countryName = member.teamKey.split("|")[0];
  const country = COUNTRY_CODE_BY_TEAM_COUNTRY[countryName];
  const candidates = await searchPdgaPlayers({
    firstName: member.givenName,
    lastName: member.familyName,
    country,
    limit: 20,
  });

  const ranked = candidates
    .map((candidate) => ({ candidate, score: candidateScore(member, candidate) }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (best && best.score >= 8 && (!ranked[1] || ranked[1].score !== best.score)) {
    const pdgaNumber = Number.parseInt(best.candidate.pdga_number, 10);
    if (Number.isFinite(pdgaNumber)) {
      return {
        ...member,
        pdgaNumberNormalized: pdgaNumber,
        pdgaResolutionSource: "pdga-api" as const,
      };
    }
  }

  const known = findKnownPdgaResolution(member.teamKey, member.fullName);
  if (!known) return member;

  return {
    ...member,
    pdgaNumberNormalized: known.pdgaNumber,
    pdgaResolutionSource: "pdga-site" as const,
  };
}
