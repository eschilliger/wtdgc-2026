import { NextRequest, NextResponse } from "next/server";
import { getSessionClaims, roleFromClaims } from "../../../../../../server/auth/session";
import { auth, db } from "../../../../../../server/firebase/admin";

type ManagedRole = "admin" | "staff" | "player";

function publicOrigin(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host");
  if (!host) return request.nextUrl.origin;
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProto || request.nextUrl.protocol.replace(":", "") || "https";
  return `${protocol}://${host}`;
}

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === publicOrigin(request);
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ uid: string }> }) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "invalid-origin" }, { status: 403 });

  const claims = await getSessionClaims();
  if (!claims) return NextResponse.json({ error: "authentication-required" }, { status: 401 });
  if (roleFromClaims(claims) !== "admin") return NextResponse.json({ error: "admin-required" }, { status: 403 });

  const { uid } = await context.params;
  if (uid === claims.uid) return NextResponse.json({ error: "self-role-change-forbidden" }, { status: 409 });

  const body = await request.json().catch(() => null) as { role?: ManagedRole } | null;
  const role = body?.role;
  if (role !== "admin" && role !== "staff" && role !== "player") {
    return NextResponse.json({ error: "invalid-role" }, { status: 400 });
  }

  try {
    const user = await auth.getUser(uid);
    await auth.setCustomUserClaims(uid, { ...(user.customClaims ?? {}), role });
    await db.collection("appUsers").doc(uid).set({
      uid,
      email: user.email ?? null,
      role,
      updatedAt: new Date().toISOString(),
      updatedBy: claims.uid,
    }, { merge: true });
    return NextResponse.json({ ok: true, uid, role });
  } catch {
    return NextResponse.json({ error: "user-role-update-failed" }, { status: 500 });
  }
}
