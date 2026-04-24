"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { registerPageContent } from "./content";

/**
 * 注册页：提交用户名、密码、邮箱、昵称至 `/api/auth/register`，成功后写入会话并回首页。
 */
export function RegisterPageView() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ username, password, email, nickname }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "注册失败");
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

          {error ? <p className="text-center text-sm text-rose-300">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
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
