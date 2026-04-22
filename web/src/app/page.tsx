import Link from "next/link";
import { listPublicCharacters } from "@vb/shared";

/**
 * 角色选择首页（服务端直出列表，无需额外请求）
 */
export default function HomePage() {
  const list = listPublicCharacters();

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <div className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-12 md:py-16">
        <header className="text-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-rose-300/90">
            Virtual Boyfriend
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-white md:text-4xl">
            虚拟男友 · 陪伴聊天
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-slate-400">
            选一个让你心安的人，慢慢聊。无付费墙、无好感度，只有对话本身。
          </p>
          <p className="mx-auto mt-3 max-w-xl rounded-2xl bg-amber-500/10 px-4 py-2 text-xs text-amber-100/90 ring-1 ring-amber-400/20">
            对话：配置根目录 .env.local 中 ARK_API_KEY 后走火山方舟。语音：配置 XFYUN_APP_ID / XFYUN_API_KEY /
            XFYUN_API_SECRET 后可播放角色语音。USE_ARK_CHAT=false 或 USE_XFYUN_TTS=false 可分别关闭对应能力。
          </p>
        </header>

        <div className="grid gap-5 sm:grid-cols-2">
          {list.map((c) => (
            <Link
              key={c.id}
              href={`/chat/${c.id}`}
              className="group relative overflow-hidden rounded-3xl bg-slate-900/60 p-5 ring-1 ring-white/10 transition hover:-translate-y-0.5 hover:ring-rose-300/40"
            >
              <div
                className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-40 blur-3xl"
                style={{
                  background: `linear-gradient(135deg, ${c.accentFrom}, ${c.accentTo})`,
                }}
              />
              <div className="relative flex gap-4">
                <img
                  src={c.avatarUrl}
                  alt=""
                  className="h-24 w-24 shrink-0 rounded-2xl object-cover ring-2 ring-white/10"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <h2 className="text-xl font-semibold text-white">{c.name}</h2>
                    <span className="text-sm text-slate-400">{c.age} 岁</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-300">{c.role}</p>
                  <p className="mt-2 text-xs font-medium text-rose-200/90">{c.personalityTag}</p>
                  <p className="mt-3 line-clamp-2 text-sm italic text-slate-400">
                    「{c.quote}」
                  </p>
                </div>
              </div>
              <span className="mt-4 inline-flex items-center text-xs font-medium text-rose-200/90 group-hover:text-rose-100">
                进入聊天 →
              </span>
            </Link>
          ))}
        </div>

        <footer className="text-center text-xs text-slate-500">
          聊天记录仅保存在本机浏览器。请遵守内容安全与理性使用提示。
        </footer>
      </div>
    </div>
  );
}
