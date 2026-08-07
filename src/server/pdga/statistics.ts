export type PdgaGender = "M" | "F";

function normalizeGenderValue(value: unknown): PdgaGender | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (["m", "male", "man", "men"].includes(normalized)) return "M";
  if (["f", "female", "woman", "women"].includes(normalized)) return "F";
  return null;
}

export function extractPdgaGender(payload: unknown): PdgaGender | null {
  if (!payload || typeof payload !== "object") return null;

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const gender = extractPdgaGender(item);
      if (gender) return gender;
    }
    return null;
  }

  const record = payload as Record<string, unknown>;
  for (const key of ["gender", "sex"]) {
    const gender = normalizeGenderValue(record[key]);
    if (gender) return gender;
  }

  for (const value of Object.values(record)) {
    const gender = extractPdgaGender(value);
    if (gender) return gender;
  }

  return null;
}
