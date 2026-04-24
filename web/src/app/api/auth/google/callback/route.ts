import { randomUUID } from "node:crypto";
import { DatabaseError } from "pg";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { createUser, findUserByEmail, findUserByUsername } from "@/server/db/users-repo";
import {
  SESSION_COOKIE,
  assertSigningKeyReady,
  sessionCookieOptions,
  signSessionToken,
} from "@/server/auth/session";

export const runtime = "nodejs";

const GOOGLE_OAUTH_STATE_COOKIE = "vb_google_oauth_state";

interface GoogleTokenResponse {
  access_token?: string;
}

interface GoogleUserInfo {
  email?: string;
  email_verified?: boolean;
  name?: string;
}

/**
 * 清洗字符串为用户名片段，仅保留字母数字和下划线。
 */
function sanitizeUsernamePart(input: string): string {
  return input.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();
}

/**
 * 生成候选用户名（最多尝试 8 次）。
 */
async function generateAvailableUsername(seed: string): Promise<string> {
  const baseRaw = sanitizeUsernamePart(seed);
  const base = (baseRaw || "googleuser").slice(0, 20);
  for (let i = 0; i < 8; i += 1) {
    const suffix = i === 0 ? "" : `${Math.floor(Math.random() * 9000) + 1000}`;
    const candidate = `${base}${suffix}`.slice(0, 24);
    const exists = await findUserByUsername(candidate);
    if (!exists) return candidate;
  }
  return `googleuser${Date.now().toString().slice(-6)}`;
}

/**
 * 清理 OAuth state Cookie。
 */
function clearOauthStateCookie(res: NextResponse): void {
  res.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * 构造回登录页的错误跳转响应。
 */
function redirectToLoginWithError(req: Request, code: string): NextResponse {
  const res = NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(code)}`, req.url));
  clearOauthStateCookie(res);
  return res;
}

/**
 * GET /api/auth/google/callback
 * 处理 Google OAuth 回调，创建/登录本站账号并写入会话 Cookie。
 */
export async function GET(req: Request): Promise<Response> {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get("code")?.trim() || "";
  const state = requestUrl.searchParams.get("state")?.trim() || "";
  if (!code || !state) {
    return redirectToLoginWithError(req, "google_missing_code");
  }

  const cookieHeader = req.headers.get("cookie") || "";
  const stateCookie = cookieHeader
    .split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(`${GOOGLE_OAUTH_STATE_COOKIE}=`))
    ?.split("=")[1];
  if (!stateCookie || stateCookie !== state) {
    return redirectToLoginWithError(req, "google_invalid_state");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return redirectToLoginWithError(req, "google_not_configured");
  }

  try {
    assertSigningKeyReady();
  } catch {
    return redirectToLoginWithError(req, "auth_secret_missing");
  }

  try {
    const callbackUrl = new URL("/api/auth/google/callback", req.url).toString();
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: callbackUrl,
      }).toString(),
    });
    if (!tokenRes.ok) {
      return redirectToLoginWithError(req, "google_token_exchange_failed");
    }

    const tokenJson = (await tokenRes.json()) as GoogleTokenResponse;
    const accessToken = tokenJson.access_token?.trim() || "";
    if (!accessToken) {
      return redirectToLoginWithError(req, "google_missing_access_token");
    }

    const userInfoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!userInfoRes.ok) {
      return redirectToLoginWithError(req, "google_userinfo_failed");
    }

    const userInfo = (await userInfoRes.json()) as GoogleUserInfo;
    const email = userInfo.email?.trim().toLowerCase() || "";
    if (!email || userInfo.email_verified !== true) {
      return redirectToLoginWithError(req, "google_email_unverified");
    }

    const existing = await findUserByEmail(email);
    const user =
      existing ??
      (await (async () => {
        const nickname = userInfo.name?.trim() || "Google 用户";
        for (let i = 0; i < 6; i += 1) {
          try {
            const username = await generateAvailableUsername(email.split("@")[0] || "googleuser");
            const passwordHash = bcrypt.hashSync(randomUUID(), 10);
            return await createUser({
              username,
              email,
              nickname,
              passwordHash,
            });
          } catch (e) {
            if (e instanceof DatabaseError && e.code === "23505") continue;
            throw e;
          }
        }
        throw new Error("google_user_create_conflict");
      })());

    const token = await signSessionToken(user);
    const res = NextResponse.redirect(new URL("/", req.url));
    clearOauthStateCookie(res);
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  } catch (e) {
    console.error("[auth/google/callback]", e);
    return redirectToLoginWithError(req, "google_login_failed");
  }
}
