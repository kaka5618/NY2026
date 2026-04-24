import { DatabaseError } from "pg";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { createUser } from "@/server/db/users-repo";
import { parseRegisterBody } from "@/server/auth/validate";
import {
  SESSION_COOKIE,
  assertSigningKeyReady,
  sessionCookieOptions,
  signSessionToken,
} from "@/server/auth/session";
import { verifyTurnstileResponse } from "@/server/auth/turnstile";

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

  const raw = json as Record<string, unknown>;
  const turnstileToken = typeof raw.turnstileToken === "string" ? raw.turnstileToken.trim() : "";
  const turnstileRequired = Boolean(process.env.TURNSTILE_SECRET_KEY?.trim());
  if (turnstileRequired) {
    if (!turnstileToken) {
      return NextResponse.json({ error: "请先完成人机验证" }, { status: 400 });
    }
    const forwarded = req.headers.get("x-forwarded-for");
    const remoteip =
      req.headers.get("cf-connecting-ip")?.trim() ||
      (forwarded ? forwarded.split(",")[0]?.trim() : undefined);
    const turnstileOk = await verifyTurnstileResponse(turnstileToken, remoteip);
    if (!turnstileOk) {
      return NextResponse.json({ error: "人机验证未通过，请重试" }, { status: 400 });
    }
  }

  try {
    assertSigningKeyReady();
  } catch {
    console.error("[auth/register] AUTH_SECRET 不可用，已阻止写入用户前失败（请检查生产环境 AUTH_SECRET）");
    return NextResponse.json(
      {
        error:
          "服务器未正确配置会话密钥（AUTH_SECRET），无法完成注册。若多次尝试后仍提示用户名已存在，请联系管理员删除误注册账号或补全配置后重试。",
      },
      { status: 503 }
    );
  }

  const { username, password, email, nickname } = parsed.data;
  const passwordHash = bcrypt.hashSync(password, 12);

  try {
    const user = await createUser({
      username,
      email,
      passwordHash,
      nickname,
    });
    const token = await signSessionToken(user);
    const res = NextResponse.json({
      user: { id: user.id, username: user.username, email: user.email, nickname: user.nickname },
    });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  } catch (e: unknown) {
    if (e instanceof DatabaseError && e.code === "23505") {
      return NextResponse.json({ error: "用户名或邮箱已被使用" }, { status: 409 });
    }
    if (e instanceof Error && e.message.includes("DATABASE_URL")) {
      return NextResponse.json({ error: "服务器未配置数据库，请联系管理员" }, { status: 503 });
    }
    if (e instanceof Error && e.message.includes("AUTH_SECRET")) {
      return NextResponse.json(
        { error: "服务器会话密钥异常，请联系管理员检查 AUTH_SECRET 配置" },
        { status: 503 }
      );
    }
    console.error("[auth/register]", e);
    return NextResponse.json({ error: "注册失败，请稍后重试" }, { status: 500 });
  }
}
