import { NextRequest, NextResponse } from "next/server";
import { OPEN_ROSTER_SLOTS, type OpenRosterSlot } from "../../../../../domain/wtdgc/competition";
import { getSessionClaims, roleFromClaims } from "../../../../../server/auth/session";
import { db } from "../../../../../server/firebase/admin";
import { upsertDefaultMatchRoster } from "../../../../../server/repositories/competition.repository";
import { loadFranceOpenRosterData } from "../../../../../server/repositories/france-roster.repository";

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

export async function PUT(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "invalid-origin" }, { status: 403 });

  const claims = await getSessionClaims();
  const role = roleFromClaims(claims);
  if (!claims) return NextResponse.json({ error: "authentication-required" }, { status: 401 });
  if (role !== "staff" && role !== "admin") return NextResponse.json({ error: "staff-required" }, { status: 403 });

  const body = await request.json().catch(() => null) as {
    slotAssignments?: Partial<Record<OpenRosterSlot, string>>;
    confirmed?: boolean;
  } | null;
  if (!body?.slotAssignments || typeof body.confirmed !== "boolean") {
    return NextResponse.json({ error: "invalid-payload" }, { status: 400 });
  }

  const { players } = await loadFranceOpenRosterData();
  const playersById = new Map(players.map((player) => [player.id, player] as const));
  const cleanAssignments: Partial<Record<OpenRosterSlot, string>> = {};

  for (const slot of OPEN_ROSTER_SLOTS) {
    const playerId = body.slotAssignments[slot]?.trim();
    if (!playerId) continue;
    const player = playersById.get(playerId);
    if (!player) return NextResponse.json({ error: `invalid-player-for-${slot}` }, { status: 400 });
    if (slot.startsWith("FPO") && player.gender !== "F") {
      return NextResponse.json({ error: `fpo-player-required-for-${slot}` }, { status: 400 });
    }
    cleanAssignments[slot] = playerId;
  }

  const selectedPlayerIds = OPEN_ROSTER_SLOTS.map((slot) => cleanAssignments[slot]).filter((value): value is string => Boolean(value));
  if (new Set(selectedPlayerIds).size !== selectedPlayerIds.length) {
    return NextResponse.json({ error: "duplicate-player" }, { status: 400 });
  }

  const complete = OPEN_ROSTER_SLOTS.every((slot) => Boolean(cleanAssignments[slot]));
  if (body.confirmed && !complete) {
    return NextResponse.json({ error: "six-complete-slots-required" }, { status: 400 });
  }

  await upsertDefaultMatchRoster("open", {
    selectedPlayerIds,
    slotAssignments: cleanAssignments,
    confirmed: body.confirmed,
    eligibilityValidated: complete,
  });
  await db.collection("events").doc("wtdgc-2026").collection("defaultMatchRosters").doc("open").set({
    updatedBy: claims.uid,
    updatedByEmail: claims.email ?? null,
  }, { merge: true });

  return NextResponse.json({
    ok: true,
    confirmed: body.confirmed,
    selectedPlayerIds,
    slotAssignments: cleanAssignments,
  });
}
