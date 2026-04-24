"use client";

import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { registerPageContent } from "./content";

export type RegisterPageViewProps = {
  /**
   * Cloudflare Turnstile 站点密钥；须由服务端页面传入，避免 `NEXT_PUBLIC_*` 仅在构建期注入导致线上为空。
   */
  turnstileSiteKey?: string;
};

/**
 * 注册页：提交用户名、密码、邮箱、昵称至 `/api/auth/register`，成功后写入会话并回首页。
 */
export function RegisterPageView({ turnstileSiteKey = "" }: RegisterPageViewProps) {
  const router = useRouter();
  const turnstileRef = useRef<TurnstileInstance | undefined>(undefined);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const siteKey = turnstileSiteKey.trim();
  const turnstileEnabled = Boolean(siteKey);
  const needTurnstile = turnstileEnabled && !turnstileToken;
  const resetTurnstile = () => {
    setTurnstileToken(null);
    turnstileRef.current?.reset();
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (needTurnstile) {
      setError("请先完成人机验证");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          username,
          password,
          email,
          nickname,
          turnstileToken: turnstileEnabled ? turnstileToken ?? "" : "",
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "注册失败");
        if (turnstileEnabled) {
          resetTurnstile();
        }
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("网络异常，请稍后重试");
      if (turnstileEnabled) {
        resetTurnstile();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-12 font-home">
      <div className="mx-auto w-full max-w-md rounded-3xl bg-slate-900/60 p-6 ring-1 ring-white/10">
        <p className="text-center text-xs tracking-[0.22em] text-rose-200/80">{registerPageContent.brand}</p>
        <h1 className="mt-3 text-center text-2xl font-semibold text-white">{registerPageContent.title}</h1>
        <p className="mt-2 text-center text-sm text-slate-400">{registerPageContent.subtitle}</p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-300">{registerPageContent.usernameLabel}</span>
            <input
              name="username"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-rose-300/60"
              placeholder={registerPageContent.usernameHint}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-slate-300">{registerPageContent.passwordLabel}</span>
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-rose-300/60"
              placeholder={registerPageContent.passwordHint}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-slate-300">{registerPageContent.emailLabel}</span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-rose-300/60"
              placeholder="name@example.com"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-slate-300">{registerPageContent.nicknameLabel}</span>
            <input
              name="nickname"
              type="text"
              autoComplete="nickname"
              required
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-rose-300/60"
              placeholder={registerPageContent.nicknameHint}
            />
          </label>

          {turnstileEnabled ? (
            <div className="flex flex-col items-center gap-2">
              <span className="w-full text-xs text-slate-300">{registerPageContent.turnstileLabel}</span>
              <Turnstile
                ref={turnstileRef}
                siteKey={siteKey}
                options={{ theme: "dark", size: "normal" }}
                onSuccess={(token) => setTurnstileToken(token)}
                onExpire={() => setTurnstileToken(null)}
                onError={() => {
                  setTurnstileToken(null);
                }}
              />
            </div>
          ) : null}

          {error ? <p className="text-center text-sm text-rose-300">{error}</p> : null}

          <button
            type="submit"
            disabled={loading || needTurnstile}
            className="mt-1 w-full rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-400 disabled:opacity-60"
          >
            {loading ? registerPageContent.submittingCta : registerPageContent.submitCta}
          </button>
        </form>

        <div className="mt-5 text-center">
          <Link href="/login" className="text-xs text-slate-400 transition hover:text-white">
            {registerPageContent.loginHint}
          </Link>
        </div>
        <div className="mt-3 text-center">
          <Link href="/" className="text-xs text-slate-500 transition hover:text-slate-300">
            返回首页
          </Link>
        </div>
      </div>
    </div>
  );
}
