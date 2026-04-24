import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { findUserByLoginKey } from "@/server/db/users-repo";
import { parseLoginBody } from "@/server/auth/validate";
import {
  SESSION_COOKIE,
  assertSigningKeyReady,
  sessionCookieOptions,
  signSessionToken,
} from "@/server/auth/session";

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

  try {
    assertSigningKeyReady();
  } catch {
    console.error("[auth/login] AUTH_SECRET 不可用");
    return NextResponse.json(
      { error: "服务器未正确配置会话密钥（AUTH_SECRET），暂无法登录，请联系管理员" },
      { status: 503 }
    );
  }

  try {
    const { loginKey, password } = parsed;
    const row = await findUserByLoginKey(loginKey);
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
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("DATABASE_URL")) {
      return NextResponse.json({ error: "服务器未配置数据库，请联系管理员" }, { status: 503 });
    }
    console.error("[auth/login]", e);
    return NextResponse.json({ error: "登录失败，请稍后重试" }, { status: 500 });
  }
}
