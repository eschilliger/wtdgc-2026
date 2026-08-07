export interface KnownPdgaResolution {
  teamKey: string;
  fullName: string;
  pdgaNumber: number;
  sourceUrl: string;
}

// Verified against public PDGA player pages when the WTDGC source omitted the number.
export const KNOWN_PDGA_RESOLUTIONS: KnownPdgaResolution[] = [
  {
    teamKey: "Finland|Masters",
    fullName: "Hannele Määttä",
    pdgaNumber: 57529,
    sourceUrl: "https://www.pdga.com/player/57529",
  },
  {
    teamKey: "Finland|Open",
    fullName: "Matias Kalaoja",
    pdgaNumber: 80858,
    sourceUrl: "https://www.pdga.com/player/80858",
  },
];

export function findKnownPdgaResolution(teamKey: string, fullName: string) {
  return KNOWN_PDGA_RESOLUTIONS.find(
    (entry) => entry.teamKey === teamKey && entry.fullName === fullName,
  );
}
