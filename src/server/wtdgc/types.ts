export type WtdgcDivision = "Open" | "Masters";

export interface WtdgcSummaryEntry {
  country: string;
  division: WtdgcDivision;
  code: string;
  status: string;
  statusLabel: string;
  totalDeclared: number;
  totalSubmitted: number;
  totalRemaining: number;
  declared: { players: number; nptm: number; npts: number };
  submitted: { players: number; nptm: number; npts: number };
  remaining: { players: number; nptm: number; npts: number };
}

export interface WtdgcMemberRaw {
  division: WtdgcDivision;
  givenName: string;
  familyName: string;
  fullName: string;
  pdgaNumber: string;
  jerseyNumber: string;
  teamRole: string;
  specificFunction: string;
}

export interface WtdgcSnapshotRaw {
  summary: WtdgcSummaryEntry[];
  details: Record<string, WtdgcMemberRaw[]>;
}

export interface NormalizedWtdgcMember extends WtdgcMemberRaw {
  teamKey: string;
  pdgaNumberRaw: string;
  pdgaNumberNormalized: number | null;
  jerseyNumberRaw: string;
  jerseyNumberNormalized: number | null;
  pdgaResolutionSource: "wtdgc" | "pdga-api" | "pdga-site" | "unresolved";
}
