"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { loginPageContent } from "./content";

/**
 * 登录页：`loginKey` 为用户名或邮箱，成功后写入会话 Cookie 并回首页。
 */
export function LoginPageView() {
  const router = useRouter();
  const [loginKey, setLoginKey] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthErrorText, setOauthErrorText] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get("error");
    if (oauthError) {
      setOauthErrorText("Google 登录失败，请重试或使用密码登录");
    }
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ loginKey, password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "登录失败");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-12 font-home">
      <div className="mx-auto w-full max-w-md rounded-3xl bg-slate-900/60 p-6 ring-1 ring-white/10">
        <p className="text-center text-xs tracking-[0.22em] text-rose-200/80">{loginPageContent.brand}</p>
        <h1 className="mt-3 text-center text-2xl font-semibold text-white">{loginPageContent.title}</h1>
        <p className="mt-2 text-center text-sm text-slate-400">{loginPageContent.subtitle}</p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-300">{loginPageContent.loginKeyLabel}</span>
            <input
              name="loginKey"
              autoComplete="username"
              required
              value={loginKey}
              onChange={(e) => setLoginKey(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-rose-300/60"
              placeholder="用户名或邮箱"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-slate-300">{loginPageContent.passwordLabel}</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-rose-300/60"
            />
          </label>

          {error ?? oauthErrorText ? (
            <p className="text-center text-sm text-rose-300">{error ?? oauthErrorText}</p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 w-full rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-400 disabled:opacity-60"
          >
            {loading ? loginPageContent.submittingCta : loginPageContent.submitCta}
          </button>
        </form>

        <div className="mt-4">
          <a
            href="/api/auth/google/start"
            className="block w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-center text-sm font-medium text-white transition hover:bg-white/10"
          >
            使用 Google 登录
          </a>
        </div>

        <div className="mt-5 text-center">
          <Link href="/register" className="text-xs text-slate-400 transition hover:text-white">
            {loginPageContent.registerHint}
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
