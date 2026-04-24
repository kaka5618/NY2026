import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/server/auth/session";

/**
 * 从 Cookie 解析当前登录用户 id（JWT `sub`）；未登录或令牌无效时返回 null。
 */
export async function getOptionalSessionUserId(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const payload = await verifySessionToken(raw);
  const sub = payload?.sub?.trim();
  return sub || null;
}
