/**
 * Cloudflare Turnstile：服务端校验前端提交的 token。
 * @see https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * 调用 siteverify 接口校验 Turnstile token。
 * 若未配置 `TURNSTILE_SECRET_KEY`，则跳过校验（便于本地未开 Turnstile 时开发）。
 *
 * @param token - 前端 Turnstile 回调得到的 response token
 * @param remoteip - 可选，客户端 IP（与官方文档字段一致）
 * @returns 是否校验通过
 */
export async function verifyTurnstileResponse(token: string, remoteip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    return true;
  }
  const t = token.trim();
  if (!t) {
    return false;
  }

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", t);
  if (remoteip) {
    body.set("remoteip", remoteip);
  }

  const res = await fetch(SITEVERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    return false;
  }

  const data = (await res.json()) as { success?: boolean };
  return data.success === true;
}
