import { NextRequest, NextResponse } from "next/server";
import { type WtdgcRoundNumber, type WtdgcRoundPublicationStatus } from "../../../../../../domain/wtdgc/competition";
import { nominalSix, slotAssignmentsFromSelection, validateFranceRoster } from "../../../../../../domain/wtdgc/round-assignments";
import { getSessionClaims, roleFromClaims } from "../../../../../../server/auth/session";
import { loadRoundManagement, saveRoundManagement } from "../../../../../../server/repositories/round-management.repository";
import { officialRoundMatchups } from "../../../../../../server/wtdgc/round-roster";

function publicOrigin(request: NextRequest) { const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim(); const host = forwardedHost || request.headers.get("host"); if (!host) return request.nextUrl.origin; const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim(); const protocol = forwardedProto || request.nextUrl.protocol.replace(":", "") || "https"; return `${protocol}://${host}`; }
function sameOrigin(request: NextRequest) { const origin = request.headers.get("origin"); return !origin || origin === publicOrigin(request); }
function parseRound(value: string): WtdgcRoundNumber | null { const round = Number.parseInt(value, 10); return round >= 1 && round <= 8 ? round as WtdgcRoundNumber : null; }
function cleanString(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : null; }

type Body = { publicationStatus?: WtdgcRoundPublicationStatus; opponentTeamId?: string | null; opponentDisabledPlayerIds?: string[]; scheduledStart?: string | null; course?: string | null; startingHole?: string | null; selectedPlayerIds?: string[]; internalNote?: string; };

export async function PUT(request: NextRequest, context: { params: Promise<{ round: string }> }) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "invalid-origin" }, { status: 403 });
  const claims = await getSessionClaims(); const role = roleFromClaims(claims);
  if (!claims) return NextResponse.json({ error: "authentication-required" }, { status: 401 });
  if (role !== "staff" && role !== "admin") return NextResponse.json({ error: "staff-required" }, { status: 403 });
  const { round: rawRound } = await context.params; const roundNumber = parseRound(rawRound);
  if (!roundNumber) return NextResponse.json({ error: "invalid-round" }, { status: 400 });
  const body = await request.json().catch(() => null) as Body | null;
  if (!body) return NextResponse.json({ error: "invalid-body" }, { status: 400 });
  const publicationStatus = body.publicationStatus;
  if (publicationStatus !== "draft" && publicationStatus !== "published") return NextResponse.json({ error: "invalid-publication-status" }, { status: 400 });

  const data = await loadRoundManagement("open", roundNumber);
  const playersById = new Map(data.franceTeam.players.map((player) => [player.id, player] as const));
  const selectedIds = Array.isArray(body.selectedPlayerIds) ? [...new Set(body.selectedPlayerIds.filter((id): id is string => typeof id === "string" && playersById.has(id)))] : [];
  const selected = selectedIds.map((id) => playersById.get(id)!);
  const complete = validateFranceRoster("open", selected).complete;
  const assignments = slotAssignmentsFromSelection("open", selected);

  const opponentTeamId = cleanString(body.opponentTeamId); const scheduledStart = cleanString(body.scheduledStart);
  const opponent = opponentTeamId ? data.teams.find((team) => team.id === opponentTeamId) : null;
  if (opponentTeamId && !opponent) return NextResponse.json({ error: "invalid-opponent" }, { status: 400 });
  const opponentIds = new Set(opponent?.players.map((player) => player.id) ?? []);
  const opponentDisabledPlayerIds = Array.isArray(body.opponentDisabledPlayerIds) ? [...new Set(body.opponentDisabledPlayerIds.filter((id): id is string => typeof id === "string" && opponentIds.has(id)))] : [];
  const opponentSelected = nominalSix(opponent?.players.filter((player) => !opponentDisabledPlayerIds.includes(player.id)) ?? []);
  const opponentAssignments = slotAssignmentsFromSelection("open", opponentSelected);
  const matchups = officialRoundMatchups({ division: "open", roundNumber, slotAssignments: assignments, opponentSlotAssignments: opponentAssignments });
  const assignedOpponentIds = matchups.flatMap((matchup) => matchup.opponentPlayerIds);
  const incompleteMatchup = matchups.some((matchup) => matchup.francePlayerIds.length !== (matchup.format === "single" ? 1 : 2) || matchup.opponentPlayerIds.length !== (matchup.format === "single" ? 1 : 2)) || new Set(assignedOpponentIds).size !== 6;
  if (publicationStatus === "published" && incompleteMatchup) return NextResponse.json({ error: "complete-matchups-required" }, { status: 400 });
  if (publicationStatus === "published" && !complete) return NextResponse.json({ error: "complete-roster-required" }, { status: 400 });
  if (publicationStatus === "published" && !opponentTeamId) return NextResponse.json({ error: "opponent-required" }, { status: 400 });
  if (publicationStatus === "published" && !scheduledStart) return NextResponse.json({ error: "scheduled-start-required" }, { status: 400 });

  await saveRoundManagement({ division: "open", roundNumber, publicationStatus, opponentTeamId, opponentDisabledPlayerIds, opponentMp50PlayerId: null, scheduledStart, course: cleanString(body.course), startingHole: cleanString(body.startingHole), selectedPlayerIds: selectedIds, slotAssignments: assignments, matchups, internalNote: typeof body.internalNote === "string" ? body.internalNote.trim() : "", actorUid: claims.uid, actorEmail: claims.email ?? null });
  return NextResponse.json({ ok: true, publicationStatus });
}
