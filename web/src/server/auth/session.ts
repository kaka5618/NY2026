import { SignJWT, jwtVerify } from "jose";
import type { UserRowPublic } from "@/server/db/user-store";

/** Cookie 名称（httpOnly 会话） */
export const SESSION_COOKIE = "vb_session";

/** JWT 内载荷（不含敏感信息） */
export interface SessionPayload {
  sub: string;
  username: string;
  nickname: string;
}

let warnedInsecure = false;

/**
 * 读取签名密钥；生产环境必须配置 `AUTH_SECRET`。
 */
function getSecretKey(): Uint8Array {
  const raw = process.env.AUTH_SECRET?.trim();
  if (!raw || raw.length < 16) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("生产环境必须设置至少 16 位的 AUTH_SECRET");
    }
    if (!warnedInsecure) {
      warnedInsecure = true;
      console.warn(
        "[auth] 未配置 AUTH_SECRET 或长度不足，开发环境使用临时密钥；请勿用于生产。"
      );
    }
    return new TextEncoder().encode("dev-only-insecure-secret-key!!");
  }
  return new TextEncoder().encode(raw);
}

/**
 * 为用户签发 7 天有效的会话 JWT。
 */
export async function signSessionToken(user: UserRowPublic): Promise<string> {
  const key = getSecretKey();
  return new SignJWT({
    username: user.username,
    nickname: user.nickname,
  } satisfies Omit<SessionPayload, "sub">)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key);
}

/**
 * 校验 JWT 字符串，失败返回 null。
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const key = getSecretKey();
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    const sub = typeof payload.sub === "string" ? payload.sub : "";
    const username = typeof payload.username === "string" ? payload.username : "";
    const nickname = typeof payload.nickname === "string" ? payload.nickname : "";
    if (!sub || !username) return null;
    return { sub, username, nickname };
  } catch {
    return null;
  }
}

/**
 * 写入会话 Cookie 时的共用选项。
 */
export function sessionCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };
}
