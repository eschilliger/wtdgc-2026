export type TeamCategory = "open" | "masters";
export type TeamMemberRole = "player" | "nptm" | "npts";

export interface Country {
  id: string;
  name: string;
  iso2: string;
}

export interface Team {
  id: string;
  eventId: string;
  countryId: string;
  category: TeamCategory;
  teamCode: string;
  registrationStatus?: string;
  declaredPlaces?: number;
  submittedPlaces?: number;
  sourceUpdatedAt?: string;
}

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  pdgaNumber?: number;
}

export interface Registration {
  id: string;
  teamId: string;
  playerId?: string;
  role: TeamMemberRole;
  jerseyNumber?: string;
  specificFunction?: string;
  sourceUrl: string;
  sourceUpdatedAt?: string;
}

export interface PdgaProfile {
  pdgaNumber: number;
  firstName: string;
  lastName: string;
  membershipStatus?: string;
  membershipExpirationDate?: string;
  classification?: "P" | "A";
  city?: string;
  stateProv?: string;
  country?: string;
  rating?: number;
  ratingEffectiveDate?: string;
  officialStatus?: string;
  officialExpirationDate?: string;
  lastModified?: string;
  syncedAt: string;
}

export interface PdgaYearlyStat {
  pdgaNumber: number;
  year: number;
  divisionCode: string;
  rating?: number;
  tournaments?: number;
  ratingRoundsUsed?: number;
  points?: number;
  prize?: number;
  syncedAt: string;
}
