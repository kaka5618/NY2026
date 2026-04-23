import Link from "next/link";
import { registerPageContent } from "./content";

/**
 * 注册页视图组件（当前为 UI 占位，不接后端提交）。
 */
export function RegisterPageView() {
  return (
    <div className="min-h-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-12">
      <div className="mx-auto w-full max-w-md rounded-3xl bg-slate-900/60 p-6 ring-1 ring-white/10">
        <p className="text-center text-xs uppercase tracking-[0.2em] text-rose-300/90">
          {registerPageContent.brand}
        </p>
        <h1 className="mt-3 text-center text-2xl font-semibold text-white">
          {registerPageContent.title}
        </h1>
        <p className="mt-2 text-center text-sm text-slate-400">
          {registerPageContent.subtitle}
        </p>

        <form className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs text-slate-300">
              {registerPageContent.nicknameLabel}
            </span>
            <input
              type="text"
              className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-rose-300/60"
              placeholder="你的昵称"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-slate-300">
              {registerPageContent.emailLabel}
            </span>
            <input
              type="email"
              className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-rose-300/60"
              placeholder="name@example.com"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-slate-300">
              {registerPageContent.passwordLabel}
            </span>
            <input
              type="password"
              className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-rose-300/60"
              placeholder="至少 8 位"
            />
          </label>

          <button
            type="button"
            className="mt-1 w-full rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-400"
          >
            {registerPageContent.submitCta}
          </button>
        </form>

        <div className="mt-5 text-center">
          <Link href="/" className="text-xs text-slate-400 transition hover:text-white">
            {registerPageContent.loginHint}
          </Link>
        </div>
      </div>
    </div>
  );
}
