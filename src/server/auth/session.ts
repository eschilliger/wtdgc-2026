import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { DecodedIdToken } from "firebase-admin/auth";
import { auth } from "../firebase/admin";

export const SESSION_COOKIE_NAME = "wtdgc_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 5;

export type WtdgcRole = "staff" | "player";

export async function getSessionClaims(): Promise<DecodedIdToken | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return null;

  try {
    return await auth.verifySessionCookie(sessionCookie, true);
  } catch {
    return null;
  }
}

export function roleFromClaims(claims: DecodedIdToken | null): WtdgcRole | null {
  return claims?.role === "staff" || claims?.role === "player" ? claims.role : null;
}

export async function requireRole(role: WtdgcRole) {
  const claims = await getSessionClaims();
  const actualRole = roleFromClaims(claims);
  if (!claims) redirect("/login");
  if (actualRole !== role) redirect(actualRole === "staff" ? "/staff" : actualRole === "player" ? "/player-area" : "/login?status=role-required");
  return claims;
}
