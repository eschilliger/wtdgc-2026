export const WTDGC_COUNTRY_ISO2: Record<string, string> = {
  Australia: "AU",
  Austria: "AT",
  Canada: "CA",
  Colombia: "CO",
  Croatia: "HR",
  Czechia: "CZ",
  Denmark: "DK",
  Estonia: "EE",
  Finland: "FI",
  France: "FR",
  Germany: "DE",
  "Great Britain": "GB",
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
  "South Africa": "ZA",
  Spain: "ES",
  Switzerland: "CH",
  Ukraine: "UA",
  "United States of America": "US",
};

export function teamId(country: string, division: string) {
  const iso2 = WTDGC_COUNTRY_ISO2[country];
  if (!iso2) throw new Error(`Missing ISO2 mapping for ${country}`);
  return `${iso2.toLowerCase()}-${division.toLowerCase()}`;
}
