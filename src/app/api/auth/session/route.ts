import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../server/firebase/admin";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "../../../../server/auth/session";

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return origin === request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "invalid-origin" }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as { idToken?: string } | null;
  const idToken = body?.idToken;
  if (!idToken) return NextResponse.json({ error: "missing-id-token" }, { status: 400 });

  try {
    const claims = await auth.verifyIdToken(idToken);
    const now = Math.floor(Date.now() / 1000);
    if (now - claims.auth_time > 5 * 60) {
      return NextResponse.json({ error: "recent-sign-in-required" }, { status: 401 });
    }

    const sessionCookie = await auth.createSessionCookie(idToken, {
      expiresIn: SESSION_MAX_AGE_SECONDS * 1000,
    });

    const response = NextResponse.json({
      ok: true,
      role: claims.role === "staff" || claims.role === "player" ? claims.role : null,
    });
    response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "invalid-id-token" }, { status: 401 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "invalid-origin" }, { status: 403 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
