import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { createUser } from "@/server/db/user-store";
import { parseRegisterBody } from "@/server/auth/validate";
import { SESSION_COOKIE, sessionCookieOptions, signSessionToken } from "@/server/auth/session";

export const runtime = "nodejs";

/**
 * POST /api/auth/register — 注册并自动登录（设置 httpOnly 会话 Cookie）。
 */
export async function POST(req: Request): Promise<Response> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON 解析失败" }, { status: 400 });
  }

  const parsed = parseRegisterBody(json);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { username, password, email, nickname } = parsed.data;
  const passwordHash = bcrypt.hashSync(password, 12);
  const now = Date.now();
  const id = randomUUID();

  try {
    const user = createUser({
      id,
      username,
      email,
      passwordHash,
      nickname,
      createdAt: now,
    });
    const token = await signSessionToken(user);
    const res = NextResponse.json({
      user: { id: user.id, username: user.username, email: user.email, nickname: user.nickname },
    });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  } catch (e: unknown) {
    const code = e && typeof e === "object" && "code" in e ? (e as { code: string }).code : "";
    if (code === "DUPLICATE") {
      return NextResponse.json({ error: "用户名或邮箱已被使用" }, { status: 409 });
    }
    console.error("[auth/register]", e);
    return NextResponse.json({ error: "注册失败，请稍后重试" }, { status: 500 });
  }
}
