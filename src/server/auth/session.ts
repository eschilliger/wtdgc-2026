import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { DecodedIdToken } from "firebase-admin/auth";
import { auth } from "../firebase/admin";

export const SESSION_COOKIE_NAME = "wtdgc_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 5;

export type WtdgcRole = "admin" | "staff" | "player";

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
  return claims?.role === "admin" || claims?.role === "staff" || claims?.role === "player" ? claims.role : null;
}

export function canAccessPlayerArea(role: WtdgcRole | null) {
  return role === "player" || role === "staff" || role === "admin";
}

export function canAccessStaffArea(role: WtdgcRole | null) {
  return role === "staff" || role === "admin";
}

export function canAccessAdminArea(role: WtdgcRole | null) {
  return role === "admin";
}

function homeForRole(role: WtdgcRole | null) {
  return role ? "/" : "/?status=role-required";
}

export async function requireAuthorizedAccess() {
  const claims = await getSessionClaims();
  const role = roleFromClaims(claims);
  if (!claims) redirect("/login");
  if (!role) redirect("/");
  return claims;
}

export async function requireRole(role: WtdgcRole) {
  const claims = await getSessionClaims();
  const actualRole = roleFromClaims(claims);
  if (!claims) redirect("/login");
  if (actualRole !== role) redirect(homeForRole(actualRole));
  return claims;
}

export async function requirePlayerAccess() {
  const claims = await getSessionClaims();
  const role = roleFromClaims(claims);
  if (!claims) redirect("/login");
  if (!canAccessPlayerArea(role)) redirect(homeForRole(role));
  return claims;
}

export async function requireStaffAccess() {
  const claims = await getSessionClaims();
  const role = roleFromClaims(claims);
  if (!claims) redirect("/login");
  if (!canAccessStaffArea(role)) redirect(homeForRole(role));
  return claims;
}
