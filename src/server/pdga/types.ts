export interface PdgaSession {
  sessid: string;
  session_name: string;
  token: string;
}

export interface PdgaApiPlayer {
  first_name: string;
  last_name: string;
  pdga_number: string;
  membership_status?: string;
  membership_expiration_date?: string;
  classification?: "P" | "A";
  city?: string;
  state_prov?: string;
  country?: string;
  rating?: string;
  rating_effective_date?: string;
  official_status?: string;
  official_expiration_date?: string;
  last_modified?: string;
}
