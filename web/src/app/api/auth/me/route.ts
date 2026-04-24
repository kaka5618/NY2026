import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { findUserById } from "@/server/db/users-repo";
import { SESSION_COOKIE, verifySessionToken } from "@/server/auth/session";

export const runtime = "nodejs";

/**
 * GET /api/auth/me — 返回当前登录用户（无 Cookie 则 user 为 null）。
 */
export async function GET(): Promise<Response> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) {
    return NextResponse.json({ user: null });
  }
  const payload = await verifySessionToken(raw);
  if (!payload) {
    return NextResponse.json({ user: null });
  }

  try {
    const row = await findUserById(payload.sub);
    if (!row) {
      return NextResponse.json({ user: null });
    }
    return NextResponse.json({
      user: {
        id: row.id,
        username: row.username,
        email: row.email,
        nickname: row.nickname,
      },
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("DATABASE_URL")) {
      return NextResponse.json({ user: null });
    }
    console.error("[auth/me]", e);
    return NextResponse.json({ user: null });
  }
}
