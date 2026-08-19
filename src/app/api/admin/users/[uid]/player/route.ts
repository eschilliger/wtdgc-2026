import { NextRequest, NextResponse } from "next/server";
import { getSessionClaims, roleFromClaims } from "../../../../../../server/auth/session";
import { auth, db } from "../../../../../../server/firebase/admin";
import { loadScoutingTeams } from "../../../../../../server/repositories/scouting.repository";

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
  const body = await request.json().catch(() => null) as { personId?: string | null } | null;
  if (!body || (body.personId !== null && body.personId !== undefined && typeof body.personId !== "string")) {
    return NextResponse.json({ error: "invalid-body" }, { status: 400 });
  }

  try {
    const user = await auth.getUser(uid);
    const personId = body.personId?.trim() || null;
    let association: { personId: string | null; pdgaNumber: number | null; division: "open" | "masters" | null; playerDisplayName: string | null } = {
      personId: null,
      pdgaNumber: null,
      division: null,
      playerDisplayName: null,
    };

    if (personId) {
      const [openTeams, mastersTeams] = await Promise.all([loadScoutingTeams("open"), loadScoutingTeams("masters")]);
      const franceTeams = [...openTeams, ...mastersTeams].filter((team) => team.countryCode === "FR" || team.country.trim().toLowerCase() === "france");
      const match = franceTeams.flatMap((team) => team.players.map((player) => ({ team, player }))).find(({ player }) => player.id === personId);
      if (!match) return NextResponse.json({ error: "france-player-not-found" }, { status: 400 });
      association = {
        personId: match.player.id,
        pdgaNumber: match.player.pdgaNumber,
        division: match.team.division,
        playerDisplayName: `${match.player.firstName} ${match.player.lastName}`,
      };
    }

    await db.collection("appUsers").doc(uid).set({
      uid,
      email: user.email ?? null,
      ...association,
      updatedAt: new Date().toISOString(),
      updatedBy: claims.uid,
    }, { merge: true });

    return NextResponse.json({ ok: true, ...association });
  } catch {
    return NextResponse.json({ error: "player-association-update-failed" }, { status: 500 });
  }
}
