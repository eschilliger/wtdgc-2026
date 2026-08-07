import type { NormalizedWtdgcMember, WtdgcMemberRaw } from "./types";

export function normalizePdgaNumber(value: string): number | null {
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeJerseyNumber(value: string): number | null {
  const match = value.trim().match(/\d+/);
  if (!match) return null;
  const parsed = Number.parseInt(match[0], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeMember(teamKey: string, raw: WtdgcMemberRaw): NormalizedWtdgcMember {
  const pdgaNumberNormalized = normalizePdgaNumber(raw.pdgaNumber);

  return {
    ...raw,
    teamKey,
    pdgaNumberRaw: raw.pdgaNumber,
    pdgaNumberNormalized,
    jerseyNumberRaw: raw.jerseyNumber,
    jerseyNumberNormalized: normalizeJerseyNumber(raw.jerseyNumber),
    pdgaResolutionSource: pdgaNumberNormalized ? "wtdgc" : "unresolved",
  };
}
