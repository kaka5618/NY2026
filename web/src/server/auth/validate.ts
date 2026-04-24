/** 注册请求体（已通过校验） */
export interface ValidRegisterBody {
  username: string;
  password: string;
  email: string;
  nickname: string;
}

const USERNAME_RE = /^[a-zA-Z0-9_]{3,32}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * 解析并校验注册表单字段；失败返回中文错误信息。
 */
export function parseRegisterBody(body: unknown): { ok: true; data: ValidRegisterBody } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "请求体无效" };
  }
  const o = body as Record<string, unknown>;
  const username = typeof o.username === "string" ? o.username.trim() : "";
  const password = typeof o.password === "string" ? o.password : "";
  const email = typeof o.email === "string" ? o.email.trim() : "";
  const nickname = typeof o.nickname === "string" ? o.nickname.trim() : "";

  if (!USERNAME_RE.test(username)) {
    return { ok: false, error: "用户名为 3–32 位字母、数字或下划线" };
  }
  if (password.length < 8 || password.length > 128) {
    return { ok: false, error: "密码长度为 8–128 位" };
  }
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: "邮箱格式不正确" };
  }
  if (nickname.length < 1 || nickname.length > 32) {
    return { ok: false, error: "昵称为 1–32 个字符" };
  }

  return { ok: true, data: { username, password, email, nickname } };
}

/**
 * 解析登录请求体。
 */
export function parseLoginBody(body: unknown): { ok: true; loginKey: string; password: string } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "请求体无效" };
  }
  const o = body as Record<string, unknown>;
  const loginKey = typeof o.loginKey === "string" ? o.loginKey.trim() : "";
  const password = typeof o.password === "string" ? o.password : "";
  if (!loginKey) {
    return { ok: false, error: "请填写用户名或邮箱" };
  }
  if (!password) {
    return { ok: false, error: "请填写密码" };
  }
  return { ok: true, loginKey, password };
}
