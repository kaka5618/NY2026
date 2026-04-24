import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { findUserById } from "@/server/db/user-store";
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
  const row = findUserById(payload.sub);
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
}
