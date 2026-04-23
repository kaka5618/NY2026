import { homePageContent } from "./content";
import DemoOne from "./demo";

/**
 * 首页视图组件（仅负责 UI 展示）。
 */
export function HomePageView() {
  return (
    <div className="min-h-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 md:py-12">
        <header className="text-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-rose-300/90">
            {homePageContent.brand}
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-white md:text-4xl">
            {homePageContent.title}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-slate-400">
            {homePageContent.subtitle}
          </p>
          <p className="mx-auto mt-3 max-w-xl rounded-2xl bg-amber-500/10 px-4 py-2 text-xs text-amber-100/90 ring-1 ring-amber-400/20">
            {homePageContent.envHint}
          </p>
        </header>

        <div className="rounded-3xl bg-slate-900/50 p-3 ring-1 ring-white/10">
          <DemoOne />
        </div>

        <footer className="text-center text-xs text-slate-500">
          {homePageContent.footer}
        </footer>
      </div>
    </div>
  );
}
