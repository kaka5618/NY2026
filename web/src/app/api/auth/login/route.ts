import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { findUserByLoginKey } from "@/server/db/user-store";
import { parseLoginBody } from "@/server/auth/validate";
import { SESSION_COOKIE, sessionCookieOptions, signSessionToken } from "@/server/auth/session";

export const runtime = "nodejs";

/**
 * POST /api/auth/login — 用户名或邮箱 + 密码登录。
 */
export async function POST(req: Request): Promise<Response> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON 解析失败" }, { status: 400 });
  }

  const parsed = parseLoginBody(json);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { loginKey, password } = parsed;
  const row = findUserByLoginKey(loginKey);
  if (!row || !bcrypt.compareSync(password, row.passwordHash)) {
    return NextResponse.json({ error: "用户名/邮箱或密码错误" }, { status: 401 });
  }

  const user = {
    id: row.id,
    username: row.username,
    email: row.email,
    nickname: row.nickname,
    createdAt: row.createdAt,
  };
  const token = await signSessionToken(user);
  const res = NextResponse.json({
    user: { id: user.id, username: user.username, email: user.email, nickname: user.nickname },
  });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
