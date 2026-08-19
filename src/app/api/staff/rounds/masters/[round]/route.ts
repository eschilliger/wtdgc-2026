import { NextRequest, NextResponse } from "next/server";
import { type WtdgcRoundNumber, type WtdgcRoundPublicationStatus } from "../../../../../../domain/wtdgc/competition";
import { getSessionClaims, roleFromClaims } from "../../../../../../server/auth/session";
import { loadRoundManagement, saveRoundManagement, type RoundMatchup } from "../../../../../../server/repositories/round-management.repository";

function publicOrigin(request: NextRequest) { const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim(); const host = forwardedHost || request.headers.get("host"); if (!host) return request.nextUrl.origin; const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim(); const protocol = forwardedProto || request.nextUrl.protocol.replace(":", "") || "https"; return `${protocol}://${host}`; }
function sameOrigin(request: NextRequest) { const origin = request.headers.get("origin"); return !origin || origin === publicOrigin(request); }
function parseRound(value: string): WtdgcRoundNumber | null { const round = Number.parseInt(value, 10); return round >= 1 && round <= 8 ? round as WtdgcRoundNumber : null; }
function cleanString(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : null; }

type Body = { publicationStatus?: WtdgcRoundPublicationStatus; opponentTeamId?: string | null; opponentDisabledPlayerIds?: string[]; scheduledStart?: string | null; course?: string | null; startingHole?: string | null; selectedPlayerIds?: string[]; matchups?: RoundMatchup[]; internalNote?: string; };

function parseMatchups(value: unknown, franceIds: Set<string>, opponentIds: Set<string>, disabledOpponentIds: Set<string>) {
  if (!Array.isArray(value)) return [] as RoundMatchup[];
  const matchups: RoundMatchup[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const raw = value[index];
    if (!raw || typeof raw !== "object") return null;
    const item = raw as Partial<RoundMatchup>;
    if (item.format !== "single" && item.format !== "double") return null;
    const size = item.format === "single" ? 1 : 2;
    const francePlayerIds = Array.isArray(item.francePlayerIds) ? [...new Set(item.francePlayerIds.filter((id): id is string => typeof id === "string" && franceIds.has(id)))].slice(0, size) : [];
    const opponentPlayerIds = Array.isArray(item.opponentPlayerIds) ? [...new Set(item.opponentPlayerIds.filter((id): id is string => typeof id === "string" && opponentIds.has(id) && !disabledOpponentIds.has(id)))].slice(0, size) : [];
    matchups.push({ id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : `match-${index + 1}`, order: index + 1, format: item.format, francePlayerIds, opponentPlayerIds });
  }
  return matchups;
}

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
  if (publicationStatus !== "draft" && publicationStatus !== "ready" && publicationStatus !== "published") return NextResponse.json({ error: "invalid-publication-status" }, { status: 400 });

  const data = await loadRoundManagement("masters", roundNumber);
  const playersById = new Map(data.franceTeam.players.map((player) => [player.id, player] as const));
  const selectedPlayerIds = Array.isArray(body.selectedPlayerIds) ? [...new Set(body.selectedPlayerIds.filter((id): id is string => typeof id === "string" && playersById.has(id)))] : [];
  const selected = selectedPlayerIds.map((id) => playersById.get(id)!);
  const complete = selected.filter((player) => player.gender === "M").length === 4 && selected.filter((player) => player.gender === "F").length === 2 && selected.length === 6;
  const opponentTeamId = cleanString(body.opponentTeamId); const scheduledStart = cleanString(body.scheduledStart);
  const opponent = opponentTeamId ? data.teams.find((team) => team.id === opponentTeamId) : null;
  if (opponentTeamId && !opponent) return NextResponse.json({ error: "invalid-opponent" }, { status: 400 });
  const opponentIds = new Set(opponent?.players.map((player) => player.id) ?? []);
  const opponentDisabledPlayerIds = Array.isArray(body.opponentDisabledPlayerIds) ? [...new Set(body.opponentDisabledPlayerIds.filter((id): id is string => typeof id === "string" && opponentIds.has(id)))] : [];
  const matchups = parseMatchups(body.matchups, new Set(selectedPlayerIds), opponentIds, new Set(opponentDisabledPlayerIds));
  if (!matchups) return NextResponse.json({ error: "invalid-matchups" }, { status: 400 });
  const incompleteMatchup = matchups.some((matchup) => matchup.francePlayerIds.length !== (matchup.format === "single" ? 1 : 2) || matchup.opponentPlayerIds.length !== (matchup.format === "single" ? 1 : 2));
  if (publicationStatus !== "draft" && incompleteMatchup) return NextResponse.json({ error: "complete-matchups-required" }, { status: 400 });
  if (publicationStatus !== "draft" && !complete) return NextResponse.json({ error: "complete-roster-required" }, { status: 400 });
  if (publicationStatus !== "draft" && !opponentTeamId) return NextResponse.json({ error: "opponent-required" }, { status: 400 });
  if (publicationStatus === "published" && !scheduledStart) return NextResponse.json({ error: "scheduled-start-required" }, { status: 400 });

  await saveRoundManagement({ division: "masters", roundNumber, publicationStatus, opponentTeamId, opponentDisabledPlayerIds, scheduledStart, course: cleanString(body.course), startingHole: cleanString(body.startingHole), selectedPlayerIds, matchups, internalNote: typeof body.internalNote === "string" ? body.internalNote.trim() : "", actorUid: claims.uid, actorEmail: claims.email ?? null });
  return NextResponse.json({ ok: true, publicationStatus });
}
